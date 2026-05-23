import type { EventEmitter2 } from "@nestjs/event-emitter";

import type { StructuredLogger } from "../../common/logging/structured-logger";
import type { GeoFacade } from "../../geo/geo.facade";
import type { RouteEstimator } from "../../routing/route-estimator";
import type { PricingSnapshot } from "../entities/pricing-snapshot.entity";
import type { FareCalculatorService } from "../fare/fare-calculator.service";
import { PRICING_SNAPSHOT_CREATED_EVENT } from "../pricing.constants";
import type { PricingSnapshotRepository } from "../snapshot/pricing-snapshot.repository";
import type { SurgeService } from "../surge/surge.service";
import {
  RideRequestedPricingListener,
  type RideRequestedPricingEvent
} from "./ride-requested.pricing-listener";

const RIDE_ID = "ride-1";
const CELL = "8828308281fffff";

function event(): RideRequestedPricingEvent {
  return {
    eventId: "evt-1",
    eventType: "ride.requested",
    aggregateType: "ride",
    aggregateId: RIDE_ID,
    payload: {
      customerId: "customer-1",
      pickup: { lat: 10, lng: 106 },
      destination: { lat: 11, lng: 107 },
      requestedAt: "2026-05-17T00:00:00.000Z"
    },
    correlationId: "corr-1",
    occurredAt: "2026-05-17T00:00:00.000Z",
    emittedBy: "rides"
  };
}

function createListener(): {
  listener: RideRequestedPricingListener;
  geoFacade: jest.Mocked<GeoFacade>;
  routeEstimator: jest.Mocked<RouteEstimator>;
  surgeService: jest.Mocked<SurgeService>;
  fareCalculator: jest.Mocked<FareCalculatorService>;
  repository: jest.Mocked<PricingSnapshotRepository>;
  eventEmitter: jest.Mocked<EventEmitter2>;
  logger: jest.Mocked<StructuredLogger>;
} {
  const geoFacade = {
    cellsForLocation: jest.fn().mockReturnValue({ r8: CELL, r9: "8928308280fffff" })
  } as unknown as jest.Mocked<GeoFacade>;
  const routeEstimator = {
    estimate: jest.fn().mockResolvedValue({
      distanceMeters: 5000,
      durationSeconds: 600,
      polyline: null,
      polylineFormat: null,
      confidence: "high",
      source: "osrm"
    })
  } as unknown as jest.Mocked<RouteEstimator>;
  const surgeService = {
    recordDemand: jest.fn(),
    getMultiplier: jest.fn().mockResolvedValue({
      cellR8: CELL,
      demand: 1,
      supply: 5,
      ratio: 0.2,
      multiplier: 1
    })
  } as unknown as jest.Mocked<SurgeService>;
  const fareCalculator = {
    compute: jest.fn().mockReturnValue({
      baseFareVnd: 12000,
      distanceMeters: 5000,
      distanceFeeVnd: 25000,
      durationSeconds: 600,
      durationFeeVnd: 5000,
      subtotalVnd: 42000,
      surgeMultiplier: 1,
      surgeAmountVnd: 0,
      minimumFareVnd: 15000,
      totalVnd: 42000,
      routeConfidence: "high"
    })
  } as unknown as jest.Mocked<FareCalculatorService>;
  const repository = {
    insert: jest.fn().mockImplementation(async (input) => ({
      id: "snap-1",
      ...input,
      currency: "VND",
      computedAt: new Date(),
      version: 0
    }) as PricingSnapshot)
  } as unknown as jest.Mocked<PricingSnapshotRepository>;
  const eventEmitter = {
    emit: jest.fn()
  } as unknown as jest.Mocked<EventEmitter2>;
  const logger = {
    log: jest.fn(),
    warn: jest.fn()
  } as unknown as jest.Mocked<StructuredLogger>;

  return {
    listener: new RideRequestedPricingListener(
      geoFacade,
      routeEstimator,
      surgeService,
      fareCalculator,
      repository,
      eventEmitter,
      logger
    ),
    geoFacade,
    routeEstimator,
    surgeService,
    fareCalculator,
    repository,
    eventEmitter,
    logger
  };
}

