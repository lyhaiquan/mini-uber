import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type Redis from "ioredis";

import { StructuredLogger } from "../../common/logging/structured-logger";
import type { EnvironmentVariables } from "../../config/env.validation";
import { REDIS_CLIENT } from "../../infra/redis/redis.tokens";
import { H3Service } from "../h3.service";
import { cellKey, companionKey, lastSeenZsetKey } from "./h3-redis-keys";

const CONTEXT = "H3RedisIndexService";
const REMOVE_STALE_DRIVER_SCRIPT = `
local score = redis.call("ZSCORE", KEYS[1], ARGV[1])
if not score then
  return 0
end
if tonumber(score) >= tonumber(ARGV[2]) then
  return 0
end

local cells = redis.call("HMGET", KEYS[2], "r8", "r9")
if cells[1] then
  redis.call("SREM", ARGV[3] .. cells[1], ARGV[1])
end
if cells[2] then
  redis.call("SREM", ARGV[4] .. cells[2], ARGV[1])
end
redis.call("DEL", KEYS[2])
redis.call("ZREM", KEYS[1], ARGV[1])
return 1
`;

@Injectable()
export class H3RedisIndexService {
  private readonly locationTtlMs: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly h3: H3Service,
    private readonly logger: StructuredLogger,
    configService: ConfigService<EnvironmentVariables, true>
  ) {
    this.locationTtlMs = configService.get("DRIVER_LOCATION_TTL_SECONDS", { infer: true }) * 1000;
  }

  async indexDriver(
    driverId: string,
    lat: number,
    lng: number,
    lastSeenAtMs: number
  ): Promise<void> {
    let cells: { r8: string; r9: string };
    try {
      cells = this.h3.latLngToBothCells(lat, lng);
    } catch (error: unknown) {
      this.logger.warn(
        {
          event: "geo.h3.index.invalid_coord",
          driverId,
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        CONTEXT
      );
      return;
    }

    const companion = companionKey(driverId);
    const prev = await this.redis.hmget(companion, "r8", "r9");
    const prevR8 = prev[0];
    const prevR9 = prev[1];
    const r8Changed = prevR8 !== cells.r8;
    const r9Changed = prevR9 !== cells.r9;

    const pipeline = this.redis.multi();
    if (prevR8 !== null && r8Changed) {
      pipeline.srem(cellKey(8, prevR8), driverId);
    }
    if (prevR9 !== null && r9Changed) {
      pipeline.srem(cellKey(9, prevR9), driverId);
    }
    if (r8Changed) {
      pipeline.sadd(cellKey(8, cells.r8), driverId);
    }
    if (r9Changed) {
      pipeline.sadd(cellKey(9, cells.r9), driverId);
    }
    if (r8Changed || r9Changed) {
      pipeline.hset(companion, { r8: cells.r8, r9: cells.r9 });
    }
    pipeline.zadd(lastSeenZsetKey(), lastSeenAtMs, driverId);
    await pipeline.exec();
  }

  async removeDriver(driverId: string): Promise<void> {
    const companion = companionKey(driverId);
    const cells = await this.redis.hmget(companion, "r8", "r9");
    const r8 = cells[0];
    const r9 = cells[1];

    const pipeline = this.redis.multi();
    if (r8 !== null) {
      pipeline.srem(cellKey(8, r8), driverId);
    }
    if (r9 !== null) {
      pipeline.srem(cellKey(9, r9), driverId);
    }
    pipeline.del(companion);
    pipeline.zrem(lastSeenZsetKey(), driverId);
    await pipeline.exec();
  }

  async findNearbyDrivers(lat: number, lng: number, maxRing: number): Promise<string[]> {
    let cells: { r8: string; r9: string };
    try {
      cells = this.h3.latLngToBothCells(lat, lng);
    } catch (error: unknown) {
      this.logger.warn(
        {
          event: "geo.h3.discover.invalid_coord",
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        CONTEXT
      );
      return [];
    }

    const r8Cells = this.h3.gridDisk(cells.r8, maxRing);
    const r9Cells = this.h3.gridDisk(cells.r9, maxRing);

    const r8Keys = r8Cells.map((cellId) => cellKey(8, cellId));
    const r9Keys = r9Cells.map((cellId) => cellKey(9, cellId));

    const pipeline = this.redis.multi();
    pipeline.sunion(...r8Keys);
    pipeline.sunion(...r9Keys);
    const results = await pipeline.exec();

    const merged = new Set<string>();
    if (results !== null) {
      for (const entry of results) {
        const [err, value] = entry;
        if (err !== null) {
          continue;
        }
        if (Array.isArray(value)) {
          for (const id of value as string[]) {
            merged.add(id);
          }
        }
      }
    }
    return Array.from(merged);
  }

  async getOnlineDriverCount(cellId: string, resolution: 8 | 9): Promise<number> {
    return this.redis.scard(cellKey(resolution, cellId));
  }

  async sweepStale(nowMs: number): Promise<number> {
    const threshold = nowMs - this.locationTtlMs;
    const staleIds = await this.redis.zrangebyscore(lastSeenZsetKey(), 0, `(${threshold}`);

    let evicted = 0;
    for (const driverId of staleIds) {
      if (await this.removeDriverIfStillStale(driverId, threshold)) {
        evicted += 1;
      }
    }

    return evicted;
  }

  private async removeDriverIfStillStale(driverId: string, threshold: number): Promise<boolean> {
    const removed = await this.redis.eval(
      REMOVE_STALE_DRIVER_SCRIPT,
      2,
      lastSeenZsetKey(),
      companionKey(driverId),
      driverId,
      String(threshold),
      "h3:drivers:r8:",
      "h3:drivers:r9:"
    );

    return Number(removed) === 1;
  }
}
