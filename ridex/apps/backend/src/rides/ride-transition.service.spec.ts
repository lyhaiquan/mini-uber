import type { ConfigService } from "@nestjs/config";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import type { DataSource, EntityManager } from "typeorm";

import { StructuredLogger } from "../common/logging/structured-logger";
import type { EnvironmentVariables } from "../config/env.validation";
import { Ride } from "./entities/ride.entity";
import { RideEvent } from "./entities/ride-event.entity";
import { ActorType, systemActor, type TransitionActor } from "./enums/actor-type.enum";
import { ALL_RIDE_STATUSES, RideStatus, TERMINAL_RIDE_STATUSES } from "./enums/ride-status.enum";
import { RideTransitionService } from "./ride-transition.service";
import {
  ALLOWED_TRANSITIONS,
  findTransitionRule
} from "./transitions/allowed-transitions";

const CUSTOMER_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_CUSTOMER_ID = "22222222-2222-2222-2222-222222222222";
const DRIVER_ID = "33333333-3333-3333-3333-333333333333";
const OTHER_DRIVER_ID = "44444444-4444-4444-4444-444444444444";
const ADMIN_ID = "55555555-5555-5555-5555-555555555555";
const RIDE_ID = "66666666-6666-6666-6666-666666666666";

interface Setup {
  service: RideTransitionService;
  ridesMap: Map<string, Ride>;
  rideEvents: RideEvent[];
  eventEmitter: jest.Mocked<EventEmitter2>;
}

function createSetup(): Setup {
  const ridesMap = new Map<string, Ride>();
  const rideEvents: RideEvent[] = [];

  const mockManager = {
    findOne: jest.fn(async (entityClass: unknown, options: { where: { id: string } }) => {
      if (entityClass === Ride) {
        const stored = ridesMap.get(options.where.id);
        return stored === undefined ? null : { ...stored };
      }
      return null;
    }),
    create: jest.fn((_entityClass: unknown, payload: Partial<RideEvent>) => ({ ...payload })),
    update: jest.fn(
      async (
        entityClass: unknown,
        where: { id: string; version: number },
        patch: Partial<Ride>
      ) => {
        if (entityClass === Ride) {
          const stored = ridesMap.get(where.id);
          if (stored === undefined) {
            return { affected: 0, raw: [], generatedMaps: [] };
          }
          if (stored.version !== where.version) {
            return { affected: 0, raw: [], generatedMaps: [] };
          }
          Object.assign(stored, patch);
          return { affected: 1, raw: [], generatedMaps: [] };
        }
        return { affected: 0, raw: [], generatedMaps: [] };
      }
    ),
    save: jest.fn(async (entityClass: unknown, entity: Partial<RideEvent>) => {
      if (entityClass === RideEvent) {
        const event = {
          id: `evt-${rideEvents.length}`,
          ...entity
        } as RideEvent;
        rideEvents.push(event);
        return event;
      }
      return entity;
    })
  } as unknown as EntityManager;

  let transactionQueue: Promise<void> = Promise.resolve();
  const dataSource = {
    transaction: jest.fn(
      <TResult>(callback: (manager: EntityManager) => Promise<TResult>): Promise<TResult> => {
        const run = transactionQueue.then(() => callback(mockManager));
        transactionQueue = run.then(
          () => undefined,
          () => undefined
        );
        return run;
      }
    )
  } as unknown as DataSource;

  const logger = new StructuredLogger({
    get: jest.fn().mockReturnValue("error")
  } as unknown as ConfigService<EnvironmentVariables, true>);
  const eventEmitter = {
    emit: jest.fn()
  } as unknown as jest.Mocked<EventEmitter2>;

  const service = new RideTransitionService(dataSource, logger, eventEmitter);

  return { service, ridesMap, rideEvents, eventEmitter };
}

function makeRide(overrides: Partial<Ride> = {}): Ride {
  const now = new Date();
  return {
    id: RIDE_ID,
    customerId: CUSTOMER_ID,
    driverUserId: null,
    status: RideStatus.REQUESTED,
    pickupLat: 10.7769,
    pickupLng: 106.7009,
    pickupAddress: "Bến Thành",
    destinationLat: 10.8231,
    destinationLng: 106.6297,
    destinationAddress: "Tân Sơn Nhất",
    requestedAt: now,
    matchingStartedAt: null,
    acceptedAt: null,
    driverArrivedAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    version: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides
  } as Ride;
}

function placeRide(setup: Setup, ride: Ride): void {
  setup.ridesMap.set(ride.id, { ...ride });
}

function customerActor(userId: string = CUSTOMER_ID): TransitionActor {
  return { type: ActorType.CUSTOMER, userId };
}