describe("RideRequestedPricingListener", () => {
  it("records demand, estimates route, computes fare, persists snapshot, emits event", async () => {
    const { listener, surgeService, repository, eventEmitter } = createListener();

    await listener.handle(event());

    expect(surgeService.recordDemand).toHaveBeenCalledWith(CELL, RIDE_ID);
    expect(surgeService.getMultiplier).toHaveBeenCalledWith(CELL);
    expect(surgeService.getMultiplier.mock.invocationCallOrder[0]).toBeLessThan(
      surgeService.recordDemand.mock.invocationCallOrder[0]
    );
    expect(repository.insert).toHaveBeenCalledWith(
      expect.objectContaining({ rideId: RIDE_ID, pickupH3R8: CELL, totalVnd: 42000 })
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      PRICING_SNAPSHOT_CREATED_EVENT,
      expect.objectContaining({
        eventType: PRICING_SNAPSHOT_CREATED_EVENT,
        emittedBy: "pricing",
        payload: expect.objectContaining({ rideId: RIDE_ID, totalVnd: 42000 })
      })
    );
  });

  it("logs and exits when pickup coords are invalid", async () => {
    const { listener, geoFacade, repository, logger } = createListener();
    (geoFacade.cellsForLocation as jest.Mock).mockImplementation(() => {
      throw new Error("invalid coord");
    });

    await listener.handle(event());

    expect(repository.insert).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "pricing.snapshot.invalid_pickup" }),
      "RideRequestedPricingListener"
    );
  });

  it("logs and exits when OSRM route estimate throws", async () => {
    const { listener, routeEstimator, repository, logger } = createListener();
    (routeEstimator.estimate as jest.Mock).mockRejectedValue(new Error("osrm down"));

    await listener.handle(event());

    expect(repository.insert).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "pricing.snapshot.route_estimate_failed" }),
      "RideRequestedPricingListener"
    );
  });

  it("logs and continues when snapshot persistence hits an idempotency duplicate", async () => {
    const { listener, repository, eventEmitter, logger } = createListener();
    (repository.insert as jest.Mock).mockRejectedValue({ code: "23505" });

    await listener.handle(event());

    expect(eventEmitter.emit).not.toHaveBeenCalled();
    expect(logger.log).toHaveBeenCalledWith(
      expect.objectContaining({ event: "pricing.snapshot.duplicate_ignored" }),
      "RideRequestedPricingListener"
    );
    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.objectContaining({ event: "pricing.snapshot.persist_failed" }),
      "RideRequestedPricingListener"
    );
  });

  it("warns when snapshot persistence throws a non-idempotency database error", async () => {
    const { listener, repository, eventEmitter, logger } = createListener();
    (repository.insert as jest.Mock).mockRejectedValue(new Error("db down"));

    await listener.handle(event());

    expect(eventEmitter.emit).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "pricing.snapshot.persist_failed" }),
      "RideRequestedPricingListener"
    );
  });

  it("uses the surge multiplier from SurgeService", async () => {
    const { listener, surgeService, fareCalculator } = createListener();
    (surgeService.getMultiplier as jest.Mock).mockResolvedValue({
      cellR8: CELL,
      demand: 10,
      supply: 2,
      ratio: 5,
      multiplier: 2.5
    });

    await listener.handle(event());

    expect(fareCalculator.compute).toHaveBeenCalledWith(
      expect.objectContaining({ surgeMultiplier: 2.5 })
    );
  });

  it("uses multiplier 1 when SurgeService throws", async () => {
    const { listener, surgeService, fareCalculator, repository, logger } = createListener();
    (surgeService.getMultiplier as jest.Mock).mockRejectedValue(new Error("redis down"));

    await listener.handle(event());

    expect(fareCalculator.compute).toHaveBeenCalledWith(
      expect.objectContaining({ surgeMultiplier: 1 })
    );
    expect(repository.insert).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "pricing.surge.multiplier_failed" }),
      "RideRequestedPricingListener"
    );
  });
});
