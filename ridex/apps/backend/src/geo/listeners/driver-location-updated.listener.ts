import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { StructuredLogger } from "../../common/logging/structured-logger";
import type { DomainEvent } from "../../common/domain-event";
import { DRIVER_LOCATION_UPDATED_EVENT } from "../../common/events/event-types";
import { H3RedisIndexService } from "../redis/h3-redis-index.service";

const CONTEXT = "DriverLocationUpdatedGeoListener";

interface DriverLocationUpdatedPayload {
  driverId: string;
  lat: number;
  lng: number;
  recordedAt: string;
  receivedAt: string;
}

@Injectable()
export class DriverLocationUpdatedGeoListener {
  constructor(
    private readonly indexService: H3RedisIndexService,
    private readonly logger: StructuredLogger
  ) {}

  @OnEvent(DRIVER_LOCATION_UPDATED_EVENT)
  async handle(event: DomainEvent<DriverLocationUpdatedPayload>): Promise<void> {
    const { driverId, lat, lng, receivedAt } = event.payload;

    if (typeof driverId !== "string" || driverId.length === 0) {
      this.logger.warn({ event: "geo.h3.listener.invalid_driver_id" }, CONTEXT);
      return;
    }

    const lastSeenAtMs = Date.parse(receivedAt);
    if (Number.isNaN(lastSeenAtMs)) {
      this.logger.warn(
        { event: "geo.h3.listener.invalid_received_at", driverId },
        CONTEXT
      );
      return;
    }

    try {
      await this.indexService.indexDriver(driverId, lat, lng, lastSeenAtMs);
    } catch (error: unknown) {
      this.logger.error(
        {
          event: "geo.h3.listener.index_failed",
          driverId,
          errorName: error instanceof Error ? error.name : "UnknownError"
        },
        error instanceof Error ? error.stack : undefined,
        CONTEXT
      );
    }
  }
}
