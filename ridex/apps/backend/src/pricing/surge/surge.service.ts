import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type Redis from "ioredis";

import { StructuredLogger } from "../../common/logging/structured-logger";
import type { EnvironmentVariables } from "../../config/env.validation";
import { GeoFacade } from "../../geo/geo.facade";
import { REDIS_CLIENT } from "../../infra/redis/redis.tokens";
import type { SurgeContext } from "../pricing.types";
import { demandKey } from "./surge-redis-keys";

const CONTEXT = "SurgeService";

@Injectable()
export class SurgeService {
  private readonly windowMs: number;
  private readonly threshold: number;
  private readonly coefficient: number;
  private readonly cap: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly geoFacade: GeoFacade,
    private readonly logger: StructuredLogger,
    configService: ConfigService<EnvironmentVariables, true>
  ) {
    this.windowMs =
      configService.get("PRICING_DEMAND_WINDOW_SECONDS", { infer: true }) * 1000;
    this.threshold = configService.get("PRICING_SURGE_RATIO_THRESHOLD", { infer: true });
    this.coefficient = configService.get("PRICING_SURGE_COEFFICIENT", { infer: true });
    this.cap = configService.get("PRICING_SURGE_CAP", { infer: true });
  }

  async recordDemand(cellR8: string, demandId: string, nowMs: number = Date.now()): Promise<void> {
    try {
      const key = demandKey(cellR8);
      await this.redis.zadd(key, nowMs, demandId);
      await this.redis.pexpire(key, this.windowMs * 2);
    } catch (error: unknown) {
      this.logger.warn(
        {
          event: "pricing.surge.record_demand_failed",
          cellR8,
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        CONTEXT
      );
    }
  }

  async getMultiplier(cellR8: string, nowMs: number = Date.now()): Promise<SurgeContext> {
    const cutoff = nowMs - this.windowMs;
    let demand = 0;
    let supply = 0;

    try {
      const key = demandKey(cellR8);
      await this.redis.zremrangebyscore(key, 0, `(${cutoff}`);
      demand = await this.redis.zcard(key);
      supply = await this.geoFacade.getOnlineDriverCount(cellR8, 8);
    } catch (error: unknown) {
      this.logger.warn(
        {
          event: "pricing.surge.signal_read_failed",
          cellR8,
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        CONTEXT
      );
      return { cellR8, demand: 0, supply: 0, ratio: 0, multiplier: 1 };
    }

    const effectiveSupply = Math.max(supply, 1);
    const ratio = demand / effectiveSupply;
    const raw = ratio > this.threshold
      ? 1 + (ratio - this.threshold) * this.coefficient
      : 1;
    const multiplier = Math.min(Math.max(raw, 1), this.cap);

    return {
      cellR8,
      demand,
      supply,
      ratio,
      multiplier: Math.round(multiplier * 1000) / 1000
    };
  }
}
