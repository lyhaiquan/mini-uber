import type { PricingFacade } from "../pricing/pricing.facade";
import { Role } from "../users/dto/role.enum";
import type { UsersFacade } from "../users/users.facade";
import type { Ride } from "./entities/ride.entity";
import { ActorType } from "./enums/actor-type.enum";
import { RideStatus } from "./enums/ride-status.enum";
import type { RideTransitionService } from "./ride-transition.service";
import { RidesFacade } from "./rides.facade";
import type { RidesService } from "./rides.service";

const RIDE_ID = "66666666-6666-6666-6666-666666666666";
const CUSTOMER_ID = "11111111-1111-1111-1111-111111111111";
const DRIVER_ID = "33333333-3333-3333-3333-333333333333";

function makeRide(overrides: Partial<Ride> = {}): Ride {
  const now = new Date();
  return {
    id: RIDE_ID,
    customerId: CUSTOMER_ID,
    driverUserId: null,
    status: RideStatus.REQUESTED,
    pickupLat: 10,
    pickupLng: 106,
    pickupAddress: "A",
    destinationLat: 11,
    destinationLng: 107,
    destinationAddress: "B",
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

function createFacade(): {
  facade: RidesFacade;
  ridesService: jest.Mocked<RidesService>;
  transitionService: jest.Mocked<RideTransitionService>;
  usersFacade: { getUserById: jest.Mock };
  pricingFacade: { getSnapshotForRide: jest.Mock };
} {
  const ridesService = {
    findById: jest.fn(),
    findActiveByCustomer: jest.fn(),
    countActive: jest.fn(),
    countByStatusSince: jest.fn(),
    countTotalSince: jest.fn()
  } as unknown as jest.Mocked<RidesService>;

  const transitionService = {
    transition: jest.fn()
  } as unknown as jest.Mocked<RideTransitionService>;

  const usersFacade = { getUserById: jest.fn() };
  const pricingFacade = { getSnapshotForRide: jest.fn() };

  const facade = new RidesFacade(
    ridesService,
    transitionService,
    usersFacade as unknown as UsersFacade,
    pricingFacade as unknown as PricingFacade
  );
  return { facade, ridesService, transitionService, usersFacade, pricingFacade };
}

describe("RidesFacade", () => {
  describe("getRideSummary", () => {
    it("returns a summary DTO when the ride exists", async () => {
      const { facade, ridesService } = createFacade();
      ridesService.findById.mockResolvedValue(makeRide());

      const result = await facade.getRideSummary(RIDE_ID);

      expect(result).toEqual({
        id: RIDE_ID,
        customerId: CUSTOMER_ID,
        driverUserId: null,
        status: RideStatus.REQUESTED,
        pickup: { lat: 10, lng: 106 },
        destination: { lat: 11, lng: 107 },
        version: 0
      });
    });

    it("returns null when the ride does not exist", async () => {
      const { facade, ridesService } = createFacade();
      ridesService.findById.mockResolvedValue(null);

      const result = await facade.getRideSummary(RIDE_ID);

      expect(result).toBeNull();
    });
  });

  describe("getRideForMatching", () => {
    it("throws RIDE_NOT_FOUND when the ride is missing", async () => {
      const { facade, ridesService } = createFacade();
      ridesService.findById.mockResolvedValue(null);

      await expect(facade.getRideForMatching(RIDE_ID)).rejects.toMatchObject({
        response: expect.objectContaining({ code: "RIDE_NOT_FOUND" })
      });
    });

    it("returns the summary when the ride is REQUESTED", async () => {
      const { facade, ridesService } = createFacade();
      ridesService.findById.mockResolvedValue(makeRide({ status: RideStatus.REQUESTED }));

      const summary = await facade.getRideForMatching(RIDE_ID);
      expect(summary.status).toBe(RideStatus.REQUESTED);
    });

    it("returns the summary when the ride is MATCHING", async () => {
      const { facade, ridesService } = createFacade();
      ridesService.findById.mockResolvedValue(makeRide({ status: RideStatus.MATCHING }));

      const summary = await facade.getRideForMatching(RIDE_ID);
      expect(summary.status).toBe(RideStatus.MATCHING);
    });

    it("rejects rides that have already been assigned (ACCEPTED+)", async () => {
      const { facade, ridesService } = createFacade();
      ridesService.findById.mockResolvedValue(
        makeRide({ status: RideStatus.ACCEPTED, driverUserId: DRIVER_ID })
      );

      await expect(facade.getRideForMatching(RIDE_ID)).rejects.toMatchObject({
        response: expect.objectContaining({ code: "RIDE_NOT_MATCHING_ELIGIBLE" })
      });
    });

    it("rejects rides in terminal states", async () => {
      const { facade, ridesService } = createFacade();
      for (const terminal of [
        RideStatus.COMPLETED,
        RideStatus.CANCELLED,
        RideStatus.NO_DRIVERS_FOUND
      ]) {
        ridesService.findById.mockResolvedValue(makeRide({ status: terminal }));

        await expect(facade.getRideForMatching(RIDE_ID)).rejects.toMatchObject({
          response: expect.objectContaining({ code: "RIDE_NOT_MATCHING_ELIGIBLE" })
        });
      }
    });
  });

  describe("findActiveRideForCustomer", () => {
    it("returns a summary when an active ride exists", async () => {
      const { facade, ridesService } = createFacade();
      const ridesServiceTyped = ridesService as unknown as {
        findActiveByCustomer: jest.Mock;
      };
      ridesServiceTyped.findActiveByCustomer = jest
        .fn()
        .mockResolvedValue(makeRide({ status: RideStatus.ACCEPTED }));

      const result = await facade.findActiveRideForCustomer(CUSTOMER_ID);

      expect(result).not.toBeNull();
      expect(result!.status).toBe(RideStatus.ACCEPTED);
      expect(ridesServiceTyped.findActiveByCustomer).toHaveBeenCalledWith(CUSTOMER_ID);
    });

    it("returns null when the customer has no active ride", async () => {
      const { facade, ridesService } = createFacade();
      const ridesServiceTyped = ridesService as unknown as {
        findActiveByCustomer: jest.Mock;
      };
      ridesServiceTyped.findActiveByCustomer = jest.fn().mockResolvedValue(null);

      const result = await facade.findActiveRideForCustomer(CUSTOMER_ID);
      expect(result).toBeNull();
    });
  });

  describe("getRideForPayment", () => {
    it("returns payment-facing ride fields", async () => {
      const { facade, ridesService } = createFacade();
      ridesService.findById.mockResolvedValue(
        makeRide({ status: RideStatus.COMPLETED, driverUserId: DRIVER_ID })
      );

      await expect(facade.getRideForPayment(RIDE_ID)).resolves.toEqual({
        id: RIDE_ID,
        customerId: CUSTOMER_ID,
        driverUserId: DRIVER_ID,
        status: RideStatus.COMPLETED
      });
    });

    it("returns null when payment ride is missing", async () => {
      const { facade, ridesService } = createFacade();
      ridesService.findById.mockResolvedValue(null);

      await expect(facade.getRideForPayment(RIDE_ID)).resolves.toBeNull();
    });
  });

  describe("getDashboardCounts", () => {
    it("aggregates active + per-status + total counts via Promise.all", async () => {
      const { facade, ridesService } = createFacade();
      ridesService.countActive.mockResolvedValue(7);
      ridesService.countByStatusSince
        .mockResolvedValueOnce(142) // completed
        .mockResolvedValueOnce(11) // cancelled
        .mockResolvedValueOnce(3); // no drivers
      ridesService.countTotalSince.mockResolvedValue(156);
      const since = new Date("2026-05-17T03:14:15.000Z");

      await expect(facade.getDashboardCounts(since)).resolves.toEqual({
        active: 7,
        completedLast24h: 142,
        cancelledLast24h: 11,
        noDriversFoundLast24h: 3,
        totalLast24h: 156
      });
      expect(ridesService.countActive).toHaveBeenCalledTimes(1);
      expect(ridesService.countByStatusSince.mock.calls[0]?.[0]).toBe(since);
      expect(ridesService.countByStatusSince.mock.calls[0]?.[1]).toEqual([RideStatus.COMPLETED]);
      expect(ridesService.countByStatusSince.mock.calls[1]?.[1]).toEqual([RideStatus.CANCELLED]);
      expect(ridesService.countByStatusSince.mock.calls[2]?.[1]).toEqual([
        RideStatus.NO_DRIVERS_FOUND
      ]);
    });

    it("countActive is independent of the 24h window", async () => {
      const { facade, ridesService } = createFacade();
      ridesService.countActive.mockResolvedValue(99);
      ridesService.countByStatusSince.mockResolvedValue(0);
      ridesService.countTotalSince.mockResolvedValue(0);

      const result = await facade.getDashboardCounts(new Date());

      expect(result.active).toBe(99);
      expect(ridesService.countActive).toHaveBeenCalledWith();
    });

    it("returns zero counts when there is no ride activity", async () => {
      const { facade, ridesService } = createFacade();
      ridesService.countActive.mockResolvedValue(0);
      ridesService.countByStatusSince.mockResolvedValue(0);
      ridesService.countTotalSince.mockResolvedValue(0);

      await expect(facade.getDashboardCounts(new Date())).resolves.toEqual({
        active: 0,
        completedLast24h: 0,
        cancelledLast24h: 0,
        noDriversFoundLast24h: 0,
        totalLast24h: 0
      });
    });
  });

  describe("getRideDetail", () => {
    it("throws RIDE_NOT_FOUND when ride is missing", async () => {
      const { facade, ridesService } = createFacade();
      ridesService.findById.mockResolvedValue(null);

      await expect(
        facade.getRideDetail(RIDE_ID, { userId: CUSTOMER_ID, role: Role.CUSTOMER })
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "RIDE_NOT_FOUND" })
      });
    });

    it("forbids customer from viewing another customer's ride", async () => {
      const { facade, ridesService } = createFacade();
      ridesService.findById.mockResolvedValue(makeRide({ customerId: "other-customer" }));

      await expect(
        facade.getRideDetail(RIDE_ID, { userId: CUSTOMER_ID, role: Role.CUSTOMER })
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "RIDE_FORBIDDEN_ACCESS" })
      });
    });

    it("forbids driver from viewing an unassigned ride", async () => {
      const { facade, ridesService } = createFacade();
      ridesService.findById.mockResolvedValue(
        makeRide({ driverUserId: "other-driver", status: RideStatus.ACCEPTED })
      );

      await expect(
        facade.getRideDetail(RIDE_ID, { userId: DRIVER_ID, role: Role.DRIVER })
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "RIDE_FORBIDDEN_ACCESS" })
      });
    });

    it("allows admin to view any ride", async () => {
      const { facade, ridesService, pricingFacade } = createFacade();
      ridesService.findById.mockResolvedValue(makeRide({ customerId: "other-customer" }));
      pricingFacade.getSnapshotForRide.mockResolvedValue(null);

      const result = await facade.getRideDetail(RIDE_ID, {
        userId: "admin-id",
        role: Role.ADMIN
      });
      expect(result.id).toBe(RIDE_ID);
    });

    it("omits driver identity while status < ACCEPTED (MATCHING leak guard)", async () => {
      const { facade, ridesService, usersFacade, pricingFacade } = createFacade();
      ridesService.findById.mockResolvedValue(
        makeRide({ status: RideStatus.MATCHING, driverUserId: DRIVER_ID })
      );
      pricingFacade.getSnapshotForRide.mockResolvedValue(null);

      const result = await facade.getRideDetail(RIDE_ID, {
        userId: CUSTOMER_ID,
        role: Role.CUSTOMER
      });
      expect(result.driver).toBeNull();
      expect(usersFacade.getUserById).not.toHaveBeenCalled();
    });

    it("returns masked driver email once ride is ACCEPTED+", async () => {
      const { facade, ridesService, usersFacade, pricingFacade } = createFacade();
      ridesService.findById.mockResolvedValue(
        makeRide({ status: RideStatus.ACCEPTED, driverUserId: DRIVER_ID })
      );
      usersFacade.getUserById.mockResolvedValue({
        id: DRIVER_ID,
        email: "alice@example.com",
        role: Role.DRIVER,
        createdAt: new Date().toISOString()
      });
      pricingFacade.getSnapshotForRide.mockResolvedValue(null);

      const result = await facade.getRideDetail(RIDE_ID, {
        userId: CUSTOMER_ID,
        role: Role.CUSTOMER
      });
      expect(result.driver).toEqual({ id: DRIVER_ID, maskedEmail: "a***@example.com" });
    });

    it("attaches pricing snapshot summary when available", async () => {
      const { facade, ridesService, pricingFacade } = createFacade();
      ridesService.findById.mockResolvedValue(makeRide());
      pricingFacade.getSnapshotForRide.mockResolvedValue({
        currency: "VND",
        totalVnd: 104400,
        distanceMeters: 12500,
        durationSeconds: 1500,
        surgeMultiplier: 1.2,
        baseFareVnd: 12000,
        surgeAmountVnd: 17400,
        routePolyline: "polylinedata",
        routePolylineFormat: "polyline5"
      });

      const result = await facade.getRideDetail(RIDE_ID, {
        userId: CUSTOMER_ID,
        role: Role.CUSTOMER
      });
      expect(result.pricing).toMatchObject({
        totalVnd: 104400,
        routePolyline: "polylinedata",
        routePolylineFormat: "polyline5"
      });
    });
  });

  describe("internal SYSTEM transitions", () => {
    it("markMatching delegates with SYSTEM actor", async () => {
      const { facade, transitionService } = createFacade();
      transitionService.transition.mockResolvedValue({} as never);

      await facade.markMatching(RIDE_ID);

      expect(transitionService.transition).toHaveBeenCalledWith(
        RIDE_ID,
        RideStatus.MATCHING,
        { type: ActorType.SYSTEM, userId: null }
      );
    });

    it("assignDriver delegates with SYSTEM actor + driverUserId option", async () => {
      const { facade, transitionService } = createFacade();
      transitionService.transition.mockResolvedValue({} as never);

      await facade.assignDriver(RIDE_ID, DRIVER_ID);

      expect(transitionService.transition).toHaveBeenCalledWith(
        RIDE_ID,
        RideStatus.ACCEPTED,
        { type: ActorType.SYSTEM, userId: null },
        { driverUserId: DRIVER_ID }
      );
    });

    it("markNoDriversFound delegates with SYSTEM actor + reason", async () => {
      const { facade, transitionService } = createFacade();
      transitionService.transition.mockResolvedValue({} as never);

      await facade.markNoDriversFound(RIDE_ID, "exhausted");

      expect(transitionService.transition).toHaveBeenCalledWith(
        RIDE_ID,
        RideStatus.NO_DRIVERS_FOUND,
        { type: ActorType.SYSTEM, userId: null },
        { reason: "exhausted" }
      );
    });
  });
});
