import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";

import type { DomainEvent } from "../../common/domain-event";
import { RIDE_REQUESTED_EVENT } from "../../common/events/event-types";
import { StructuredLogger } from "../../common/logging/structured-logger";
import { GeoFacade } from "../../geo/geo.facade";
import { RouteEstimator } from "../../routing/route-estimator";
import { FareCalculatorService } from "../fare/fare-calculator.service";
import { PRICING_SNAPSHOT_CREATED_EVENT } from "../pricing.constants";
import type { SurgeContext } from "../pricing.types";
import { PricingSnapshotRepository } from "../snapshot/pricing-snapshot.repository";
import { SurgeService } from "../surge/surge.service";

const CONTEXT = "RideRequestedPricingListener";

export interface RideRequestedPricingPayload {
  customerId: string;
  pickup: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  requestedAt: string;
}

export type RideRequestedPricingEvent = DomainEvent<RideRequestedPricingPayload>;

@Injectable()
export class RideRequestedPricingListener {
  constructor(
    private readonly geoFacade: GeoFacade,
    private readonly routeEstimator: RouteEstimator,
    private readonly surgeService: SurgeService,
    private readonly fareCalculator: FareCalculatorService,
    private readonly snapshotRepository: PricingSnapshotRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: StructuredLogger
  ) {}

  @OnEvent(RIDE_REQUESTED_EVENT)
  async handle(event: RideRequestedPricingEvent): Promise<void> {
    const rideId = event.aggregateId;
    const { pickup, destination } = event.payload;

    let cellR8: string;
    try {
      cellR8 = this.geoFacade.cellsForLocation(pickup.lat, pickup.lng).r8;
    } catch (error: unknown) {
      this.logger.warn(
        {
          event: "pricing.snapshot.invalid_pickup",
          rideId,
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        CONTEXT
      );
      return;
    }

    let route;
    try {
      route = await this.routeEstimator.estimate({ pickup, destination });
    } catch (error: unknown) {
      this.logger.warn(
        {
          event: "pricing.snapshot.route_estimate_failed",
          rideId,
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        CONTEXT
      );
      return;
    }

    const surge = await this.getSurgeOrDefault(cellR8, rideId);
    await this.surgeService.recordDemand(cellR8, rideId);
    const breakdown = this.fareCalculator.compute({
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      surgeMultiplier: surge.multiplier,
      routeConfidence: route.confidence
    });

    try {
      const snapshot = await this.snapshotRepository.insert({
        ...breakdown,
        rideId,
        pickupH3R8: cellR8,
        routeConfidence: route.confidence
      });

      const snapshotEvent: DomainEvent<{
        rideId: string;
        snapshotId: string;
        totalVnd: number;
        currency: string;
        surgeMultiplier: number;
      }> = {
        eventId: randomUUID(),
        eventType: PRICING_SNAPSHOT_CREATED_EVENT,
        aggregateType: "pricing-snapshot",
        aggregateId: snapshot.id,
        payload: {
          rideId,
          snapshotId: snapshot.id,
          totalVnd: snapshot.totalVnd,
          currency: snapshot.currency,
          surgeMultiplier: snapshot.surgeMultiplier
        },
        correlationId: event.correlationId,
        occurredAt: new Date().toISOString(),
        emittedBy: "pricing"
      };
      this.eventEmitter.emit(PRICING_SNAPSHOT_CREATED_EVENT, snapshotEvent);

      this.logger.log(
        {
          event: "pricing.snapshot.created",
          rideId,
          snapshotId: snapshot.id,
          totalVnd: snapshot.totalVnd,
          surgeMultiplier: snapshot.surgeMultiplier
        },
        CONTEXT
      );
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        this.logger.log(
          {
            event: "pricing.snapshot.duplicate_ignored",
            rideId
          },
          CONTEXT
        );
        return;
      }

      this.logger.warn(
        {
          event: "pricing.snapshot.persist_failed",
          rideId,
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        CONTEXT
      );
    }
  }

  private async getSurgeOrDefault(cellR8: string, rideId: string): Promise<SurgeContext> {
    try {
      return await this.surgeService.getMultiplier(cellR8);
    } catch (error: unknown) {
      this.logger.warn(
        {
          event: "pricing.surge.multiplier_failed",
          rideId,
          cellR8,
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        CONTEXT
      );
      return { cellR8, demand: 0, supply: 0, ratio: 0, multiplier: 1 };
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "23505"
    );
  }
}
