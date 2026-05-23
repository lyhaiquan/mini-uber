import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OnEvent } from "@nestjs/event-emitter";
import type Redis from "ioredis";

import { StructuredLogger } from "../../common/logging/structured-logger";
import type { EnvironmentVariables } from "../../config/env.validation";
import {
  DRIVER_WENT_OFFLINE_EVENT,
  type DriverWentOfflineDomainEvent
} from "../../drivers/events/driver-events";
import { REDIS_CLIENT } from "../../infra/redis/redis.tokens";
import type { CachedLocation } from "./cached-location.types";

const CONTEXT = "DriverLocationCacheService";

@Injectable()
export class DriverLocationCacheService {
  private readonly ttlSeconds: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly logger: StructuredLogger,
    configService: ConfigService<EnvironmentVariables, true>
  ) {
    this.ttlSeconds = configService.get("DRIVER_LOCATION_TTL_SECONDS", { infer: true });
  }

  async set(driverId: string, location: CachedLocation): Promise<void> {
    await this.redis.set(this.key(driverId), JSON.stringify(location), "EX", this.ttlSeconds);
  }

  async get(driverId: string): Promise<CachedLocation | null> {
    const rawValue = await this.redis.get(this.key(driverId));

    if (rawValue === null) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawValue);
      if (this.isCachedLocation(parsed)) {
        return parsed;
      }

      this.logMalformedValue(driverId);
      return null;
    } catch {
      this.logMalformedValue(driverId);
      return null;
    }
  }

  async clear(driverId: string): Promise<void> {
    await this.redis.del(this.key(driverId));
  }

  @OnEvent(DRIVER_WENT_OFFLINE_EVENT)
  async handleDriverWentOffline(event: DriverWentOfflineDomainEvent): Promise<void> {
    try {
      await this.clear(event.aggregateId);
    } catch (error: unknown) {
      this.logger.error(
        {
          event: "driver.location.cache.clear_failed",
          driverId: event.aggregateId,
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        error instanceof Error ? error.stack : undefined,
        CONTEXT
      );
    }
  }

  key(driverId: string): string {
    return `driver:location:${driverId}`;
  }

  private isCachedLocation(value: unknown): value is CachedLocation {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return false;
    }

    const maybe = value as Partial<CachedLocation>;
    return (
      typeof maybe.lat === "number" &&
      typeof maybe.lng === "number" &&
      typeof maybe.recordedAt === "string" &&
      typeof maybe.receivedAt === "string"
    );
  }

  private logMalformedValue(driverId: string): void {
    this.logger.warn(
      {
        event: "driver.location.cache.malformed",
        driverId
      },
      CONTEXT
    );
  }
}
