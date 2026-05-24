import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Query
} from "@nestjs/common";

import type { AuthenticatedUser } from "../auth/auth.types";
import { Roles } from "../auth/guards/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Role } from "../users/dto/role.enum";
import { WalletKind } from "./enums/wallet-kind.enum";
import { PaymentsFacade } from "./payments.facade";

@Controller("me")
export class PaymentsMeController {
  constructor(private readonly paymentsFacade: PaymentsFacade) {}

  @Get("wallet")
  async getWallet(
    @CurrentUser() user: AuthenticatedUser
  ): Promise<{
    data: {
      kind: "CUSTOMER" | "DRIVER";
      balanceVnd: number;
      currency: "VND";
      lastUpdatedAt: string;
    };
  }> {
    const kind = walletKindForRole(user.role);
    const wallet = await this.paymentsFacade.getWalletForUser(user.userId, kind);
    return {
      data: wallet === null
        ? {
            kind,
            balanceVnd: 0,
            currency: "VND",
            lastUpdatedAt: new Date().toISOString()
          }
        : {
            kind,
            balanceVnd: Math.max(0, wallet.balanceVnd),
            currency: "VND",
            lastUpdatedAt: wallet.updatedAt.toISOString()
          }
    };
  }

  @Get("payments")
  async getPayments(
    @CurrentUser() user: AuthenticatedUser,
    @Query("page") pageQuery?: string,
    @Query("pageSize") pageSizeQuery?: string
  ): Promise<{
    data: Array<{
      id: string;
      rideId: string;
      totalVnd: number;
      driverShareVnd: number;
      status: string;
      createdAt: string;
      completedAt: string | null;
      failureReason: string | null;
      rideSummary: { pickupAddress: string; destinationAddress: string };
    }>;
    meta: { page: number; pageSize: number; total: number };
  }> {
    const role = listRoleForUser(user.role);
    const page = parsePositiveInt(pageQuery, 1, "page");
    const pageSize = Math.min(parsePositiveInt(pageSizeQuery, 20, "pageSize"), 100);
    const result = await this.paymentsFacade.getPaymentHistoryForUser(
      role,
      user.userId,
      page,
      pageSize
    );

    return {
      data: result.items.map((item) => ({
        id: item.id,
        rideId: item.rideId,
        totalVnd: item.totalVnd,
        driverShareVnd: item.driverShareVnd,
        status: item.status,
        createdAt: item.createdAt,
        completedAt: item.completedAt,
        failureReason: item.failureReason,
        rideSummary: {
          pickupAddress: item.pickupAddress,
          destinationAddress: item.destinationAddress
        }
      })),
      meta: { page, pageSize, total: result.total }
    };
  }

  @Get("driver/earnings")
  @Roles(Role.DRIVER)
  async getDriverEarnings(
    @CurrentUser() user: AuthenticatedUser,
    @Query("from") fromQuery?: string,
    @Query("to") toQuery?: string
  ): Promise<{
    data: {
      windowFrom: string;
      windowTo: string;
      tripsCompleted: number;
      totalEarningsVnd: number;
      byDay: Array<{ date: string; earningsVnd: number; trips: number }>;
    };
  }> {
    const to = parseDateOrDefault(toQuery, new Date(), "to");
    const from = parseDateOrDefault(
      fromQuery,
      new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000),
      "from"
    );
    if (from.getTime() >= to.getTime()) {
      throw new BadRequestException({
        code: "PAYMENT_INVALID_RANGE",
        message: "from phải sớm hơn to."
      });
    }

    const earnings = await this.paymentsFacade.getDriverEarnings(user.userId, from, to);
    return {
      data: {
        windowFrom: from.toISOString(),
        windowTo: to.toISOString(),
        tripsCompleted: earnings.tripsCompleted,
        totalEarningsVnd: earnings.totalEarningsVnd,
        byDay: earnings.byDay
      }
    };
  }
}

function walletKindForRole(role: Role): WalletKind.CUSTOMER | WalletKind.DRIVER {
  if (role === Role.CUSTOMER) return WalletKind.CUSTOMER;
  if (role === Role.DRIVER) return WalletKind.DRIVER;
  throw new ForbiddenException({
    code: "PAYMENT_FORBIDDEN",
    message: "Role này không có ví cá nhân."
  });
}

function listRoleForUser(role: Role): "CUSTOMER" | "DRIVER" {
  if (role === Role.CUSTOMER) return "CUSTOMER";
  if (role === Role.DRIVER) return "DRIVER";
  throw new ForbiddenException({
    code: "PAYMENT_FORBIDDEN",
    message: "Role này không có lịch sử thanh toán cá nhân."
  });
}

function parsePositiveInt(input: string | undefined, fallback: number, field: string): number {
  if (input === undefined) return fallback;
  const value = Number.parseInt(input, 10);
  if (!Number.isFinite(value) || value < 1) {
    throw new BadRequestException({
      code: "PAYMENT_INVALID_PAGINATION",
      message: `${field} phải là số nguyên dương.`
    });
  }
  return value;
}

function parseDateOrDefault(input: string | undefined, fallback: Date, field: string): Date {
  if (input === undefined) return fallback;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException({
      code: "PAYMENT_INVALID_DATE",
      message: `${field} phải là ISO-8601 hợp lệ.`
    });
  }
  return date;
}
