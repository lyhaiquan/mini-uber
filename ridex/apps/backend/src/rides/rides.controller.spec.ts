import "reflect-metadata";

import { ROLES_KEY } from "../auth/guards/roles.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PUBLIC_ROUTE_KEY } from "../common/decorators/public.decorator";
import { Role } from "../users/dto/role.enum";
import type { CreateRideDto } from "./dto/create-ride.dto";
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

function createController(): {
  controller: RidesController;
  ridesService: jest.Mocked<RidesService>;
  transitionService: jest.Mocked<RideTransitionService>;
} {
  const ridesService = {
    createRide: jest.fn()
  } as unknown as jest.Mocked<RidesService>;
  const transitionService = {
    transition: jest.fn()
  } as unknown as jest.Mocked<RideTransitionService>;
  const controller = new RidesController(ridesService, transitionService);
  return { controller, ridesService, transitionService };
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
  });

  it("restricts ride creation to CUSTOMER role", () => {
    const roles = Reflect.getMetadata(ROLES_KEY, RidesController.prototype.createRide);
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
    const expected: Partial<RideResponseDto> = {
      id: RIDE_ID,
      customerId: CUSTOMER_ID,
      status: RideStatus.REQUESTED
    };
    ridesService.createRide.mockResolvedValue(expected as RideResponseDto);

    const user: AuthenticatedUser = { userId: CUSTOMER_ID, role: Role.CUSTOMER };
    const result = await controller.createRide(validCreateDto, user);

    expect(ridesService.createRide).toHaveBeenCalledWith(CUSTOMER_ID, validCreateDto);
    expect(result.data).toBe(expected);
  });
});

describe("RidesController.transitionRide", () => {
  it("derives actor type from JWT role (CUSTOMER)", async () => {
    const { controller, transitionService } = createController();
    transitionService.transition.mockResolvedValue({} as RideResponseDto);

    const dto: TransitionRideDto = { toStatus: RideStatus.CANCELLED, reason: "x" };
    const user: AuthenticatedUser = { userId: CUSTOMER_ID, role: Role.CUSTOMER };

    await controller.transitionRide(RIDE_ID, dto, user);

    expect(transitionService.transition).toHaveBeenCalledWith(
      RIDE_ID,
      RideStatus.CANCELLED,
      { type: ActorType.CUSTOMER, userId: CUSTOMER_ID },
      { reason: "x", expectedVersion: undefined }
    );
  });

  it("derives actor type from JWT role (DRIVER)", async () => {
    const { controller, transitionService } = createController();
    transitionService.transition.mockResolvedValue({} as RideResponseDto);

    const dto: TransitionRideDto = { toStatus: RideStatus.IN_PROGRESS };
    const user: AuthenticatedUser = { userId: DRIVER_ID, role: Role.DRIVER };

    await controller.transitionRide(RIDE_ID, dto, user);

    expect(transitionService.transition).toHaveBeenCalledWith(
      RIDE_ID,
      RideStatus.IN_PROGRESS,
      { type: ActorType.DRIVER, userId: DRIVER_ID },
      { reason: undefined, expectedVersion: undefined }
    );
  });

  it("passes REQUESTED through to the state machine (no controller-level special-case)", async () => {
    // REQUESTED has no inbound transition in the allowed map, so the service
    // will raise RIDE_INVALID_STATE (HTTP 409). The controller must not
    // short-circuit this with a 400 BadRequest — the error taxonomy is locked
    // by the state machine, not the HTTP layer.
    const { controller, transitionService } = createController();
    transitionService.transition.mockResolvedValue({} as RideResponseDto);
    const user: AuthenticatedUser = { userId: CUSTOMER_ID, role: Role.CUSTOMER };

    await controller.transitionRide(
      RIDE_ID,
      { toStatus: RideStatus.REQUESTED },
      user
    );

    expect(transitionService.transition).toHaveBeenCalledWith(
      RIDE_ID,
      RideStatus.REQUESTED,
      expect.any(Object),
      { reason: undefined, expectedVersion: undefined }
    );
  });

  it("forwards expectedVersion when provided", async () => {
    const { controller, transitionService } = createController();
    transitionService.transition.mockResolvedValue({} as RideResponseDto);

    const user: AuthenticatedUser = { userId: CUSTOMER_ID, role: Role.CUSTOMER };

    await controller.transitionRide(
      RIDE_ID,
      { toStatus: RideStatus.CANCELLED, expectedVersion: 3 },
      user
    );

    expect(transitionService.transition).toHaveBeenCalledWith(
      RIDE_ID,
      RideStatus.CANCELLED,
      expect.any(Object),
      { reason: undefined, expectedVersion: 3 }
    );
  });
});
