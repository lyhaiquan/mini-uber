import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { Role } from "../../users/dto/role.enum";
import type { AuthenticatedUser } from "../auth.types";
import { ROLES_KEY } from "./roles.decorator";
import { RolesGuard } from "./roles.guard";

function createContext(user: AuthenticatedUser | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: jest.fn(),
      getNext: jest.fn()
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn()
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  it("allows access when no roles metadata is set", () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(undefined);
    const guard = new RolesGuard(reflector);

    expect(
      guard.canActivate(createContext({ userId: "u1", role: Role.CUSTOMER }))
    ).toBe(true);
  });

  it("denies access when user is missing", () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue([Role.ADMIN]);
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(createContext(undefined))).toThrow(ForbiddenException);
  });

  it("denies access when user has insufficient role", () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue([Role.ADMIN]);
    const guard = new RolesGuard(reflector);

    expect(() =>
      guard.canActivate(createContext({ userId: "u1", role: Role.CUSTOMER }))
    ).toThrow(ForbiddenException);
  });

  it("allows access when user role matches one of the required roles", () => {
    const reflector = new Reflector();
    jest
      .spyOn(reflector, "getAllAndOverride")
      .mockReturnValue([Role.DRIVER, Role.ADMIN]);
    const guard = new RolesGuard(reflector);

    expect(
      guard.canActivate(createContext({ userId: "u1", role: Role.DRIVER }))
    ).toBe(true);
  });

  it("reads metadata using the expected key", () => {
    const reflector = new Reflector();
    const spy = jest.spyOn(reflector, "getAllAndOverride").mockReturnValue([Role.ADMIN]);
    const guard = new RolesGuard(reflector);

    expect(() =>
      guard.canActivate(createContext({ userId: "u1", role: Role.ADMIN }))
    ).not.toThrow();

    expect(spy).toHaveBeenCalledWith(ROLES_KEY, expect.any(Array));
  });
});
