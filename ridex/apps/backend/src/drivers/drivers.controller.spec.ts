import "reflect-metadata";

import { type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { RolesGuard } from "../auth/guards/roles.guard";
import { ROLES_KEY } from "../auth/guards/roles.decorator";
import type { AuthenticatedUser } from "../auth/auth.types";
import { Role } from "../users/dto/role.enum";
import type { DriversFacade } from "./drivers.facade";
import { DriversController } from "./drivers.controller";

const DRIVER_ID = "33333333-3333-3333-3333-333333333333";
const CUSTOMER_ID = "11111111-1111-1111-1111-111111111111";

function createController(): {
  controller: DriversController;
  facade: jest.Mocked<DriversFacade>;
} {
  const facade = {
    setOnline: jest.fn(),
    setOffline: jest.fn(),
    getAvailability: jest.fn()
  } as unknown as jest.Mocked<DriversFacade>;
  return { controller: new DriversController(facade), facade };
}

function createContext(user: AuthenticatedUser): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: jest.fn(),
      getNext: jest.fn()
    }),
    getHandler: () => DriversController.prototype.goOnline,
    getClass: () => DriversController,
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn()
  } as unknown as ExecutionContext;
}

describe("DriversController", () => {
  it("marks all endpoints as DRIVER-only", () => {
    expect(Reflect.getMetadata(ROLES_KEY, DriversController)).toEqual([Role.DRIVER]);
  });

  it("goOnline uses the authenticated user id and returns void", async () => {
    const { controller, facade } = createController();

    await expect(
      controller.goOnline(
        { userId: DRIVER_ID, role: Role.DRIVER },
        { correlationId: "request-1", header: jest.fn() } as never
      )
    ).resolves.toBeUndefined();

    expect(facade.setOnline).toHaveBeenCalledWith(DRIVER_ID, "request-1");
  });

  it("goOffline uses the authenticated user id and returns void", async () => {
    const { controller, facade } = createController();

    await expect(
      controller.goOffline(
        { userId: DRIVER_ID, role: Role.DRIVER },
        { correlationId: "request-1", header: jest.fn() } as never
      )
    ).resolves.toBeUndefined();

    expect(facade.setOffline).toHaveBeenCalledWith(DRIVER_ID, "request-1");
  });

  it("getAvailability returns the standard data envelope", async () => {
    const { controller, facade } = createController();
    const availability = { isOnline: true, onlineSince: "2026-05-16T00:00:00.000Z", lastSeenAt: null };
    facade.getAvailability.mockResolvedValue(availability);

    await expect(
      controller.getAvailability({ userId: DRIVER_ID, role: Role.DRIVER })
    ).resolves.toEqual({ data: availability });
  });

  it("RolesGuard allows DRIVER and blocks CUSTOMER/ADMIN", () => {
    const reflector = new Reflector();
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext({ userId: DRIVER_ID, role: Role.DRIVER }))).toBe(true);
    expect(() =>
      guard.canActivate(createContext({ userId: CUSTOMER_ID, role: Role.CUSTOMER }))
    ).toThrow();
    expect(() =>
      guard.canActivate(createContext({ userId: CUSTOMER_ID, role: Role.ADMIN }))
    ).toThrow();
  });
});

