import type { ConfigService } from "@nestjs/config";
import type Redis from "ioredis";

import type { StructuredLogger } from "../../common/logging/structured-logger";
import type { EnvironmentVariables } from "../../config/env.validation";
import type { GeoFacade } from "../../geo/geo.facade";
import { SurgeService } from "./surge.service";

const CELL = "8828308281fffff";
const RIDE = "ride-1";
const NOW = 1_700_000_000_000;

const CONFIG = {
  PRICING_SURGE_RATIO_THRESHOLD: 1.0,
  PRICING_SURGE_COEFFICIENT: 0.5,
  PRICING_SURGE_CAP: 3.0,
  PRICING_DEMAND_WINDOW_SECONDS: 300
};

function createService(config: Partial<typeof CONFIG> = {}): {
  service: SurgeService;
  redis: jest.Mocked<Redis>;
  geoFacade: jest.Mocked<GeoFacade>;
  logger: jest.Mocked<StructuredLogger>;
} {
  const values = { ...CONFIG, ...config };
  const redis = {
    zadd: jest.fn().mockResolvedValue(1),
    pexpire: jest.fn().mockResolvedValue(1),
    zremrangebyscore: jest.fn().mockResolvedValue(0),
    zcard: jest.fn().mockResolvedValue(0)
  } as unknown as jest.Mocked<Redis>;
  const geoFacade = {
    getOnlineDriverCount: jest.fn().mockResolvedValue(0)
  } as unknown as jest.Mocked<GeoFacade>;
  const logger = {
    warn: jest.fn()
  } as unknown as jest.Mocked<StructuredLogger>;
  const configService = {
    get: jest.fn((key: keyof typeof CONFIG) => values[key])
  } as unknown as ConfigService<EnvironmentVariables, true>;

  return {
    service: new SurgeService(redis, geoFacade, logger, configService),
    redis,
    geoFacade,
    logger
  };
}

describe("SurgeService.recordDemand", () => {
  it("ZADDs the demand with now and sets pexpire", async () => {
    const { service, redis } = createService();

    await service.recordDemand(CELL, RIDE, NOW);

    expect(redis.zadd).toHaveBeenCalledWith(`surge:demand:r8:${CELL}`, NOW, RIDE);
    expect(redis.pexpire).toHaveBeenCalledWith(`surge:demand:r8:${CELL}`, 600_000);
  });

  it("logs and swallows Redis errors without throwing", async () => {
    const { service, redis, logger } = createService();
    (redis.zadd as jest.Mock).mockRejectedValue(new Error("redis down"));

    await expect(service.recordDemand(CELL, RIDE, NOW)).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "pricing.surge.record_demand_failed" }),
      "SurgeService"
    );
  });
});

describe("SurgeService.getMultiplier", () => {
  it("returns multiplier=1 when demand=0", async () => {
    const { service } = createService();

    const result = await service.getMultiplier(CELL, NOW);

    expect(result).toMatchObject({ demand: 0, supply: 0, multiplier: 1 });
  });

  it("prunes old demand entries with the right cutoff", async () => {
    const { service, redis } = createService();

    await service.getMultiplier(CELL, NOW);

    expect(redis.zremrangebyscore).toHaveBeenCalledWith(
      `surge:demand:r8:${CELL}`,
      0,
      `(${NOW - 300_000}`
    );
  });

  it("computes multiplier when demand exceeds threshold", async () => {
    const { service, redis, geoFacade } = createService();
    (redis.zcard as jest.Mock).mockResolvedValue(10);
    (geoFacade.getOnlineDriverCount as jest.Mock).mockResolvedValue(2);

    const result = await service.getMultiplier(CELL, NOW);

    // ratio=5, threshold=1, coeff=0.5 → 1 + (5-1)*0.5 = 3 = cap
    expect(result.multiplier).toBe(3);
    expect(result.ratio).toBe(5);
  });

  it("caps the multiplier at the configured maximum", async () => {
    const { service, redis, geoFacade } = createService({ PRICING_SURGE_CAP: 2.5 });
    (redis.zcard as jest.Mock).mockResolvedValue(100);
    (geoFacade.getOnlineDriverCount as jest.Mock).mockResolvedValue(1);

    const result = await service.getMultiplier(CELL, NOW);

    expect(result.multiplier).toBe(2.5);
  });

  it("treats supply=0 as supply=1 to avoid divide-by-zero", async () => {
    const { service, redis, geoFacade } = createService();
    (redis.zcard as jest.Mock).mockResolvedValue(3);
    (geoFacade.getOnlineDriverCount as jest.Mock).mockResolvedValue(0);

    const result = await service.getMultiplier(CELL, NOW);

    expect(result.ratio).toBe(3);
    expect(result.multiplier).toBeGreaterThan(1);
  });

  it("returns safe defaults when Redis throws", async () => {
    const { service, redis, logger } = createService();
    (redis.zremrangebyscore as jest.Mock).mockRejectedValue(new Error("redis down"));

    const result = await service.getMultiplier(CELL, NOW);

    expect(result).toEqual({ cellR8: CELL, demand: 0, supply: 0, ratio: 0, multiplier: 1 });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "pricing.surge.signal_read_failed" }),
      "SurgeService"
    );
  });
});
