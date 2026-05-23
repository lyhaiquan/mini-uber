import type { ConfigService } from "@nestjs/config";
import type Redis from "ioredis";

import type { StructuredLogger } from "../../common/logging/structured-logger";
import type { EnvironmentVariables } from "../../config/env.validation";
import type { DriverWentOfflineDomainEvent } from "../../drivers/events/driver-events";
import { DriverLocationCacheService } from "./driver-location-cache.service";

const DRIVER_ID = "33333333-3333-3333-3333-333333333333";

function createService(): {
  service: DriverLocationCacheService;
  redis: jest.Mocked<Redis>;
  logger: jest.Mocked<StructuredLogger>;
} {
  const redis = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn()
  } as unknown as jest.Mocked<Redis>;
  const logger = {
    warn: jest.fn(),
    error: jest.fn()
  } as unknown as jest.Mocked<StructuredLogger>;
  const configService = {
    get: jest.fn().mockReturnValue(60)
  } as unknown as ConfigService<EnvironmentVariables, true>;

  return {
    service: new DriverLocationCacheService(redis, logger, configService),
    redis,
    logger
  };
}

describe("DriverLocationCacheService", () => {
  it("sets the expected Redis key with TTL", async () => {
    const { service, redis } = createService();
    const location = {
      lat: 10,
      lng: 106,
      recordedAt: "2026-05-16T00:00:00.000Z",
      receivedAt: "2026-05-16T00:00:01.000Z"
    };

    await service.set(DRIVER_ID, location);

    expect(redis.set).toHaveBeenCalledWith(
      `driver:location:${DRIVER_ID}`,
      JSON.stringify(location),
      "EX",
      60
    );
  });

  it("parses cached JSON values", async () => {
    const { service, redis } = createService();
    const location = {
      lat: 10,
      lng: 106,
      recordedAt: "2026-05-16T00:00:00.000Z",
      receivedAt: "2026-05-16T00:00:01.000Z"
    };
    redis.get.mockResolvedValue(JSON.stringify(location));

    await expect(service.get(DRIVER_ID)).resolves.toEqual(location);
  });

  it("returns null on cache miss", async () => {
    const { service, redis } = createService();
    redis.get.mockResolvedValue(null);

    await expect(service.get(DRIVER_ID)).resolves.toBeNull();
  });

  it("returns null and logs warning on malformed JSON", async () => {
    const { service, redis, logger } = createService();
    redis.get.mockResolvedValue("{bad json");

    await expect(service.get(DRIVER_ID)).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "driver.location.cache.malformed", driverId: DRIVER_ID }),
      "DriverLocationCacheService"
    );
  });

  it("clears the Redis key", async () => {
    const { service, redis } = createService();

    await service.clear(DRIVER_ID);

    expect(redis.del).toHaveBeenCalledWith(`driver:location:${DRIVER_ID}`);
  });

  it("clears cache when driver went offline event is observed", async () => {
    const { service, redis } = createService();
    const event = {
      aggregateId: DRIVER_ID
    } as DriverWentOfflineDomainEvent;

    await service.handleDriverWentOffline(event);

    expect(redis.del).toHaveBeenCalledWith(`driver:location:${DRIVER_ID}`);
  });
});
