import type { ConfigService } from "@nestjs/config";

import type { StructuredLogger } from "../common/logging/structured-logger";
import type { EnvironmentVariables } from "../config/env.validation";
import { haversine } from "../location/jump/haversine";
import type { OsrmClient } from "./osrm/osrm.client";
import { RouteEstimator } from "./route-estimator";
import { InvalidRouteCoordinateError } from "./routing.types";

const PICKUP = { lat: 10.7, lng: 106.7 };
const DESTINATION = { lat: 10.8, lng: 106.8 };
const DEFAULT_CONFIG = {
  ROUTING_FALLBACK_ROAD_FACTOR: 1.3,
  ROUTING_FALLBACK_CITY_SPEED_KMH: 30,
  ROUTING_ESTIMATE_CACHE_SIZE: 1024,
  ROUTING_ESTIMATE_CACHE_TTL_SECONDS: 60
};

describe("RouteEstimator", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("maps an OSRM route to a high-confidence estimate", async () => {
    const { estimator, osrmClient } = createEstimator();
    osrmClient.fetchRoute.mockResolvedValue({
      distance: 1234.4,
      duration: 456.6,
      geometry: "encoded-polyline"
    });

    await expect(estimator.estimate({ pickup: PICKUP, destination: DESTINATION })).resolves.toEqual({
      distanceMeters: 1234,
      durationSeconds: 457,
      polyline: "encoded-polyline",
      polylineFormat: "polyline5",
      confidence: "high",
      source: "osrm"
    });
  });

  it("uses haversine fallback when OSRM returns null", async () => {
    const { estimator, osrmClient } = createEstimator();
    osrmClient.fetchRoute.mockResolvedValue(null);
    const expectedDistance = Math.round(
      haversine(PICKUP.lat, PICKUP.lng, DESTINATION.lat, DESTINATION.lng) * 1.3
    );
    const expectedDuration = Math.round((expectedDistance / 1000 / 30) * 3600);

    await expect(estimator.estimate({ pickup: PICKUP, destination: DESTINATION })).resolves.toEqual({
      distanceMeters: expectedDistance,
      durationSeconds: expectedDuration,
      polyline: null,
      polylineFormat: null,
      confidence: "low",
      source: "fallback"
    });
  });

  it("uses configured road factor and city speed for fallback estimates", async () => {
    const { estimator, osrmClient } = createEstimator({
      ROUTING_FALLBACK_ROAD_FACTOR: 2,
      ROUTING_FALLBACK_CITY_SPEED_KMH: 60
    });
    osrmClient.fetchRoute.mockResolvedValue(null);
    const expectedDistance = Math.round(
      haversine(PICKUP.lat, PICKUP.lng, DESTINATION.lat, DESTINATION.lng) * 2
    );
    const expectedDuration = Math.round((expectedDistance / 1000 / 60) * 3600);

    const result = await estimator.estimate({ pickup: PICKUP, destination: DESTINATION });

    expect(result.distanceMeters).toBe(expectedDistance);
    expect(result.durationSeconds).toBe(expectedDuration);
    expect(result.confidence).toBe("low");
  });

  it("returns a zero estimate for identical coordinates without calling OSRM", async () => {
    const { estimator, osrmClient } = createEstimator();

    await expect(estimator.estimate({ pickup: PICKUP, destination: PICKUP })).resolves.toEqual({
      distanceMeters: 0,
      durationSeconds: 0,
      polyline: null,
      polylineFormat: null,
      confidence: "high",
      source: "fallback"
    });
    expect(osrmClient.fetchRoute).not.toHaveBeenCalled();
  });

  it("throws InvalidRouteCoordinateError for invalid pickup coordinates", async () => {
    const { estimator, osrmClient } = createEstimator();

    await expect(
      estimator.estimate({
        pickup: { lat: 91, lng: 106.7 },
        destination: DESTINATION
      })
    ).rejects.toThrow(InvalidRouteCoordinateError);
    expect(osrmClient.fetchRoute).not.toHaveBeenCalled();
  });

  it("throws InvalidRouteCoordinateError for invalid destination coordinates", async () => {
    const { estimator, osrmClient } = createEstimator();

    await expect(
      estimator.estimate({
        pickup: PICKUP,
        destination: { lat: 10.8, lng: Number.NaN }
      })
    ).rejects.toThrow(InvalidRouteCoordinateError);
    expect(osrmClient.fetchRoute).not.toHaveBeenCalled();
  });

  it("rounds OSRM distance and duration to integers", async () => {
    const { estimator, osrmClient } = createEstimator();
    osrmClient.fetchRoute.mockResolvedValue({
      distance: 10.5,
      duration: 20.49,
      geometry: "encoded-polyline"
    });

    const result = await estimator.estimate({ pickup: PICKUP, destination: DESTINATION });

    expect(result.distanceMeters).toBe(11);
    expect(result.durationSeconds).toBe(20);
    expect(Number.isInteger(result.distanceMeters)).toBe(true);
    expect(Number.isInteger(result.durationSeconds)).toBe(true);
  });

  it("accepts valid boundary coordinates before calling OSRM", async () => {
    const { estimator, osrmClient } = createEstimator();
    osrmClient.fetchRoute.mockResolvedValue({
      distance: 1,
      duration: 1,
      geometry: "encoded-polyline"
    });

    await estimator.estimate({
      pickup: { lat: -90, lng: -180 },
      destination: { lat: 90, lng: 180 }
    });

    expect(osrmClient.fetchRoute).toHaveBeenCalledWith(
      { lat: -90, lng: -180 },
      { lat: 90, lng: 180 }
    );
  });

  it("returns a cached high-confidence estimate for identical route keys", async () => {
    const { estimator, osrmClient, logger } = createEstimator();
    osrmClient.fetchRoute.mockResolvedValue({
      distance: 1234,
      duration: 456,
      geometry: "encoded-polyline"
    });

    const first = await estimator.estimate({ pickup: PICKUP, destination: DESTINATION });
    const second = await estimator.estimate({ pickup: PICKUP, destination: DESTINATION });

    expect(second).toBe(first);
    expect(osrmClient.fetchRoute).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.objectContaining({ event: "routing.estimate.cache_hit" }),
      "RouteEstimator"
    );
  });

  it("expires route estimates after the configured TTL", async () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(1_000);
    const { estimator, osrmClient } = createEstimator({
      ROUTING_ESTIMATE_CACHE_TTL_SECONDS: 60
    });
    osrmClient.fetchRoute
      .mockResolvedValueOnce({ distance: 1000, duration: 100, geometry: "first" })
      .mockResolvedValueOnce({ distance: 2000, duration: 200, geometry: "second" });

    await estimator.estimate({ pickup: PICKUP, destination: DESTINATION });
    now.mockReturnValue(61_001);
    const second = await estimator.estimate({ pickup: PICKUP, destination: DESTINATION });

    expect(osrmClient.fetchRoute).toHaveBeenCalledTimes(2);
    expect(second.distanceMeters).toBe(2000);
  });

  it("does not cache low-confidence fallback estimates", async () => {
    const { estimator, osrmClient } = createEstimator();
    osrmClient.fetchRoute.mockResolvedValue(null);

    await estimator.estimate({ pickup: PICKUP, destination: DESTINATION });
    await estimator.estimate({ pickup: PICKUP, destination: DESTINATION });

    expect(osrmClient.fetchRoute).toHaveBeenCalledTimes(2);
  });

  it("does not cache thrown OSRM failures", async () => {
    const { estimator, osrmClient } = createEstimator();
    osrmClient.fetchRoute
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ distance: 1000, duration: 100, geometry: "retry" });

    await expect(
      estimator.estimate({ pickup: PICKUP, destination: DESTINATION })
    ).rejects.toThrow("network");
    await expect(
      estimator.estimate({ pickup: PICKUP, destination: DESTINATION })
    ).resolves.toMatchObject({ distanceMeters: 1000 });

    expect(osrmClient.fetchRoute).toHaveBeenCalledTimes(2);
  });

  it("evicts the least recently used cached route when capacity is exceeded", async () => {
    const { estimator, osrmClient } = createEstimator({
      ROUTING_ESTIMATE_CACHE_SIZE: 2
    });
    osrmClient.fetchRoute.mockResolvedValue({
      distance: 1000,
      duration: 100,
      geometry: "encoded-polyline"
    });
    const routeA = { pickup: PICKUP, destination: DESTINATION };
    const routeB = { pickup: { lat: 10.71, lng: 106.71 }, destination: DESTINATION };
    const routeC = { pickup: { lat: 10.72, lng: 106.72 }, destination: DESTINATION };

    await estimator.estimate(routeA);
    await estimator.estimate(routeB);
    await estimator.estimate(routeC);
    await estimator.estimate(routeA);

    expect(osrmClient.fetchRoute).toHaveBeenCalledTimes(4);
  });
});

function createEstimator(overrides: Partial<typeof DEFAULT_CONFIG> = {}): {
  estimator: RouteEstimator;
  osrmClient: jest.Mocked<OsrmClient>;
  logger: jest.Mocked<StructuredLogger>;
} {
  const configValues = { ...DEFAULT_CONFIG, ...overrides };
  const osrmClient = {
    fetchRoute: jest.fn()
  } as unknown as jest.Mocked<OsrmClient>;
  const configService = {
    get: jest.fn((key: keyof typeof DEFAULT_CONFIG) => configValues[key])
  } as unknown as ConfigService<EnvironmentVariables, true>;
  const logger = {
    debug: jest.fn()
  } as unknown as jest.Mocked<StructuredLogger>;

  return {
    estimator: new RouteEstimator(osrmClient, configService, logger),
    osrmClient,
    logger
  };
}
