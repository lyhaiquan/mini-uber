import type { EntityManager } from "typeorm";

import type { RideStatus } from "../rides/enums/ride-status.enum";
import type { Role } from "../users/dto/role.enum";
import type { Wallet } from "./entities/wallet.entity";
import type { LedgerEntryType } from "./enums/ledger-entry-type.enum";
import type { PaymentStatus } from "./enums/payment-status.enum";

export interface RidePaymentSummary {
  id: string;
  customerId: string;
  driverUserId: string | null;
  status: RideStatus;
}

export interface FareSplit {
  driverShareVnd: number;
  platformShareVnd: number;
  driverShareBps: number;
  platformShareBps: number;
}

export interface LedgerEntryDraft {
  paymentId: string;
  walletId: string;
  entryType: LedgerEntryType;
  amountVnd: number;
  balanceAfterVnd: number;
  memo: string;
}

export interface InsertPaymentInput extends FareSplit {
  rideId: string;
  pricingSnapshotId: string | null;
  idempotencyKey: string;
  status: PaymentStatus;
  customerUserId: string;
  driverUserId: string;
  totalVnd: number;
  failureReason?: string | null;
}

export interface LockedWallets {
  customerWallet: Wallet;
  driverWallet: Wallet;
  platformWallet: Wallet;
  lockOrderIds: string[];
}

export interface AuthUserCreatedPayload {
  userId: string;
  role: Role;
}

export interface PaymentFailurePayload {
  paymentId: string;
  rideId: string;
  status: PaymentStatus;
  reason: string;
}

export interface PaymentSucceededPayload {
  paymentId: string;
  rideId: string;
  totalVnd: number;
  driverShareVnd: number;
  platformShareVnd: number;
}

export type PaymentTransaction = EntityManager;
export interface PaymentPricingSnapshot {
  id: string;
  totalVnd: number;
}

export interface PaymentHistoryRow {
  id: string;
  rideId: string;
  totalVnd: number;
  driverShareVnd: number;
  status: PaymentStatus;
  createdAt: string;
  completedAt: string | null;
  failureReason: string | null;
  pickupAddress: string;
  destinationAddress: string;
}

export interface PaymentHistoryResult {
  items: PaymentHistoryRow[];
  total: number;
}

export interface DriverEarningsByDayRow {
  date: string;
  earningsVnd: number;
  trips: number;
}

export interface DriverEarningsAggregate {
  tripsCompleted: number;
  totalEarningsVnd: number;
  byDay: DriverEarningsByDayRow[];
}
