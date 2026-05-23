import type { ConfigService } from "@nestjs/config";

import type { StructuredLogger } from "../../common/logging/structured-logger";
import type { EnvironmentVariables } from "../../config/env.validation";
import type { DriversFacade } from "../../drivers/drivers.facade";
import type { GeoFacade } from "../../geo/geo.facade";
import type { DriverLocationCacheService } from "../../location/cache/driver-location-cache.service";
import type { RouteEstimator } from "../../routing/route-estimator";
import { CandidateScoringService } from "./candidate-scoring.service";
import { CandidateSelectionService } from "./candidate-selection.service";
import type { RideOfferRepository } from "../offer/ride-offer.repository";

const RIDE = {
  id: "ride-1",
  customerId: "customer-1",
  pickup: { lat: 10, lng: 106 },
  destination: { lat: 11, lng: 107 }
};

describe("CandidateSelectionService", () => {
  it("returns top candidates sorted by score ascending", async () => {
    const { service, routeEstimator } = createService({ maxCandidates: 2 });
    routeEstimator.estimate
      .mockResolvedValueOnce({ distanceMeters: 5000, durationSeconds: 300, confidence: "high", source: "osrm", polyline: null, polylineFormat: null })
      .mockResolvedValueOnce({ distanceMeters: 1000, durationSeconds: 60, confidence: "high", source: "osrm", polyline: null, polylineFormat: null })
      .mockResolvedValueOnce({ distanceMeters: 3000, durationSeconds: 120, confidence: "high", source: "osrm", polyline: null, polylineFormat: null });

    const result = await service.selectCandidates(RIDE);

    expect(result.map((candidate) => candidate.driverUserId)).toEqual(["driver-2", "driver-3"]);
  });

  it("filters offline drivers", async () => {
    const { service, driversFacade } = createService();
    driversFacade.isOnline.mockImplementation(async (driverId) => driverId !== "driver-1");

    const result = await service.selectCandidates(RIDE);

    expect(result.map((candidate) => candidate.driverUserId)).not.toContain("driver-1");
  });

  it("filters drivers without cached location", async () => {
    const { service, locationCache } = createService();
    locationCache.get.mockImplementation(async (driverId) =>
      driverId === "driver-2" ? null : { lat: 10, lng: 106, recordedAt: "x", receivedAt: "x" }
    );

    const result = await service.selectCandidates(RIDE);

    expect(result.map((candidate) => candidate.driverUserId)).not.toContain("driver-2");
  });

  it("filters the requesting customer's own user id", async () => {
    const { service, geoFacade } = createService();
    geoFacade.findNearbyDrivers.mockResolvedValue(["customer-1", "driver-1"]);

    const result = await service.selectCandidates(RIDE);

    expect(result.map((candidate) => candidate.driverUserId)).toEqual(["driver-1"]);
  });

  it("filters drivers with active offered rows", async () => {
    const { service, offerRepository } = createService();
    offerRepository.hasActiveOfferForDriver.mockImplementation(async (driverId) => driverId === "driver-1");

    const result = await service.selectCandidates(RIDE);

    expect(result.map((candidate) => candidate.driverUserId)).not.toContain("driver-1");
  });

  it("returns an empty list when discovery is empty", async () => {
    const { service, geoFacade } = createService();
    geoFacade.findNearbyDrivers.mockResolvedValue([]);

    await expect(service.selectCandidates(RIDE)).resolves.toEqual([]);
  });

  it("logs and skips a driver when route estimation throws", async () => {
    const { service, routeEstimator, logger } = createService();
    routeEstimator.estimate.mockRejectedValueOnce(new Error("bad route"));

    const result = await service.selectCandidates(RIDE);

    expect(result.map((candidate) => candidate.driverUserId)).not.toContain("driver-1");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "matching.candidate.route_estimate_failed" }),
      "CandidateSelectionService"
    );
  });
});

function createService(options: { maxCandidates?: number } = {}): {
  service: CandidateSelectionService;
  geoFacade: jest.Mocked<GeoFacade>;
  driversFacade: jest.Mocked<DriversFacade>;
  routeEstimator: jest.Mocked<RouteEstimator>;
  locationCache: jest.Mocked<DriverLocationCacheService>;
  offerRepository: jest.Mocked<RideOfferRepository>;
  logger: jest.Mocked<StructuredLogger>;
} {
  const geoFacade = {
    findNearbyDrivers: jest.fn().mockResolvedValue(["driver-1", "driver-2", "driver-3"])
  } as unknown as jest.Mocked<GeoFacade>;
  const driversFacade = {
    isOnline: jest.fn().mockResolvedValue(true)
  } as unknown as jest.Mocked<DriversFacade>;
  const routeEstimator = {
    estimate: jest.fn().mockResolvedValue({
      distanceMeters: 1000,
      durationSeconds: 60,
      confidence: "high",
      source: "osrm",
      polyline: null,
      polylineFormat: null
    })
  } as unknown as jest.Mocked<RouteEstimator>;
  const locationCache = {
    get: jest.fn().mockResolvedValue({ lat: 10, lng: 106, recordedAt: "x", receivedAt: "x" })
  } as unknown as jest.Mocked<DriverLocationCacheService>;
  const offerRepository = {
    findAttemptedDriverIds: jest.fn().mockResolvedValue([]),
    hasActiveOfferForDriver: jest.fn().mockResolvedValue(false)
  } as unknown as jest.Mocked<RideOfferRepository>;
  const logger = {
    warn: jest.fn()
  } as unknown as jest.Mocked<StructuredLogger>;
  const configService = {
    get: jest.fn((key: keyof EnvironmentVariables) => {
      const values: Partial<EnvironmentVariables> = {
        MATCHING_MAX_CANDIDATES: options.maxCandidates ?? 5,
        MATCHING_DISCOVERY_MAX_RING: 3,
        MATCHING_SCORE_DISTANCE_WEIGHT: 0.6,
        MATCHING_SCORE_ETA_WEIGHT: 0.4
      };
      return values[key];
    })
  } as unknown as ConfigService<EnvironmentVariables, true>;

  return {
    service: new CandidateSelectionService(
      geoFacade,
      driversFacade,
      routeEstimator,
      locationCache,
      offerRepository,
      new CandidateScoringService(),
      logger,
      configService
    ),
    geoFacade,
    driversFacade,
    routeEstimator,
    locationCache,
    offerRepository,
    logger
  };
}

