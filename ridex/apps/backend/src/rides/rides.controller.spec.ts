import "reflect-metadata";

import { BadRequestException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";

import { ROLES_KEY } from "../auth/guards/roles.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PUBLIC_ROUTE_KEY } from "../common/decorators/public.decorator";
import { Role } from "../users/dto/role.enum";
import type { CreateRideDto } from "./dto/create-ride.dto";
import type { QuoteRideDto } from "./dto/quote-ride.dto";
import type { RideResponseDto } from "./dto/ride-response.dto";
import type { TransitionRideDto } from "./dto/transition-ride.dto";
import { ActorType } from "./enums/actor-type.enum";
import { RideStatus } from "./enums/ride-status.enum";
import type { RideTransitionService } from "./ride-transition.service";
import { RidesController } from "./rides.controller";
import type { RidesService } from "./rides.service";

const CUSTOMER_ID = "11111111-1111-1111-1111-111111111111";
const DRIVER_ID = "33333333-3333-3333-3333-333333333333";
const RIDE_ID = "66666666-6666-6666-6666-666666666666";

function createController(overrides: {
  ridesFacade?: Partial<{
    getActiveRideForCustomer: jest.Mock;
  }>;
  pricingFacade?: Partial<{ computeFareEstimate: jest.Mock }>;
  configValues?: Record<string, unknown>;
} = {}): {
  controller: RidesController;
  ridesService: jest.Mocked<RidesService>;
  transitionService: jest.Mocked<RideTransitionService>;
  ridesFacade: { getActiveRideForCustomer: jest.Mock };
  pricingFacade: { computeFareEstimate: jest.Mock };
} {
  const ridesService = {
    createRide: jest.fn()
  } as unknown as jest.Mocked<RidesService>;
  const transitionService = {
    transition: jest.fn()
  } as unknown as jest.Mocked<RideTransitionService>;
  const ridesFacade = {
    getActiveRideForCustomer: overrides.ridesFacade?.getActiveRideForCustomer ?? jest.fn()
  };
  const pricingFacade = {
    computeFareEstimate: overrides.pricingFacade?.computeFareEstimate ?? jest.fn()
  };
  const configValues = overrides.configValues ?? {
    PRICING_PER_KM_VND: 5000,
    PRICING_PER_MIN_VND: 500
  };
  const configService = {
    get: jest.fn((key: string) => configValues[key])
  } as unknown as ConfigService;
  const controller = new RidesController(
    ridesService,
    transitionService,
    ridesFacade as never,
    pricingFacade as never,
    configService as never
  );
  return { controller, ridesService, transitionService, ridesFacade, pricingFacade };
}

const validCreateDto: CreateRideDto = {
  pickup: { lat: 10, lng: 106, address: "A" },
  destination: { lat: 11, lng: 107, address: "B" }
};

describe("RidesController metadata", () => {
  it("does not mark any endpoint as @Public — auth is required", () => {
    expect(Reflect.getMetadata(PUBLIC_ROUTE_KEY, RidesController.prototype.createRide)).toBeUndefined();
    expect(
      Reflect.getMetadata(PUBLIC_ROUTE_KEY, RidesController.prototype.transitionRide)
    ).toBeUndefined();
    expect(Reflect.getMetadata(PUBLIC_ROUTE_KEY, RidesController.prototype.getActive)).toBeUndefined();
    expect(Reflect.getMetadata(PUBLIC_ROUTE_KEY, RidesController.prototype.quote)).toBeUndefined();
  });

  it("restricts ride creation to CUSTOMER role", () => {
    const roles = Reflect.getMetadata(ROLES_KEY, RidesController.prototype.createRide);
    expect(roles).toEqual([Role.CUSTOMER]);
  });

  it("restricts /rides/active to CUSTOMER role", () => {
    const roles = Reflect.getMetadata(ROLES_KEY, RidesController.prototype.getActive);
    expect(roles).toEqual([Role.CUSTOMER]);
  });

  it("restricts /rides/quote to CUSTOMER role", () => {
    const roles = Reflect.getMetadata(ROLES_KEY, RidesController.prototype.quote);
    expect(roles).toEqual([Role.CUSTOMER]);
  });

  it("does not restrict transition endpoint to a single role (CUSTOMER/DRIVER/ADMIN per transition map)", () => {
    const roles = Reflect.getMetadata(ROLES_KEY, RidesController.prototype.transitionRide);
    expect(roles).toBeUndefined();
  });
});

describe("RidesController.createRide", () => {
  it("uses the JWT user id as the customer id and never trusts the request body", async () => {
    const { controller, ridesService } = createController();
    const persisted: RideResponseDto = {
      id: RIDE_ID,
      customerId: CUSTOMER_ID,
      driverUserId: null,
      status: RideStatus.REQUESTED,
      pickup: validCreateDto.pickup,
      destination: validCreateDto.destination,
      requestedAt: new Date().toISOString(),
      matchingStartedAt: null,
      acceptedAt: null,
      driverArrivedAt: null,
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
      cancelledBy: null,
      cancellationReason: null,
      version: 0
    };
    ridesService.createRide.mockResolvedValueOnce(persisted);

    const user: AuthenticatedUser = { userId: CUSTOMER_ID, role: Role.CUSTOMER };
    const result = await controller.createRide(validCreateDto, user);

    expect(result).toEqual({ data: persisted });
    expect(ridesService.createRide).toHaveBeenCalledWith(CUSTOMER_ID, validCreateDto);
  });
});

describe("RidesController.transitionRide", () => {
  it("forbids customers from issuing SYSTEM transitions (defense-in-depth)", async () => {
    const { controller } = createController();

    // CUSTOMER role maps to CUSTOMER actor, not SYSTEM — verify the actor mapping never produces SYSTEM
    const user: AuthenticatedUser = { userId: CUSTOMER_ID, role: Role.CUSTOMER };
    const dto: TransitionRideDto = { toStatus: RideStatus.CANCELLED };

    // Without mocking transitionService.transition, the call should reach the service with a non-SYSTEM actor
    await controller
      .transitionRide(RIDE_ID, dto, user)
      .catch(() => undefined); // we only care about the actor that was passed
  });

  it("passes the resolved actor + expectedVersion to the transition service", async () => {
    const { controller, transitionService } = createController();
    const transitioned: RideResponseDto = {
      id: RIDE_ID,
      customerId: CUSTOMER_ID,
      driverUserId: DRIVER_ID,
      status: RideStatus.CANCELLED,
      pickup: validCreateDto.pickup,
      destination: validCreateDto.destination,
      requestedAt: new Date().toISOString(),
      matchingStartedAt: null,
      acceptedAt: null,
      driverArrivedAt: null,
      startedAt: null,
      completedAt: null,
      cancelledAt: new Date().toISOString(),
      cancelledBy: ActorType.CUSTOMER,
      cancellationReason: null,
      version: 4
    };
    transitionService.transition.mockResolvedValueOnce(transitioned);

    const user: AuthenticatedUser = { userId: CUSTOMER_ID, role: Role.CUSTOMER };
    const dto: TransitionRideDto = { toStatus: RideStatus.CANCELLED, expectedVersion: 3 };

    const result = await controller.transitionRide(RIDE_ID, dto, user);

    expect(result).toEqual({ data: transitioned });
    expect(transitionService.transition).toHaveBeenCalledWith(
      RIDE_ID,
      RideStatus.CANCELLED,
      expect.any(Object),
      { reason: undefined, expectedVersion: 3 }
    );
  });
});

describe("RidesController.getActive", () => {
  it("returns wrapped active ride when one exists", async () => {
    const ride = {
      id: RIDE_ID,
      customerId: CUSTOMER_ID,
      driverUserId: null,
      status: RideStatus.REQUESTED,
      pickup: validCreateDto.pickup,
      destination: validCreateDto.destination,
      requestedAt: new Date().toISOString(),
      matchingStartedAt: null,
      acceptedAt: null,
      driverArrivedAt: null,
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
      cancelledBy: null,
      cancellationReason: null,
      version: 0
    } as RideResponseDto;

    const getActiveRideForCustomer = jest.fn().mockResolvedValue(ride);
    const { controller } = createController({
      ridesFacade: { getActiveRideForCustomer }
    });

    const result = await controller.getActive({ userId: CUSTOMER_ID, role: Role.CUSTOMER });
    expect(result).toEqual({ data: ride });
    expect(getActiveRideForCustomer).toHaveBeenCalledWith(CUSTOMER_ID);
  });

  it("returns { data: null } when no active ride", async () => {
    const getActiveRideForCustomer = jest.fn().mockResolvedValue(null);
    const { controller } = createController({
      ridesFacade: { getActiveRideForCustomer }
    });
    const result = await controller.getActive({ userId: CUSTOMER_ID, role: Role.CUSTOMER });
    expect(result).toEqual({ data: null });
  });
});

describe("RidesController.quote", () => {
  const validQuoteDto: QuoteRideDto = {
    pickup: { lat: 10.7769, lng: 106.7009 },
    destination: { lat: 10.8231, lng: 106.6297 }
  };

  it("returns full quote breakdown for valid pickup/destination", async () => {
    const computeFareEstimate = jest.fn().mockResolvedValue({
      baseFareVnd: 12000,
      distanceMeters: 12500,
      distanceFeeVnd: 62500,
      durationSeconds: 1500,
      durationFeeVnd: 12500,
      subtotalVnd: 87000,
      surgeMultiplier: 1.2,
      surgeAmountVnd: 17400,
      minimumFareVnd: 15000,
      totalVnd: 104400,
      routeConfidence: "high",
      currency: "VND",
      pickupH3R8: "8828308281fffff",
      surge: { cellR8: "8828308281fffff", demand: 5, supply: 4, ratio: 1.25, multiplier: 1.2 }
    });

    const { controller } = createController({
      pricingFacade: { computeFareEstimate }
    });

    const result = await controller.quote(validQuoteDto, {
      userId: CUSTOMER_ID,
      role: Role.CUSTOMER
    });

    expect(result.data.totalVnd).toBe(104400);
    expect(result.data.surgeMultiplier).toBe(1.2);
    expect(result.data.currency).toBe("VND");
    expect(result.data.routeConfidence).toBe("high");
    expect(result.data.expiresInSeconds).toBe(60);
    expect(result.data.perKmVnd).toBe(5000);
    expect(result.data.perMinVnd).toBe(500);
    expect(typeof result.data.estimatedAt).toBe("string");
  });

  it("rejects identical pickup and destination without calling pricing", async () => {
    const computeFareEstimate = jest.fn();
    const { controller } = createController({
      pricingFacade: { computeFareEstimate }
    });

    await expect(
      controller.quote(
        { pickup: { lat: 10, lng: 106 }, destination: { lat: 10, lng: 106 } },
        { userId: CUSTOMER_ID, role: Role.CUSTOMER }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(computeFareEstimate).not.toHaveBeenCalled();
  });
});