function driverActor(userId: string = DRIVER_ID): TransitionActor {
  return { type: ActorType.DRIVER, userId };
}

function adminActor(): TransitionActor {
  return { type: ActorType.ADMIN, userId: ADMIN_ID };
}

function setupRideForFromStatus(setup: Setup, from: RideStatus): void {
  // For statuses that require a driver_user_id to be set, attach DRIVER_ID
  const requiresDriver =
    from === RideStatus.ACCEPTED ||
    from === RideStatus.DRIVER_ARRIVED ||
    from === RideStatus.IN_PROGRESS;
  placeRide(setup, makeRide({ status: from, driverUserId: requiresDriver ? DRIVER_ID : null }));
}

function actorFor(type: ActorType): TransitionActor {
  switch (type) {
    case ActorType.CUSTOMER:
      return customerActor();
    case ActorType.DRIVER:
      return driverActor();
    case ActorType.ADMIN:
      return adminActor();
    case ActorType.SYSTEM:
      return systemActor();
  }
}

describe("RideTransitionService", () => {
  beforeAll(() => {
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("positive transition matrix", () => {
    for (const rule of ALLOWED_TRANSITIONS) {
      for (const allowedActor of rule.allowed) {
        const label = `${rule.from} -> ${rule.to} as ${allowedActor.type} (${allowedActor.ownership})`;

        it(`allows ${label}`, async () => {
          const setup = createSetup();
          setupRideForFromStatus(setup, rule.from);

          const actor = actorFor(allowedActor.type);
          const options =
            rule.to === RideStatus.ACCEPTED ? { driverUserId: DRIVER_ID } : undefined;

          const result = await setup.service.transition(RIDE_ID, rule.to, actor, options);

          expect(result.status).toBe(rule.to);
          expect(result.version).toBe(1);

          // Verify audit row written
          const event = setup.rideEvents.at(-1);
          expect(event).toBeDefined();
          expect(event!.toStatus).toBe(rule.to);
          expect(event!.fromStatus).toBe(rule.from);
          expect(event!.actorType).toBe(actor.type);
          expect(event!.actorId).toBe(actor.userId);
        });
      }
    }
  });

  describe("negative transition matrix", () => {
    it("rejects every transition not in the allowed map", async () => {
      const setup = createSetup();

      for (const from of ALL_RIDE_STATUSES) {
        for (const to of ALL_RIDE_STATUSES) {
          if (from === to) continue;
          if (findTransitionRule(from, to) !== undefined) continue;

          setup.ridesMap.clear();
          setupRideForFromStatus(setup, from);

          await expect(
            setup.service.transition(RIDE_ID, to, adminActor(), { driverUserId: DRIVER_ID })
          ).rejects.toMatchObject({
            response: expect.objectContaining({ code: "RIDE_INVALID_STATE" })
          });
        }
      }
    });
  });

  describe("terminal state immutability", () => {
    for (const terminal of TERMINAL_RIDE_STATUSES) {
      it(`rejects any transition out of ${terminal}`, async () => {
        const setup = createSetup();
        placeRide(setup, makeRide({ status: terminal, driverUserId: DRIVER_ID }));

        for (const to of ALL_RIDE_STATUSES) {
          if (to === terminal) continue;

          await expect(
            setup.service.transition(RIDE_ID, to, adminActor(), { driverUserId: DRIVER_ID })
          ).rejects.toMatchObject({
            response: expect.objectContaining({ code: "RIDE_INVALID_STATE" })
          });
        }
      });
    }
  });

  describe("role denial", () => {
    it("rejects customer trying to start the ride", async () => {
      const setup = createSetup();
      setupRideForFromStatus(setup, RideStatus.DRIVER_ARRIVED);

      await expect(
        setup.service.transition(RIDE_ID, RideStatus.IN_PROGRESS, customerActor())
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "RIDE_FORBIDDEN_TRANSITION" })
      });
    });

    it("rejects customer trying to complete the ride", async () => {
      const setup = createSetup();
      setupRideForFromStatus(setup, RideStatus.IN_PROGRESS);

      await expect(
        setup.service.transition(RIDE_ID, RideStatus.COMPLETED, customerActor())
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "RIDE_FORBIDDEN_TRANSITION" })
      });
    });

    it("rejects driver trying to start matching", async () => {
      const setup = createSetup();
      setupRideForFromStatus(setup, RideStatus.REQUESTED);

      await expect(
        setup.service.transition(RIDE_ID, RideStatus.MATCHING, driverActor())
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "RIDE_FORBIDDEN_TRANSITION" })
      });
    });

    it("rejects customer attempting IN_PROGRESS -> CANCELLED (admin-only rule)", async () => {
      const setup = createSetup();
      setupRideForFromStatus(setup, RideStatus.IN_PROGRESS);

      await expect(
        setup.service.transition(RIDE_ID, RideStatus.CANCELLED, customerActor())
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "RIDE_FORBIDDEN_TRANSITION" })
      });
    });

    it("rejects driver attempting IN_PROGRESS -> CANCELLED (admin-only rule)", async () => {
      const setup = createSetup();
      setupRideForFromStatus(setup, RideStatus.IN_PROGRESS);

      await expect(
        setup.service.transition(RIDE_ID, RideStatus.CANCELLED, driverActor())
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "RIDE_FORBIDDEN_TRANSITION" })
      });
    });
  });

  describe("ownership denial", () => {
    it("rejects a different customer from cancelling someone else's ride", async () => {
      const setup = createSetup();
      placeRide(setup, makeRide({ status: RideStatus.REQUESTED }));

      await expect(
        setup.service.transition(RIDE_ID, RideStatus.CANCELLED, customerActor(OTHER_CUSTOMER_ID))
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "RIDE_FORBIDDEN_TRANSITION" })
      });
    });

    it("rejects a different driver from progressing an assigned ride", async () => {
      const setup = createSetup();
      placeRide(setup, makeRide({ status: RideStatus.ACCEPTED, driverUserId: DRIVER_ID }));

      await expect(
        setup.service.transition(
          RIDE_ID,
          RideStatus.DRIVER_ARRIVED,
          driverActor(OTHER_DRIVER_ID)
        )
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "RIDE_FORBIDDEN_TRANSITION" })
      });
    });
  });

  describe("version conflict", () => {
    it("rejects when expectedVersion does not match", async () => {
      const setup = createSetup();
      placeRide(setup, makeRide({ status: RideStatus.REQUESTED, version: 5 }));

      await expect(
        setup.service.transition(RIDE_ID, RideStatus.CANCELLED, customerActor(), {
          expectedVersion: 2
        })
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "RIDE_VERSION_CONFLICT" })
      });
    });

    it("succeeds when expectedVersion matches and increments version", async () => {
      const setup = createSetup();
      placeRide(setup, makeRide({ status: RideStatus.REQUESTED, version: 5 }));

      const result = await setup.service.transition(
        RIDE_ID,
        RideStatus.CANCELLED,
        customerActor(),
        { expectedVersion: 5 }
      );

      expect(result.version).toBe(6);
    });
  });

  describe("not-found handling", () => {
    it("throws RIDE_NOT_FOUND when the ride does not exist", async () => {
      const setup = createSetup();

      await expect(
        setup.service.transition(RIDE_ID, RideStatus.CANCELLED, customerActor())
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "RIDE_NOT_FOUND" })
      });
    });
  });

  describe("ACCEPTED transition specifics", () => {
    it("sets driver_user_id atomically with status", async () => {
      const setup = createSetup();
      placeRide(setup, makeRide({ status: RideStatus.MATCHING }));

      const result = await setup.service.transition(RIDE_ID, RideStatus.ACCEPTED, systemActor(), {
        driverUserId: DRIVER_ID
      });

      expect(result.status).toBe(RideStatus.ACCEPTED);
      expect(result.driverUserId).toBe(DRIVER_ID);
      expect(result.acceptedAt).not.toBeNull();
    });

    it("throws when driverUserId is missing for ACCEPTED", async () => {
      const setup = createSetup();
      placeRide(setup, makeRide({ status: RideStatus.MATCHING }));

      await expect(
        setup.service.transition(RIDE_ID, RideStatus.ACCEPTED, systemActor())
      ).rejects.toThrow(/driverUserId/);
    });

    it("accepts driverUserId from metadata as a fallback", async () => {
      const setup = createSetup();
      placeRide(setup, makeRide({ status: RideStatus.MATCHING }));

      const result = await setup.service.transition(RIDE_ID, RideStatus.ACCEPTED, systemActor(), {
        metadata: { driverUserId: DRIVER_ID }
      });

      expect(result.driverUserId).toBe(DRIVER_ID);
    });
  });

  describe("cancellation specifics", () => {
    it("records cancelled_by and cancellation_reason", async () => {
      const setup = createSetup();
      placeRide(setup, makeRide({ status: RideStatus.REQUESTED }));

      const result = await setup.service.transition(
        RIDE_ID,
        RideStatus.CANCELLED,
        customerActor(),
        { reason: "Changed my mind" }
      );

      expect(result.cancelledBy).toBe(ActorType.CUSTOMER);
      expect(result.cancellationReason).toBe("Changed my mind");
      expect(result.cancelledAt).not.toBeNull();
    });

    it("admin override on IN_PROGRESS -> CANCELLED produces an admin audit row", async () => {
      const setup = createSetup();
      setupRideForFromStatus(setup, RideStatus.IN_PROGRESS);

      const result = await setup.service.transition(
        RIDE_ID,
        RideStatus.CANCELLED,
        adminActor(),
        { reason: "fraud" }
      );

      expect(result.cancelledBy).toBe(ActorType.ADMIN);
      const event = setup.rideEvents.at(-1)!;
      expect(event.actorType).toBe(ActorType.ADMIN);
      expect(event.actorId).toBe(ADMIN_ID);
    });

    it("NO_DRIVERS_FOUND sets cancelled_by = SYSTEM with default reason", async () => {
      const setup = createSetup();
      placeRide(setup, makeRide({ status: RideStatus.MATCHING }));

      const result = await setup.service.transition(
        RIDE_ID,
        RideStatus.NO_DRIVERS_FOUND,
        systemActor()
      );

      expect(result.cancelledBy).toBe(ActorType.SYSTEM);
      expect(result.cancellationReason).toBe("no_candidates");
    });
  });

  describe("concurrent transitions", () => {
    it("serializes concurrent transitions; the second sees the updated state and is rejected", async () => {
      const setup = createSetup();
      placeRide(setup, makeRide({ status: RideStatus.REQUESTED }));

      const results = await Promise.allSettled([
        setup.service.transition(RIDE_ID, RideStatus.MATCHING, systemActor()),
        setup.service.transition(RIDE_ID, RideStatus.MATCHING, systemActor())
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const reason = (rejected[0] as PromiseRejectedResult).reason;
      expect(reason.response).toMatchObject({ code: "RIDE_INVALID_STATE" });
    });

    it("optimistic version detects concurrent client updates", async () => {
      const setup = createSetup();
      placeRide(setup, makeRide({ status: RideStatus.REQUESTED, version: 0 }));

      const results = await Promise.allSettled([
        setup.service.transition(RIDE_ID, RideStatus.CANCELLED, customerActor(), {
          expectedVersion: 0
        }),
        setup.service.transition(RIDE_ID, RideStatus.CANCELLED, customerActor(), {
          expectedVersion: 0
        })
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const reason = (rejected[0] as PromiseRejectedResult).reason;
      // The second attempt either hits a version mismatch (if first finished
      // its UPDATE) or a transition-from-terminal error.
      expect(["RIDE_VERSION_CONFLICT", "RIDE_INVALID_STATE"]).toContain(reason.response.code);
    });
  });

  describe("audit emission", () => {
    it("writes a ride_event row on every successful transition", async () => {
      const setup = createSetup();
      placeRide(setup, makeRide({ status: RideStatus.REQUESTED }));

      await setup.service.transition(RIDE_ID, RideStatus.MATCHING, systemActor());
      await setup.service.transition(RIDE_ID, RideStatus.ACCEPTED, systemActor(), {
        driverUserId: DRIVER_ID
      });
      await setup.service.transition(RIDE_ID, RideStatus.DRIVER_ARRIVED, driverActor());
      await setup.service.transition(RIDE_ID, RideStatus.IN_PROGRESS, driverActor());
      await setup.service.transition(RIDE_ID, RideStatus.COMPLETED, driverActor());

      expect(setup.rideEvents).toHaveLength(5);
      const sequence = setup.rideEvents.map((e) => e.toStatus);
      expect(sequence).toEqual([
        RideStatus.MATCHING,
        RideStatus.ACCEPTED,
        RideStatus.DRIVER_ARRIVED,
        RideStatus.IN_PROGRESS,
        RideStatus.COMPLETED
      ]);
    });

    it("emits ride.completed after a successful COMPLETED transition", async () => {
      const setup = createSetup();
      placeRide(
        setup,
        makeRide({
          status: RideStatus.IN_PROGRESS,
          driverUserId: DRIVER_ID,
          version: 4
        })
      );

      await setup.service.transition(RIDE_ID, RideStatus.COMPLETED, driverActor());

      expect(setup.eventEmitter.emit).toHaveBeenCalledWith(
        "ride.completed",
        expect.objectContaining({
          aggregateType: "ride",
          aggregateId: RIDE_ID,
          emittedBy: "rides",
          payload: expect.objectContaining({
            rideId: RIDE_ID,
            customerId: CUSTOMER_ID,
            driverUserId: DRIVER_ID,
            completedAt: expect.any(String)
          })
        })
      );
    });
  });
});
