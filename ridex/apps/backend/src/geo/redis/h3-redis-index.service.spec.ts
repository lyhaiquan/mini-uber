import type { ConfigService } from "@nestjs/config";
import type Redis from "ioredis";

import type { StructuredLogger } from "../../common/logging/structured-logger";
import type { EnvironmentVariables } from "../../config/env.validation";
import { H3Service } from "../h3.service";
import { H3RedisIndexService } from "./h3-redis-index.service";

const DRIVER_ID = "33333333-3333-3333-3333-333333333333";
const OTHER_DRIVER_ID = "44444444-4444-4444-4444-444444444444";
const HCMC_LAT = 10.7769;
const HCMC_LNG = 106.7009;
const LOCATION_TTL_SECONDS = 60;

type PipelineCall = { method: string; args: unknown[] };

interface MockPipeline {
  calls: PipelineCall[];
  results: Array<[Error | null, unknown]>;
  srem(...args: unknown[]): MockPipeline;
  sadd(...args: unknown[]): MockPipeline;
  hset(...args: unknown[]): MockPipeline;
  zadd(...args: unknown[]): MockPipeline;
  zrem(...args: unknown[]): MockPipeline;
  del(...args: unknown[]): MockPipeline;
  sunion(...args: unknown[]): MockPipeline;
  exec(): Promise<Array<[Error | null, unknown]>>;
}

function makePipeline(execResults: Array<[Error | null, unknown]> = []): MockPipeline {
  const pipeline: MockPipeline = {
    calls: [],
    results: execResults,
    srem(...args) {
      this.calls.push({ method: "srem", args });
      return this;
    },
    sadd(...args) {
      this.calls.push({ method: "sadd", args });
      return this;
    },
    hset(...args) {
      this.calls.push({ method: "hset", args });
      return this;
    },
    zadd(...args) {
      this.calls.push({ method: "zadd", args });
      return this;
    },
    zrem(...args) {
      this.calls.push({ method: "zrem", args });
      return this;
    },
    del(...args) {
      this.calls.push({ method: "del", args });
      return this;
    },
    sunion(...args) {
      this.calls.push({ method: "sunion", args });
      return this;
    },
    async exec() {
      if (this.results.length === 0) {
        return this.calls.map(() => [null, "OK"]);
      }
      return this.results;
    }
  };
  return pipeline;
}

function createService(redisOverrides: Partial<jest.Mocked<Redis>> = {}): {
  service: H3RedisIndexService;
  redis: jest.Mocked<Redis>;
  pipelines: MockPipeline[];
  logger: jest.Mocked<StructuredLogger>;
} {
  const pipelines: MockPipeline[] = [];
  const redis = {
    hmget: jest.fn().mockResolvedValue([null, null]),
    zrangebyscore: jest.fn().mockResolvedValue([]),
    zscore: jest.fn().mockResolvedValue(null),
    eval: jest.fn().mockResolvedValue(0),
    multi: jest.fn(() => {
      const p = makePipeline();
      pipelines.push(p);
      return p;
    }),
    ...redisOverrides
  } as unknown as jest.Mocked<Redis>;

  const logger = {
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn()
  } as unknown as jest.Mocked<StructuredLogger>;

  const configService = {
    get: jest.fn().mockReturnValue(LOCATION_TTL_SECONDS)
  } as unknown as ConfigService<EnvironmentVariables, true>;

  const service = new H3RedisIndexService(redis, new H3Service(), logger, configService);
  return { service, redis, pipelines, logger };
}

describe("H3RedisIndexService.indexDriver", () => {
  it("first index: SADD only, HSET companion, ZADD last-seen", async () => {
    const { service, redis, pipelines } = createService();
    redis.hmget.mockResolvedValue([null, null]);

    await service.indexDriver(DRIVER_ID, HCMC_LAT, HCMC_LNG, 1_700_000_000_000);

    expect(pipelines).toHaveLength(1);
    const calls = pipelines[0].calls;
    expect(calls.map((c) => c.method)).toEqual(["sadd", "sadd", "hset", "zadd"]);
    expect(calls.at(-1)?.args).toEqual([
      "h3:drivers:last-seen",
      1_700_000_000_000,
      DRIVER_ID
    ]);
  });

  it("same-cell update: only refreshes ZADD last-seen", async () => {
    const { service, redis, pipelines } = createService();
    const cells = new H3Service().latLngToBothCells(HCMC_LAT, HCMC_LNG);
    redis.hmget.mockResolvedValue([cells.r8, cells.r9]);

    await service.indexDriver(DRIVER_ID, HCMC_LAT, HCMC_LNG, 1_700_000_001_000);

    expect(pipelines[0].calls.map((c) => c.method)).toEqual(["zadd"]);
  });

  it("cell change: SREM old then SADD new for both resolutions", async () => {
    const { service, redis, pipelines } = createService();
    redis.hmget.mockResolvedValue(["8928308280fffff", "8a2830828087fff"]);

    await service.indexDriver(DRIVER_ID, HCMC_LAT, HCMC_LNG, 1_700_000_002_000);

    const calls = pipelines[0].calls;
    expect(calls.map((c) => c.method)).toEqual([
      "srem",
      "srem",
      "sadd",
      "sadd",
      "hset",
      "zadd"
    ]);
    expect(calls[0].args).toEqual(["h3:drivers:r8:8928308280fffff", DRIVER_ID]);
    expect(calls[1].args).toEqual(["h3:drivers:r9:8a2830828087fff", DRIVER_ID]);
  });

  it("skips indexing on invalid coordinate and logs warn", async () => {
    const { service, pipelines, logger } = createService();

    await service.indexDriver(DRIVER_ID, 91, 0, 1_700_000_000_000);

    expect(pipelines).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "geo.h3.index.invalid_coord", driverId: DRIVER_ID }),
      "H3RedisIndexService"
    );
  });
});

