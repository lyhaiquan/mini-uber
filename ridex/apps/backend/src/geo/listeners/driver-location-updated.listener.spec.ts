import type { StructuredLogger } from "../../common/logging/structured-logger";
import type { H3RedisIndexService } from "../redis/h3-redis-index.service";
import { DriverLocationUpdatedGeoListener } from "./driver-location-updated.listener";

const DRIVER_ID = "33333333-3333-3333-3333-333333333333";

function createListener(): {
  listener: DriverLocationUpdatedGeoListener;
  indexService: jest.Mocked<H3RedisIndexService>;
  logger: jest.Mocked<StructuredLogger>;
} {
  const indexService = {
    indexDriver: jest.fn().mockResolvedValue(undefined)
  } as unknown as jest.Mocked<H3RedisIndexService>;
  const logger = {
    warn: jest.fn(),
    error: jest.fn()
  } as unknown as jest.Mocked<StructuredLogger>;
  return {
    listener: new DriverLocationUpdatedGeoListener(indexService, logger),
    indexService,
    logger
  };
}

function makeEvent(
  overrides: Partial<{ driverId: string; lat: number; lng: number; receivedAt: string }> = {}
): {
  eventId: string;
  eventType: string;
  aggregateType: "driver";
  aggregateId: string;
  payload: {
    driverId: string;
    lat: number;
    lng: number;
    recordedAt: string;
    receivedAt: string;
  };
  correlationId: string;
  occurredAt: string;
  emittedBy: "drivers" | "location";
} {
  return {
    eventId: "evt-1",
    eventType: "driver.location-updated",
    aggregateType: "driver",
    aggregateId: overrides.driverId ?? DRIVER_ID,
    payload: {
      driverId: overrides.driverId ?? DRIVER_ID,
      lat: overrides.lat ?? 10.7769,
      lng: overrides.lng ?? 106.7009,
      recordedAt: "2026-05-16T00:00:00.000Z",
      receivedAt: overrides.receivedAt ?? "2026-05-16T00:00:01.000Z"
    },
    correlationId: "corr-1",
    occurredAt: "2026-05-16T00:00:01.500Z",
    emittedBy: "location"
  };
}

describe("DriverLocationUpdatedGeoListener", () => {
  it("calls indexDriver with parsed receivedAt", async () => {
    const { listener, indexService } = createListener();

    await listener.handle(makeEvent());

    expect(indexService.indexDriver).toHaveBeenCalledWith(
      DRIVER_ID,
      10.7769,
      106.7009,
      Date.parse("2026-05-16T00:00:01.000Z")
    );
  });

  it("warns and skips when receivedAt is malformed", async () => {
    const { listener, indexService, logger } = createListener();

    await listener.handle(makeEvent({ receivedAt: "not-a-date" }));

    expect(indexService.indexDriver).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "geo.h3.listener.invalid_received_at", driverId: DRIVER_ID }),
      "DriverLocationUpdatedGeoListener"
    );
  });

  it("warns and skips when driverId is empty", async () => {
    const { listener, indexService, logger } = createListener();

    await listener.handle(makeEvent({ driverId: "" }));

    expect(indexService.indexDriver).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: "geo.h3.listener.invalid_driver_id" }),
      "DriverLocationUpdatedGeoListener"
    );
  });

  it("logs error and does not throw when indexDriver throws", async () => {
    const { listener, indexService, logger } = createListener();
    indexService.indexDriver.mockRejectedValue(new Error("redis down"));

    await expect(listener.handle(makeEvent())).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "geo.h3.listener.index_failed", driverId: DRIVER_ID }),
      expect.any(String),
      "DriverLocationUpdatedGeoListener"
    );
  });
});
