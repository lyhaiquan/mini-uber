import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";

import { StructuredLogger } from "../../common/logging/structured-logger";
import type { EnvironmentVariables } from "../../config/env.validation";
import { H3RedisIndexService } from "../redis/h3-redis-index.service";

const CONTEXT = "StaleDriverSweeperService";
export const SWEEPER_INTERVAL_NAME = "geo.h3.stale-sweep";

@Injectable()
export class StaleDriverSweeperService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly intervalMs: number;
  private running = false;

  constructor(
    private readonly indexService: H3RedisIndexService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly logger: StructuredLogger,
    configService: ConfigService<EnvironmentVariables, true>
  ) {
    this.intervalMs =
      configService.get("H3_STALE_SWEEP_INTERVAL_SECONDS", { infer: true }) * 1000;
  }

  onApplicationBootstrap(): void {
    if (this.schedulerRegistry.doesExist("interval", SWEEPER_INTERVAL_NAME)) {
      return;
    }
    const handle = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
    this.schedulerRegistry.addInterval(SWEEPER_INTERVAL_NAME, handle);
  }

  onApplicationShutdown(): void {
    if (this.schedulerRegistry.doesExist("interval", SWEEPER_INTERVAL_NAME)) {
      this.schedulerRegistry.deleteInterval(SWEEPER_INTERVAL_NAME);
    }
  }

  async tick(): Promise<void> {
    if (this.running) {
      // Re-entrancy guard: skip overlapping tick to prevent pile-up.
      return;
    }
    this.running = true;
    const startedAt = Date.now();
    try {
      const evicted = await this.indexService.sweepStale(Date.now());
      const durationMs = Date.now() - startedAt;
      this.logger.log(
        { event: "geo.h3.sweep", evicted, durationMs },
        CONTEXT
      );
    } catch (error: unknown) {
      this.logger.error(
        {
          event: "geo.h3.sweep.failed",
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        error instanceof Error ? error.stack : undefined,
        CONTEXT
      );
    } finally {
      this.running = false;
    }
  }
}