describe("H3RedisIndexService.removeDriver", () => {
  it("removes from both cells, DEL companion, ZREM last-seen", async () => {
    const { service, redis, pipelines } = createService();
    redis.hmget.mockResolvedValue(["8928308280fffff", "8a2830828087fff"]);

    await service.removeDriver(DRIVER_ID);

    const calls = pipelines[0].calls;
    expect(calls.map((c) => c.method)).toEqual(["srem", "srem", "del", "zrem"]);
    expect(calls[2].args).toEqual(["h3:driver:cells:" + DRIVER_ID]);
    expect(calls[3].args).toEqual(["h3:drivers:last-seen", DRIVER_ID]);
  });

  it("with no companion: only DEL + ZREM, no SREM", async () => {
    const { service, redis, pipelines } = createService();
    redis.hmget.mockResolvedValue([null, null]);

    await service.removeDriver(DRIVER_ID);

    expect(pipelines[0].calls.map((c) => c.method)).toEqual(["del", "zrem"]);
  });
});

describe("H3RedisIndexService.findNearbyDrivers", () => {
  it("queries both resolutions and dedups across them", async () => {
    const { service, redis, pipelines } = createService();
    redis.multi = jest.fn(() => {
      const p = makePipeline([
        [null, ["driver-A", "driver-B"]],
        [null, ["driver-B", "driver-C"]]
      ]);
      pipelines.push(p);
      return p;
    }) as unknown as typeof redis.multi;

    const result = await service.findNearbyDrivers(HCMC_LAT, HCMC_LNG, 0);

    expect(new Set(result)).toEqual(new Set(["driver-A", "driver-B", "driver-C"]));
  });

  it("returns [] when both SUNIONs are empty", async () => {
    const { service, redis, pipelines } = createService();
    redis.multi = jest.fn(() => {
      const p = makePipeline([
        [null, []],
        [null, []]
      ]);
      pipelines.push(p);
      return p;
    }) as unknown as typeof redis.multi;

    const result = await service.findNearbyDrivers(HCMC_LAT, HCMC_LNG, 1);

    expect(result).toEqual([]);
  });

  it("issues one SUNION per resolution with gridDisk(k=2) = 19 keys", async () => {
    const { service, pipelines } = createService();

    await service.findNearbyDrivers(HCMC_LAT, HCMC_LNG, 2);

    const calls = pipelines[0].calls;
    expect(calls).toHaveLength(2);
    expect(calls[0].method).toBe("sunion");
    expect(calls[0].args).toHaveLength(19);
    expect(calls[1].method).toBe("sunion");
    expect(calls[1].args).toHaveLength(19);
  });

  it("returns [] and logs warn on invalid coordinates", async () => {
    const { service, logger } = createService();

    const result = await service.findNearbyDrivers(91, 0, 1);

    expect(result).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "geo.h3.discover.invalid_coord" }),
      "H3RedisIndexService"
    );
  });
});

describe("H3RedisIndexService.sweepStale", () => {
  it("evicts each stale driver returned by ZRANGEBYSCORE", async () => {
    const now = 1_700_000_060_000;
    const threshold = now - LOCATION_TTL_SECONDS * 1000;
    const { service, redis } = createService();
    redis.zrangebyscore = jest.fn().mockResolvedValue([DRIVER_ID, OTHER_DRIVER_ID]) as never;
    redis.eval = jest.fn().mockResolvedValue(1) as never;

    const evicted = await service.sweepStale(now);

    expect(evicted).toBe(2);
    expect(redis.zrangebyscore).toHaveBeenCalledWith("h3:drivers:last-seen", 0, `(${threshold}`);
    expect(redis.eval).toHaveBeenCalledTimes(2);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("ZSCORE"),
      2,
      "h3:drivers:last-seen",
      "h3:driver:cells:" + DRIVER_ID,
      DRIVER_ID,
      String(threshold),
      "h3:drivers:r8:",
      "h3:drivers:r9:"
    );
  });

  it("skips drivers whose score refreshed during the atomic stale remove", async () => {
    const { service, redis } = createService();
    redis.zrangebyscore = jest.fn().mockResolvedValue([DRIVER_ID]) as never;
    redis.eval = jest.fn().mockResolvedValue(0) as never;

    const evicted = await service.sweepStale(1_700_000_060_000);

    expect(evicted).toBe(0);
    expect(redis.eval).toHaveBeenCalledTimes(1);
  });

  it("skips drivers whose score is null (already evicted)", async () => {
    const { service, redis } = createService();
    redis.zrangebyscore = jest.fn().mockResolvedValue([DRIVER_ID]) as never;
    redis.eval = jest.fn().mockResolvedValue(0) as never;

    const evicted = await service.sweepStale(1_700_000_060_000);

    expect(evicted).toBe(0);
  });

  it("returns 0 when nothing is stale", async () => {
    const { service, redis } = createService();
    redis.zrangebyscore = jest.fn().mockResolvedValue([]) as never;

    const evicted = await service.sweepStale(1_700_000_060_000);

    expect(evicted).toBe(0);
    expect(redis.eval).not.toHaveBeenCalled();
  });
});
