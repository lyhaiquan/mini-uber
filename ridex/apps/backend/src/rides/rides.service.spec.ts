import type { ConfigService } from "@nestjs/config";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import type { EntityManager, Repository } from "typeorm";

import { StructuredLogger } from "../common/logging/structured-logger";
import type { EnvironmentVariables } from "../config/env.validation";
import type { CreateRideDto } from "./dto/create-ride.dto";
import { Ride } from "./entities/ride.entity";
import { RideEvent } from "./entities/ride-event.entity";
import { ActorType } from "./enums/actor-type.enum";
import { RideStatus } from "./enums/ride-status.enum";
import { RIDE_REQUESTED_EVENT } from "./events/ride-events";
import { RidesService } from "./rides.service";

const CUSTOMER_ID = "11111111-1111-1111-1111-111111111111";

interface Setup {
  service: RidesService;
  ridesMap: Map<string, Ride>;
  rideEvents: RideEvent[];
  eventEmitter: jest.Mocked<EventEmitter2>;
  setActiveRide: (ride: Ride | null) => void;
}

function createSetup(): Setup {
  const ridesMap = new Map<string, Ride>();
  const rideEvents: RideEvent[] = [];

  let nextId = 1;

  const mockManager = {
    create: jest.fn((_entityClass: unknown, payload: Partial<Ride> | Partial<RideEvent>) => ({
      ...payload
    })),
    save: jest.fn(async (entityClass: unknown, entity: Ride | Partial<RideEvent>) => {
      if (entityClass === Ride) {
        const ride = entity as Ride;
        const id = ride.id ?? `ride-${nextId++}`;
        const stored = { ...ride, id, createdAt: new Date(), updatedAt: new Date() };
        ridesMap.set(id, stored);
        return stored;
      }
      if (entityClass === RideEvent) {
        const event = {
          id: `evt-${rideEvents.length}`,
          ...(entity as Partial<RideEvent>)
        } as RideEvent;
        rideEvents.push(event);
        return event;
      }
      return entity;
    })
  } as unknown as EntityManager;

  const activeQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getOne: jest.fn(async () => null as Ride | null)
  };

  const rideRepo = {
    manager: {
      transaction: jest.fn(
        <TResult>(callback: (manager: EntityManager) => Promise<TResult>): Promise<TResult> =>
          callback(mockManager)
      )
    },
    findOne: jest.fn(async ({ where }: { where: { id: string } }) => {
      return ridesMap.get(where.id) ?? null;
    }),
    createQueryBuilder: jest.fn(() => activeQueryBuilder)
  } as unknown as Repository<Ride>;

  const rideEventRepo = {} as unknown as Repository<RideEvent>;

  const logger = new StructuredLogger({
    get: jest.fn().mockReturnValue("error")
  } as unknown as ConfigService<EnvironmentVariables, true>);
  const eventEmitter = {
    emit: jest.fn()
  } as unknown as jest.Mocked<EventEmitter2>;

  const service = new RidesService(rideRepo, rideEventRepo, logger, eventEmitter);

  const setActiveRide = (ride: Ride | null): void => {
    activeQueryBuilder.getOne.mockResolvedValueOnce(ride);
  };

  return { service, ridesMap, rideEvents, eventEmitter, setActiveRide };
}

const validDto: CreateRideDto = {
  pickup: { lat: 10.7769, lng: 106.7009, address: "Bến Thành" },
  destination: { lat: 10.8231, lng: 106.6297, address: "Tân Sơn Nhất" }
};

