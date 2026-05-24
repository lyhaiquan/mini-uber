import { Injectable } from "@nestjs/common";

import type { Payment } from "./entities/payment.entity";
import type { Wallet } from "./entities/wallet.entity";
import type { WalletKind } from "./enums/wallet-kind.enum";
import { PaymentRepository, type PaymentDashboardStats } from "./payment/payment.repository";
import type { DriverEarningsAggregate, PaymentHistoryResult } from "./payments.types";
import { WalletRepository } from "./wallet/wallet.repository";

export type { PaymentDashboardStats } from "./payment/payment.repository";

@Injectable()
export class PaymentsFacade {
  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly walletRepository: WalletRepository
  ) {}

  async getPaymentForRide(rideId: string): Promise<Payment | null> {
    return this.paymentRepository.findByRideId(rideId);
  }

  async getWalletForUser(userId: string, kind: WalletKind): Promise<Wallet | null> {
    return this.walletRepository.getWalletForUser(userId, kind);
  }

  async getDashboardStats(since: Date): Promise<PaymentDashboardStats> {
    return this.paymentRepository.aggregateDashboardStats(since);
  }

  async getPaymentHistoryForUser(
    role: "CUSTOMER" | "DRIVER",
    userId: string,
    page: number,
    pageSize: number
  ): Promise<PaymentHistoryResult> {
    return this.paymentRepository.getPaymentHistoryForUser(role, userId, page, pageSize);
  }

  async getDriverEarnings(
    driverUserId: string,
    from: Date,
    to: Date
  ): Promise<DriverEarningsAggregate> {
    return this.paymentRepository.aggregateDriverEarnings(driverUserId, from, to);
  }
}
