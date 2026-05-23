import type { StructuredLogger } from "../../common/logging/structured-logger";
import type { H3RedisIndexService } from "../redis/h3-redis-index.service";
import { DriverWentOfflineGeoListener } from "./driver-went-offline.listener";

const DRIVER_ID = "33333333-3333-3333-3333-333333333333";

function createListener(): {
  listener: DriverWentOfflineGeoListener;
  indexService: jest.Mocked<H3RedisIndexService>;
  logger: jest.Mocked<StructuredLogger>;
} {
  const indexService = {
    removeDriver: jest.fn().mockResolvedValue(undefined)
  } as unknown as jest.Mocked<H3RedisIndexService>;
  const logger = {
    warn: jest.fn(),
    error: jest.fn()
  } as unknown as jest.Mocked<StructuredLogger>;
  return {
    listener: new DriverWentOfflineGeoListener(indexService, logger),
    indexService,
    logger
  };
}

function makeEvent(aggregateId: string = DRIVER_ID): {
  eventId: string;
  eventType: string;
  aggregateType: "driver";
  aggregateId: string;
  payload: { driverId: string; offlineAt: string };
  correlationId: string;
  occurredAt: string;
  emittedBy: "drivers" | "location";
} {
  return {
    eventId: "evt-2",
    eventType: "driver.went-offline",
    aggregateType: "driver",
    aggregateId,
    payload: { driverId: aggregateId, offlineAt: "2026-05-16T00:01:00.000Z" },
    correlationId: "corr-2",
    occurredAt: "2026-05-16T00:01:00.500Z",
    emittedBy: "drivers"
  };
}

describe("DriverWentOfflineGeoListener", () => {
  it("calls removeDriver with the event aggregateId", async () => {
    const { listener, indexService } = createListener();

    await listener.handle(makeEvent());

    expect(indexService.removeDriver).toHaveBeenCalledWith(DRIVER_ID);
  });

  it("warns and skips when aggregateId is empty", async () => {
    const { listener, indexService, logger } = createListener();

    await listener.handle(makeEvent(""));

    expect(indexService.removeDriver).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it("logs error and does not throw when removeDriver throws", async () => {
    const { listener, indexService, logger } = createListener();
    indexService.removeDriver.mockRejectedValue(new Error("redis down"));

    await expect(listener.handle(makeEvent())).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "geo.h3.listener.remove_failed", driverId: DRIVER_ID }),
      expect.any(String),
      "DriverWentOfflineGeoListener"
    );
  });
});