describe("RidesService.createRide", () => {
  beforeAll(() => {
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it("creates a ride in REQUESTED with version 0", async () => {
    const { service, ridesMap } = createSetup();

    const result = await service.createRide(CUSTOMER_ID, validDto);

    expect(result.status).toBe(RideStatus.REQUESTED);
    expect(result.version).toBe(0);
    expect(result.customerId).toBe(CUSTOMER_ID);
    expect(result.driverUserId).toBeNull();
    expect(result.pickup).toEqual({
      lat: 10.7769,
      lng: 106.7009,
      address: "Bến Thành"
    });
    expect(result.destination).toEqual({
      lat: 10.8231,
      lng: 106.6297,
      address: "Tân Sơn Nhất"
    });
    expect(ridesMap.size).toBe(1);
  });

  it("emits a synthetic ride_event with fromStatus=null", async () => {
    const { service, rideEvents } = createSetup();

    await service.createRide(CUSTOMER_ID, validDto);

    expect(rideEvents).toHaveLength(1);
    expect(rideEvents[0].fromStatus).toBeNull();
    expect(rideEvents[0].toStatus).toBe(RideStatus.REQUESTED);
    expect(rideEvents[0].actorType).toBe(ActorType.CUSTOMER);
    expect(rideEvents[0].actorId).toBe(CUSTOMER_ID);
  });

  it("sets requestedAt timestamp", async () => {
    const { service } = createSetup();

    const before = Date.now();
    const result = await service.createRide(CUSTOMER_ID, validDto);
    const after = Date.now();

    const requestedAt = new Date(result.requestedAt).getTime();
    expect(requestedAt).toBeGreaterThanOrEqual(before);
    expect(requestedAt).toBeLessThanOrEqual(after);
  });

  it("emits ride.requested after the create transaction commits", async () => {
    const { service, eventEmitter } = createSetup();

    const result = await service.createRide(CUSTOMER_ID, validDto);

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      RIDE_REQUESTED_EVENT,
      expect.objectContaining({
        eventType: RIDE_REQUESTED_EVENT,
        aggregateType: "ride",
        aggregateId: result.id,
        emittedBy: "rides",
        payload: {
          customerId: CUSTOMER_ID,
          pickup: { lat: validDto.pickup.lat, lng: validDto.pickup.lng },
          destination: { lat: validDto.destination.lat, lng: validDto.destination.lng },
          requestedAt: result.requestedAt
        }
      })
    );
  });

  it("throws RideAlreadyActiveError when customer already has an active ride", async () => {
    const { service, setActiveRide } = createSetup();
    setActiveRide({
      id: "existing-ride",
      customerId: CUSTOMER_ID,
      status: RideStatus.REQUESTED
    } as Ride);

    const { RideAlreadyActiveError } = await import("./errors/ride-already-active.error");

    await expect(service.createRide(CUSTOMER_ID, validDto)).rejects.toBeInstanceOf(
      RideAlreadyActiveError
    );
  });
});

describe("RidesService dashboard counters", () => {
  function createCounterSetup(): {
    service: RidesService;
    builders: {
      countActive: { where: jest.Mock; getCount: jest.Mock };
      countByStatus: { where: jest.Mock; andWhere: jest.Mock; getCount: jest.Mock };
      countTotal: { where: jest.Mock; getCount: jest.Mock };
    };
  } {
    const countActiveBuilder = {
      where: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(7)
    };
    const countByStatusBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(42)
    };
    const countTotalBuilder = {
      where: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(123)
    };

    const builderQueue = [countActiveBuilder, countByStatusBuilder, countTotalBuilder];
    const rideRepo = {
      createQueryBuilder: jest.fn(() => builderQueue.shift())
    } as unknown as Repository<Ride>;

    const logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as unknown as StructuredLogger;

    const service = new RidesService(
      rideRepo,
      {} as unknown as Repository<RideEvent>,
      logger,
      { emit: jest.fn() } as unknown as EventEmitter2
    );

    return {
      service,
      builders: {
        countActive: countActiveBuilder,
        countByStatus: countByStatusBuilder,
        countTotal: countTotalBuilder
      }
    };
  }

  it("countActive filters by ACTIVE_RIDE_STATUSES", async () => {
    const { service, builders } = createCounterSetup();

    await expect(service.countActive()).resolves.toBe(7);
    expect(builders.countActive.where).toHaveBeenCalledWith(
      "ride.status IN (:...statuses)",
      expect.objectContaining({ statuses: expect.arrayContaining([RideStatus.REQUESTED]) })
    );
  });

  it("countByStatusSince scopes by created_at + status set", async () => {
    const setup = createCounterSetup();
    void (await setup.service.countActive());

    const since = new Date("2026-05-17T03:14:15.000Z");
    await expect(
      setup.service.countByStatusSince(since, [RideStatus.COMPLETED])
    ).resolves.toBe(42);
    expect(setup.builders.countByStatus.where).toHaveBeenCalledWith(
      "ride.created_at >= :since",
      { since }
    );
    expect(setup.builders.countByStatus.andWhere).toHaveBeenCalledWith(
      "ride.status IN (:...statuses)",
      { statuses: [RideStatus.COMPLETED] }
    );
  });

  it("countByStatusSince short-circuits to 0 when statuses is empty", async () => {
    const { service } = createCounterSetup();
    await expect(service.countByStatusSince(new Date(), [])).resolves.toBe(0);
  });
});
