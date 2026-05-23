import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { StructuredLogger } from "../../common/logging/structured-logger";
import type { DomainEvent } from "../../common/domain-event";
import { DRIVER_WENT_OFFLINE_EVENT } from "../../common/events/event-types";
import { H3RedisIndexService } from "../redis/h3-redis-index.service";

const CONTEXT = "DriverWentOfflineGeoListener";

interface DriverWentOfflinePayload {
  driverId: string;
  offlineAt: string;
}

@Injectable()
export class DriverWentOfflineGeoListener {
  constructor(
    private readonly indexService: H3RedisIndexService,
    private readonly logger: StructuredLogger
  ) {}

  @OnEvent(DRIVER_WENT_OFFLINE_EVENT)
  async handle(event: DomainEvent<DriverWentOfflinePayload>): Promise<void> {
    const driverId = event.aggregateId;
    if (typeof driverId !== "string" || driverId.length === 0) {
      this.logger.warn({ event: "geo.h3.listener.invalid_driver_id" }, CONTEXT);
      return;
    }

    try {
      await this.indexService.removeDriver(driverId);
    } catch (error: unknown) {
      this.logger.error(
        {
          event: "geo.h3.listener.remove_failed",
          driverId,
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        error instanceof Error ? error.stack : undefined,
        CONTEXT
      );
    }
  }
}
