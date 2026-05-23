import type { EventEmitter2 } from "@nestjs/event-emitter";
import type { Repository } from "typeorm";

import { Role } from "../users/dto/role.enum";
import type { UsersFacade } from "../users/users.facade";
import type { Driver } from "./entities/driver.entity";
import { DRIVER_WENT_OFFLINE_EVENT, DRIVER_WENT_ONLINE_EVENT } from "./events/driver-events";
import { DriversService } from "./drivers.service";

const DRIVER_ID = "33333333-3333-3333-3333-333333333333";
const CORRELATION_ID = "request-1";

function makeDriver(overrides: Partial<Driver> = {}): Driver {
  const now = new Date("2026-05-16T00:00:00.000Z");
  return {
    driverId: DRIVER_ID,
    isOnline: false,
    onlineSince: null,
    lastSeenAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function createSetup(existing: Driver | null = null): {
  service: DriversService;
  repository: jest.Mocked<Repository<Driver>>;
  usersFacade: jest.Mocked<UsersFacade>;
  eventEmitter: jest.Mocked<EventEmitter2>;
} {
  const repository = {
    findOne: jest.fn().mockResolvedValue(existing),
    query: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue({ affected: 1 })
  } as unknown as jest.Mocked<Repository<Driver>>;
  const usersFacade = {
    existsWithRole: jest.fn().mockResolvedValue(true)
  } as unknown as jest.Mocked<UsersFacade>;
  const eventEmitter = {
    emit: jest.fn()
  } as unknown as jest.Mocked<EventEmitter2>;
  const service = new DriversService(repository, usersFacade, eventEmitter);
  return { service, repository, usersFacade, eventEmitter };
}

describe("DriversService", () => {
  describe("setOnline", () => {
    it("validates that the user is a DRIVER and upserts the row", async () => {
      const { service, repository, usersFacade } = createSetup(null);

      await service.setOnline(DRIVER_ID, CORRELATION_ID);

      expect(usersFacade.existsWithRole).toHaveBeenCalledWith(DRIVER_ID, Role.DRIVER);
      expect(repository.query).toHaveBeenCalledWith(expect.stringContaining("ON CONFLICT"), [
        DRIVER_ID,
        expect.any(Date)
      ]);
    });

    it("emits driver.went-online only when transitioning from offline to online", async () => {
      const { service, eventEmitter } = createSetup(makeDriver({ isOnline: false }));

      await service.setOnline(DRIVER_ID, CORRELATION_ID);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DRIVER_WENT_ONLINE_EVENT,
        expect.objectContaining({
          eventType: DRIVER_WENT_ONLINE_EVENT,
          aggregateId: DRIVER_ID,
          correlationId: CORRELATION_ID,
          emittedBy: "drivers",
          payload: expect.objectContaining({ driverId: DRIVER_ID })
        })
      );
    });

    it("does not re-emit online event when already online", async () => {
      const { service, eventEmitter } = createSetup(
        makeDriver({ isOnline: true, onlineSince: new Date("2026-05-16T00:00:00.000Z") })
      );

      await service.setOnline(DRIVER_ID, CORRELATION_ID);

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it("throws DRIVER_NOT_ELIGIBLE for non-driver users", async () => {
      const { service, usersFacade } = createSetup(null);
      usersFacade.existsWithRole.mockResolvedValue(false);

      await expect(service.setOnline(DRIVER_ID, CORRELATION_ID)).rejects.toMatchObject({
        response: expect.objectContaining({ code: "DRIVER_NOT_ELIGIBLE" })
      });
    });
  });

  describe("setOffline", () => {
    it("sets offline and emits driver.went-offline only from online state", async () => {
      const { service, repository, eventEmitter } = createSetup(makeDriver({ isOnline: true }));

      await service.setOffline(DRIVER_ID, CORRELATION_ID);

      expect(repository.update).toHaveBeenCalledWith(DRIVER_ID, {
        isOnline: false,
        onlineSince: null,
        lastSeenAt: expect.any(Date)
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        DRIVER_WENT_OFFLINE_EVENT,
        expect.objectContaining({
          eventType: DRIVER_WENT_OFFLINE_EVENT,
          aggregateId: DRIVER_ID,
          correlationId: CORRELATION_ID,
          emittedBy: "drivers"
        })
      );
    });

    it("is a no-op when the driver row is missing or already offline", async () => {
      const { service, repository, eventEmitter } = createSetup(null);

      await service.setOffline(DRIVER_ID, CORRELATION_ID);

      expect(repository.update).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  it("isOnline returns the persisted online state", async () => {
    const { service } = createSetup(makeDriver({ isOnline: true }));

    await expect(service.isOnline(DRIVER_ID)).resolves.toBe(true);
  });

  it("getAvailability returns offline defaults when no row exists", async () => {
    const { service } = createSetup(null);

    await expect(service.getAvailability(DRIVER_ID)).resolves.toEqual({
      isOnline: false,
      onlineSince: null,
      lastSeenAt: null
    });
  });

  it("getAvailability maps dates to ISO strings", async () => {
    const onlineSince = new Date("2026-05-16T00:00:00.000Z");
    const lastSeenAt = new Date("2026-05-16T00:01:00.000Z");
    const { service } = createSetup(makeDriver({ isOnline: true, onlineSince, lastSeenAt }));

    await expect(service.getAvailability(DRIVER_ID)).resolves.toEqual({
      isOnline: true,
      onlineSince: onlineSince.toISOString(),
      lastSeenAt: lastSeenAt.toISOString()
    });
  });

  it("countOnline filters by isOnline=true", async () => {
    const { service, repository } = createSetup(null);
    (repository as unknown as { count: jest.Mock }).count = jest.fn().mockResolvedValue(23);

    await expect(service.countOnline()).resolves.toBe(23);
    expect(
      (repository as unknown as { count: jest.Mock }).count
    ).toHaveBeenCalledWith({ where: { isOnline: true } });
  });

  it("countTotal counts the full drivers table", async () => {
    const { service, repository } = createSetup(null);
    (repository as unknown as { count: jest.Mock }).count = jest.fn().mockResolvedValue(95);

    await expect(service.countTotal()).resolves.toBe(95);
    expect((repository as unknown as { count: jest.Mock }).count).toHaveBeenCalledWith();
  });
});
