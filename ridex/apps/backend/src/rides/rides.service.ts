import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { StructuredLogger } from "../common/logging/structured-logger";
import type { DomainEvent } from "../common/domain-event";
import type { CreateRideDto } from "./dto/create-ride.dto";
import type { RideResponseDto } from "./dto/ride-response.dto";
import { Ride } from "./entities/ride.entity";
import { RideEvent } from "./entities/ride-event.entity";
import { ActorType } from "./enums/actor-type.enum";
import { ACTIVE_RIDE_STATUSES, RideStatus } from "./enums/ride-status.enum";
import { RIDE_REQUESTED_EVENT, type RideRequestedPayload } from "./events/ride-events";
import { RideAlreadyActiveError } from "./errors/ride-already-active.error";
import { rideToResponseDto } from "./rides.mapper";

const CONTEXT = "RidesService";

@Injectable()
export class RidesService {
  constructor(
    @InjectRepository(Ride) private readonly rideRepo: Repository<Ride>,
    @InjectRepository(RideEvent) private readonly rideEventRepo: Repository<RideEvent>,
    private readonly logger: StructuredLogger,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async createRide(customerId: string, dto: CreateRideDto): Promise<RideResponseDto> {
    const existingActive = await this.findActiveByCustomer(customerId);
    if (existingActive !== null) {
      throw new RideAlreadyActiveError();
    }

    const response = await this.rideRepo.manager.transaction(async (manager) => {
      const now = new Date();
      const created = manager.create(Ride, {
        customerId,
        driverUserId: null,
        status: RideStatus.REQUESTED,
        pickupLat: dto.pickup.lat,
        pickupLng: dto.pickup.lng,
        pickupAddress: dto.pickup.address,
        destinationLat: dto.destination.lat,
        destinationLng: dto.destination.lng,
        destinationAddress: dto.destination.address,
        requestedAt: now,
        matchingStartedAt: null,
        acceptedAt: null,
        driverArrivedAt: null,
        startedAt: null,
        completedAt: null,
        cancelledAt: null,
        cancelledBy: null,
        cancellationReason: null,
        version: 0
      });

      const saved = await manager.save(Ride, created);

      const event = manager.create(RideEvent, {
        rideId: saved.id,
        fromStatus: null,
        toStatus: RideStatus.REQUESTED,
        actorType: ActorType.CUSTOMER,
        actorId: customerId,
        reason: null,
        metadata: null,
        occurredAt: new Date()
      });
      await manager.save(RideEvent, event);

      this.logger.log(
        {
          event: "ride.created",
          rideId: saved.id,
          customerId
        },
        CONTEXT
      );

      return rideToResponseDto(saved);
    });

    this.emitRideRequested(response);
    return response;
  }

  async findById(rideId: string): Promise<Ride | null> {
    return this.rideRepo.findOne({ where: { id: rideId } });
  }

  async findActiveByCustomer(customerId: string): Promise<Ride | null> {
    return this.rideRepo
      .createQueryBuilder("ride")
      .where("ride.customer_id = :customerId", { customerId })
      .andWhere("ride.status IN (:...statuses)", { statuses: ACTIVE_RIDE_STATUSES })
      .orderBy("ride.created_at", "DESC")
      .getOne();
  }

  // Used by the ride-tracking gateway to find which ride a driver is currently
  // on, so a driver.location-updated event can be fanned out to the customer's
  // ride room. Returns only rides at ACCEPTED+ to avoid leaking position to a
  // customer whose ride is still in MATCHING.
  async findAssignedActiveRideByDriver(driverUserId: string): Promise<Ride | null> {
    return this.rideRepo
      .createQueryBuilder("ride")
      .where("ride.driver_user_id = :driverUserId", { driverUserId })
      .andWhere("ride.status IN (:...statuses)", {
        statuses: [
          RideStatus.ACCEPTED,
          RideStatus.DRIVER_ARRIVED,
          RideStatus.IN_PROGRESS
        ]
      })
      .orderBy("ride.accepted_at", "DESC")
      .getOne();
  }

  async countActive(): Promise<number> {
    return this.rideRepo
      .createQueryBuilder("ride")
      .where("ride.status IN (:...statuses)", { statuses: ACTIVE_RIDE_STATUSES })
      .getCount();
  }

  async countByStatusSince(
    since: Date,
    statuses: readonly RideStatus[]
  ): Promise<number> {
    if (statuses.length === 0) {
      return 0;
    }
    return this.rideRepo
      .createQueryBuilder("ride")
      .where("ride.created_at >= :since", { since })
      .andWhere("ride.status IN (:...statuses)", { statuses })
      .getCount();
  }

  async countTotalSince(since: Date): Promise<number> {
    return this.rideRepo
      .createQueryBuilder("ride")
      .where("ride.created_at >= :since", { since })
      .getCount();
  }

  private emitRideRequested(ride: RideResponseDto): void {
    const event: DomainEvent<RideRequestedPayload> = {
      eventId: randomUUID(),
      eventType: RIDE_REQUESTED_EVENT,
      aggregateType: "ride",
      aggregateId: ride.id,
      payload: {
        customerId: ride.customerId,
        pickup: { lat: ride.pickup.lat, lng: ride.pickup.lng },
        destination: { lat: ride.destination.lat, lng: ride.destination.lng },
        requestedAt: ride.requestedAt
      },
      correlationId: randomUUID(),
      occurredAt: new Date().toISOString(),
      emittedBy: "rides"
    };

    try {
      this.eventEmitter.emit(RIDE_REQUESTED_EVENT, event);
    } catch (error: unknown) {
      this.logger.warn(
        {
          event: "ride.requested.emit_failed",
          rideId: ride.id,
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        CONTEXT
      );
    }
  }
}
