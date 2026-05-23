import { randomUUID } from "node:crypto";

import { Injectable, Optional } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { DataSource, type EntityManager } from "typeorm";

import type { DomainEvent } from "../common/domain-event";
import { RIDE_COMPLETED_EVENT, RIDE_TRANSITIONED_EVENT } from "../common/events/event-types";
import { StructuredLogger } from "../common/logging/structured-logger";
import type { RideTransitionedPayload } from "./events/ride-events";
import { ActorType, type TransitionActor } from "./enums/actor-type.enum";
import { RideStatus } from "./enums/ride-status.enum";
import { Ride } from "./entities/ride.entity";
import { RideEvent } from "./entities/ride-event.entity";
import {
  RideForbiddenTransitionError,
  RideInvalidTransitionError,
  RideNotFoundError,
  RideVersionConflictError
} from "./errors/ride-errors";
import {
  findTransitionRule,
  type AllowedActor,
  type OwnershipRequirement
} from "./transitions/allowed-transitions";
import type { RideResponseDto } from "./dto/ride-response.dto";
import { rideToResponseDto } from "./rides.mapper";

const CONTEXT = "RideTransitionService";

export interface TransitionOptions {
  reason?: string;
  metadata?: Record<string, unknown> | null;
  expectedVersion?: number;
  driverUserId?: string;
}

