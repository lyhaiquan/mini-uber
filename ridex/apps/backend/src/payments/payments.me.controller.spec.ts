import "reflect-metadata";

import { type ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { ROLES_KEY } from "../auth/guards/roles.decorator";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Role } from "../users/dto/role.enum";
import { PaymentStatus } from "./enums/payment-status.enum";
import { PaymentsMeController } from "./payments.me.controller";
import type { PaymentsFacade } from "./payments.facade";

const CUSTOMER_ID = "11111111-1111-1111-1111-111111111111";
const DRIVER_ID = "33333333-3333-3333-3333-333333333333";

describe("PaymentsMeController", () => {
  it("returns a zeroed wallet when no wallet row exists yet", async () => {
    const { controller, facade } = createController();
    facade.getWalletForUser.mockResolvedValue(null);

    const result = await controller.getWallet({ userId: CUSTOMER_ID, role: Role.CUSTOMER });

    expect(facade.getWalletForUser).toHaveBeenCalledWith(CUSTOMER_ID, "CUSTOMER");
    expect(result.data).toMatchObject({ kind: "CUSTOMER", balanceVnd: 0, currency: "VND" });
  });

  it("returns paginated self payment history", async () => {
    const { controller, facade } = createController();
    facade.getPaymentHistoryForUser.mockResolvedValue({
      items: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          rideId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          totalVnd: 100_000,
          driverShareVnd: 80_000,
          status: PaymentStatus.SUCCEEDED,
          createdAt: "2026-05-18T03:14:15.000Z",
          completedAt: "2026-05-18T03:20:15.000Z",
          failureReason: null,
          pickupAddress: "Ben Thanh",
          destinationAddress: "TSN"
        }
      ],
      total: 1
    });

    const result = await controller.getPayments(
      { userId: DRIVER_ID, role: Role.DRIVER },
      "2",
      "20"
    );

    expect(facade.getPaymentHistoryForUser).toHaveBeenCalledWith("DRIVER", DRIVER_ID, 2, 20);
    expect(result.meta).toEqual({ page: 2, pageSize: 20, total: 1 });
    expect(result.data[0].rideSummary.pickupAddress).toBe("Ben Thanh");
  });

  it("marks driver earnings endpoint as DRIVER-only", () => {
    expect(Reflect.getMetadata(ROLES_KEY, PaymentsMeController.prototype.getDriverEarnings)).toEqual([
      Role.DRIVER
    ]);

    const guard = new RolesGuard(new Reflector());
    expect(
      guard.canActivate(createContext({ userId: DRIVER_ID, role: Role.DRIVER }))
    ).toBe(true);
    expect(() =>
      guard.canActivate(createContext({ userId: CUSTOMER_ID, role: Role.CUSTOMER }))
    ).toThrow();
  });

  it("returns driver earnings aggregate with requested window", async () => {
    const { controller, facade } = createController();
    facade.getDriverEarnings.mockResolvedValue({
      tripsCompleted: 4,
      totalEarningsVnd: 280_000,
      byDay: [{ date: "2026-05-17", earningsVnd: 280_000, trips: 4 }]
    });

    const result = await controller.getDriverEarnings(
      { userId: DRIVER_ID, role: Role.DRIVER },
      "2026-05-11T00:00:00.000Z",
      "2026-05-18T00:00:00.000Z"
    );

    expect(facade.getDriverEarnings).toHaveBeenCalledWith(
      DRIVER_ID,
      new Date("2026-05-11T00:00:00.000Z"),
      new Date("2026-05-18T00:00:00.000Z")
    );
    expect(result.data.totalEarningsVnd).toBe(280_000);
  });

  it("rejects ADMIN wallet access", async () => {
    const { controller } = createController();
    await expect(
      controller.getWallet({
        userId: "55555555-5555-5555-5555-555555555555",
        role: Role.ADMIN
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

function createController(): {
  controller: PaymentsMeController;
  facade: jest.Mocked<PaymentsFacade>;
} {
  const facade = {
    getWalletForUser: jest.fn(),
    getPaymentHistoryForUser: jest.fn(),
    getDriverEarnings: jest.fn()
  } as unknown as jest.Mocked<PaymentsFacade>;
  return {
    controller: new PaymentsMeController(facade),
    facade
  };
}

function createContext(user: { userId: string; role: Role } | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: jest.fn(),
      getNext: jest.fn()
    }),
    getHandler: () => PaymentsMeController.prototype.getDriverEarnings,
    getClass: () => PaymentsMeController,
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
    getType: jest.fn()
  } as unknown as ExecutionContext;
}
