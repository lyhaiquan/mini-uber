import "reflect-metadata";

import { type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { ROLES_KEY } from "../auth/guards/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { AuthenticatedUser } from "../auth/auth.types";
import type { StructuredLogger } from "../common/logging/structured-logger";
import type { RequestWithCorrelationId } from "../common/request-context";
import { Role } from "../users/dto/role.enum";
import { AdminController } from "./admin.controller";
import type { DashboardService } from "./dashboard/dashboard.service";
import type { DashboardSummaryDto } from "./dto/dashboard-summary.dto";

const ADMIN_ID = "55555555-5555-5555-5555-555555555555";
const CUSTOMER_ID = "11111111-1111-1111-1111-111111111111";
const DRIVER_ID = "33333333-3333-3333-3333-333333333333";
const REQUEST = { correlationId: "request-1" } as RequestWithCorrelationId;

function createController(): {
  controller: AdminController;
  dashboardService: jest.Mocked<DashboardService>;
  logger: jest.Mocked<StructuredLogger>;
} {
  const dashboardService = {
    getSummary: jest.fn()
  } as unknown as jest.Mocked<DashboardService>;
  const logger = {
    log: jest.fn()
  } as unknown as jest.Mocked<StructuredLogger>;
  return {
    controller: new AdminController(dashboardService, logger),
    dashboardService,
    logger
  };
}

function createContext(user: AuthenticatedUser | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: jest.fn(),
      getNext: jest.fn()
    }),
    getHandler: () => AdminController.prototype.getSummary,
    getClass: () => AdminController,
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn()
  } as unknown as ExecutionContext;
}

function makeSummary(): DashboardSummaryDto {
  return {
    generatedAt: "2026-05-18T03:14:15.000Z",
    windowHours: 24,
    rides: {
      active: 7,
      completedLast24h: 142,
      cancelledLast24h: 11,
      noDriversFoundLast24h: 3,
      totalLast24h: 156
    },
    drivers: { online: 23, totalRegistered: 95 },
    payments: {
      successCountLast24h: 138,
      failureCountLast24h: 6,
      platformRevenueLast24hVnd: 4_250_000,
      platformRevenueAllTimeVnd: 18_750_000
    },
    placeholders: {
      matchingDurationMs: { value: null, source: "future-task" },
      fraudAlerts: { value: null, source: "future-task" }
    }
  };
}

describe("AdminController", () => {
  it("marks the controller as ADMIN-only via the Roles decorator", () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminController)).toEqual([Role.ADMIN]);
  });

  it("getSummary returns the dashboard payload wrapped in data envelope", async () => {
    const { controller, dashboardService } = createController();
    const summary = makeSummary();
    dashboardService.getSummary.mockResolvedValue(summary);

    await expect(
      controller.getSummary({ userId: ADMIN_ID, role: Role.ADMIN }, REQUEST)
    ).resolves.toEqual({ data: summary });
  });

  it("logs an admin.dashboard.accessed audit event with the userId and correlationId", async () => {
    const { controller, dashboardService, logger } = createController();
    dashboardService.getSummary.mockResolvedValue(makeSummary());

    await controller.getSummary({ userId: ADMIN_ID, role: Role.ADMIN }, REQUEST);

    expect(logger.log).toHaveBeenCalledWith(
      { event: "admin.dashboard.accessed", userId: ADMIN_ID, correlationId: "request-1" },
      "AdminController"
    );
  });

  it("RolesGuard allows ADMIN and blocks CUSTOMER/DRIVER/unauthenticated", () => {
    const reflector = new Reflector();
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext({ userId: ADMIN_ID, role: Role.ADMIN }))).toBe(true);
    expect(() =>
      guard.canActivate(createContext({ userId: CUSTOMER_ID, role: Role.CUSTOMER }))
    ).toThrow();
    expect(() =>
      guard.canActivate(createContext({ userId: DRIVER_ID, role: Role.DRIVER }))
    ).toThrow();
    expect(() => guard.canActivate(createContext(undefined))).toThrow();
  });
});
