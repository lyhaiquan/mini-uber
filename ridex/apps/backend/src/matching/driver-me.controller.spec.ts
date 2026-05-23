import "reflect-metadata";

import { NotFoundException } from "@nestjs/common";

import { ROLES_KEY } from "../auth/guards/roles.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import type { RideDetailResponseDto } from "../rides/dto/ride-detail-response.dto";
import type { RidesFacade } from "../rides/rides.facade";
import { Role } from "../users/dto/role.enum";
import { DriverMeController } from "./driver-me.controller";
import type { MatchingFacade } from "./matching.facade";

const DRIVER_ID = "33333333-3333-3333-3333-333333333333";
const RIDE_ID = "66666666-6666-6666-6666-666666666666";

function createController(overrides: {
  getCurrentOfferForDriver?: jest.Mock;
  findAssignedActiveRideByDriver?: jest.Mock;
  getRideDetail?: jest.Mock;
} = {}): {
  controller: DriverMeController;
  matchingFacade: { getCurrentOfferForDriver: jest.Mock };
  ridesFacade: { findAssignedActiveRideByDriver: jest.Mock; getRideDetail: jest.Mock };
} {
  const matchingFacade = {
    getCurrentOfferForDriver: overrides.getCurrentOfferForDriver ?? jest.fn()
  };
  const ridesFacade = {
    findAssignedActiveRideByDriver:
      overrides.findAssignedActiveRideByDriver ?? jest.fn(),
    getRideDetail: overrides.getRideDetail ?? jest.fn()
  };
  const controller = new DriverMeController(
    matchingFacade as unknown as MatchingFacade,
    ridesFacade as unknown as RidesFacade
  );
  return { controller, matchingFacade, ridesFacade };
}

const driver: AuthenticatedUser = { userId: DRIVER_ID, role: Role.DRIVER };

describe("DriverMeController metadata", () => {
  it("restricts the whole controller to the DRIVER role", () => {
    const roles = Reflect.getMetadata(ROLES_KEY, DriverMeController);
    expect(roles).toEqual([Role.DRIVER]);
  });
});

describe("DriverMeController.getCurrentOffer", () => {
  it("returns null wrapped in data when the driver has no pending offer", async () => {
    const { controller } = createController({
      getCurrentOfferForDriver: jest.fn().mockResolvedValue(null)
    });
    await expect(controller.getCurrentOffer(driver)).resolves.toEqual({ data: null });
  });

  it("returns the offer DTO when one is in flight", async () => {
    const offer = {
      offerId: "offer-1",
      rideId: RIDE_ID,
      pickup: { lat: 10, lng: 106 },
      destination: { lat: 11, lng: 107 },
      distanceMeters: 1200,
      durationSeconds: 180,
      routeConfidence: "high" as const,
      expiresAt: new Date().toISOString()
    };
    const { controller, matchingFacade } = createController({
      getCurrentOfferForDriver: jest.fn().mockResolvedValue(offer)
    });

    await expect(controller.getCurrentOffer(driver)).resolves.toEqual({ data: offer });
    expect(matchingFacade.getCurrentOfferForDriver).toHaveBeenCalledWith(DRIVER_ID);
  });
});

describe("DriverMeController.getActiveRide", () => {
  it("returns null when the driver has no assigned active ride", async () => {
    const { controller } = createController({
      findAssignedActiveRideByDriver: jest.fn().mockResolvedValue(null)
    });
    await expect(controller.getActiveRide(driver)).resolves.toEqual({ data: null });
  });

  it("returns the detail DTO when an assigned ride exists", async () => {
    const detail = { id: RIDE_ID } as RideDetailResponseDto;
    const { controller, ridesFacade } = createController({
      findAssignedActiveRideByDriver: jest.fn().mockResolvedValue({ id: RIDE_ID }),
      getRideDetail: jest.fn().mockResolvedValue(detail)
    });

    const result = await controller.getActiveRide(driver);

    expect(result).toEqual({ data: detail });
    expect(ridesFacade.getRideDetail).toHaveBeenCalledWith(RIDE_ID, {
      userId: DRIVER_ID,
      role: Role.DRIVER
    });
  });

  it("treats a NotFoundException from getRideDetail as no active ride (race with finalization)", async () => {
    const { controller } = createController({
      findAssignedActiveRideByDriver: jest.fn().mockResolvedValue({ id: RIDE_ID }),
      getRideDetail: jest
        .fn()
        .mockRejectedValue(new NotFoundException({ code: "RIDE_NOT_FOUND" }))
    });

    await expect(controller.getActiveRide(driver)).resolves.toEqual({ data: null });
  });
});