@Injectable()
export class RideTransitionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: StructuredLogger,
    @Optional() private readonly eventEmitter?: EventEmitter2
  ) {}

  async transition(
    rideId: string,
    toStatus: RideStatus,
    actor: TransitionActor,
    options: TransitionOptions = {}
  ): Promise<RideResponseDto> {
    const response = await this.dataSource.transaction(async (manager) => {
      const ride = await this.lockRide(manager, rideId);

      // Early fail-fast for stale client reads: if the caller passed
      // expectedVersion and it doesn't match the row we just locked, reject
      // with a clear error before doing any work.
      if (options.expectedVersion !== undefined && ride.version !== options.expectedVersion) {
        throw new RideVersionConflictError();
      }

      const rule = findTransitionRule(ride.status, toStatus);
      if (rule === undefined) {
        throw new RideInvalidTransitionError(ride.status, toStatus);
      }

      const allowedActor = matchActor(rule.allowed, actor, ride);
      if (allowedActor === undefined) {
        throw new RideForbiddenTransitionError();
      }

      const fromStatus = ride.status;
      const newVersion = ride.version + 1;
      const patch = this.buildUpdatePatch(toStatus, actor, options);
      patch.version = newVersion;

      // Defense-in-depth: include `version` in the WHERE clause so the UPDATE
      // itself becomes a conditional. The FOR UPDATE lock already serialises
      // concurrent transactions, so this is a belt-and-suspenders check that
      // also catches bugs where the lock is missing on some future code path.
      const updateResult = await manager.update(
        Ride,
        { id: ride.id, version: ride.version },
        patch
      );

      if (updateResult.affected !== 1) {
        throw new RideVersionConflictError();
      }

      // Reflect the persisted state on the in-memory ride for the response/audit row.
      Object.assign(ride, patch);

      const rideEvent = manager.create(RideEvent, {
        rideId: ride.id,
        fromStatus,
        toStatus,
        actorType: actor.type,
        actorId: actor.userId,
        reason: options.reason ?? null,
        metadata: options.metadata ?? null,
        occurredAt: new Date()
      });
      await manager.save(RideEvent, rideEvent);

      this.logger.log(
        {
          event: "ride.transition",
          rideId: ride.id,
          fromStatus,
          toStatus,
          actorType: actor.type,
          actorId: actor.userId,
          reason: options.reason ?? null
        },
        CONTEXT
      );

      return { dto: rideToResponseDto(ride), fromStatus, actorType: actor.type };
    });

    this.emitRideTransitioned(response.dto, response.fromStatus, response.actorType);

    if (response.dto.status === RideStatus.COMPLETED) {
      this.emitRideCompleted(response.dto);
    }

    return response.dto;
  }

  private emitRideTransitioned(
    ride: RideResponseDto,
    fromStatus: RideStatus,
    actorType: ActorType
  ): void {
    if (this.eventEmitter === undefined) {
      return;
    }

    const event: DomainEvent<RideTransitionedPayload> = {
      eventId: randomUUID(),
      eventType: RIDE_TRANSITIONED_EVENT,
      aggregateType: "ride",
      aggregateId: ride.id,
      payload: {
        rideId: ride.id,
        customerId: ride.customerId,
        driverUserId: ride.driverUserId,
        fromStatus,
        toStatus: ride.status,
        actorType,
        occurredAt: new Date().toISOString()
      },
      correlationId: randomUUID(),
      occurredAt: new Date().toISOString(),
      emittedBy: "rides"
    };

    try {
      this.eventEmitter.emit(RIDE_TRANSITIONED_EVENT, event);
    } catch (error: unknown) {
      this.logger.warn(
        {
          event: "ride.transitioned.emit_failed",
          rideId: ride.id,
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        CONTEXT
      );
    }
  }

  private async lockRide(manager: EntityManager, rideId: string): Promise<Ride> {
    const ride = await manager.findOne(Ride, {
      where: { id: rideId },
      lock: { mode: "pessimistic_write" }
    });

    if (ride === null) {
      throw new RideNotFoundError();
    }

    return ride;
  }

  private emitRideCompleted(ride: RideResponseDto): void {
    if (this.eventEmitter === undefined) {
      return;
    }

    const event: DomainEvent<{
      rideId: string;
      customerId: string;
      driverUserId: string | null;
      completedAt: string | null;
    }> = {
      eventId: randomUUID(),
      eventType: RIDE_COMPLETED_EVENT,
      aggregateType: "ride",
      aggregateId: ride.id,
      payload: {
        rideId: ride.id,
        customerId: ride.customerId,
        driverUserId: ride.driverUserId,
        completedAt: ride.completedAt
      },
      correlationId: randomUUID(),
      occurredAt: new Date().toISOString(),
      emittedBy: "rides"
    };

    try {
      this.eventEmitter.emit(RIDE_COMPLETED_EVENT, event);
    } catch (error: unknown) {
      this.logger.warn(
        {
          event: "ride.completed.emit_failed",
          rideId: ride.id,
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        CONTEXT
      );
    }
  }

  private buildUpdatePatch(
    toStatus: RideStatus,
    actor: TransitionActor,
    options: TransitionOptions
  ): Partial<Ride> {
    const now = new Date();
    const patch: Partial<Ride> = { status: toStatus };

    switch (toStatus) {
      case RideStatus.MATCHING:
        patch.matchingStartedAt = now;
        break;
      case RideStatus.ACCEPTED: {
        const driverUserId = options.driverUserId ?? extractDriverUserId(options.metadata);
        if (driverUserId === undefined || driverUserId.length === 0) {
          throw new Error(
            "Transitioning to ACCEPTED requires options.driverUserId (or metadata.driverUserId)."
          );
        }
        patch.driverUserId = driverUserId;
        patch.acceptedAt = now;
        break;
      }
      case RideStatus.DRIVER_ARRIVED:
        patch.driverArrivedAt = now;
        break;
      case RideStatus.IN_PROGRESS:
        patch.startedAt = now;
        break;
      case RideStatus.COMPLETED:
        patch.completedAt = now;
        break;
      case RideStatus.CANCELLED:
        patch.cancelledAt = now;
        patch.cancelledBy = actor.type;
        patch.cancellationReason = options.reason ?? null;
        break;
      case RideStatus.NO_DRIVERS_FOUND:
        patch.cancelledAt = now;
        patch.cancelledBy = ActorType.SYSTEM;
        patch.cancellationReason = options.reason ?? "no_candidates";
        break;
      case RideStatus.REQUESTED:
        // REQUESTED is a creation-only state — never a transition target.
        // The state machine never reaches this branch because no rule has
        // to: REQUESTED.
        break;
      default: {
        const exhaustive: never = toStatus;
        throw new Error(`Unhandled ride status: ${exhaustive as string}`);
      }
    }

    return patch;
  }
}

function matchActor(
  allowed: ReadonlyArray<AllowedActor>,
  actor: TransitionActor,
  ride: Ride
): AllowedActor | undefined {
  for (const candidate of allowed) {
    if (candidate.type !== actor.type) {
      continue;
    }

    if (!ownershipSatisfied(candidate.ownership, actor, ride)) {
      continue;
    }

    return candidate;
  }

  return undefined;
}

function ownershipSatisfied(
  requirement: OwnershipRequirement,
  actor: TransitionActor,
  ride: Ride
): boolean {
  if (requirement === "none") {
    return true;
  }

  if (actor.userId === null) {
    return false;
  }

  if (requirement === "customer") {
    return ride.customerId === actor.userId;
  }

  if (requirement === "driver") {
    return ride.driverUserId !== null && ride.driverUserId === actor.userId;
  }

  return false;
}

function extractDriverUserId(metadata: Record<string, unknown> | null | undefined): string | undefined {
  if (metadata === undefined || metadata === null) {
    return undefined;
  }

  const value = metadata.driverUserId;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
