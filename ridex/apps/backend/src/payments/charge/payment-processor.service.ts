import { randomUUID } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { DataSource, type EntityManager } from "typeorm";

import type { DomainEvent } from "../../common/domain-event";
import {
  PAYMENT_FAILED_EVENT,
  PAYMENT_SUCCEEDED_EVENT
} from "../../common/events/event-types";
import { StructuredLogger } from "../../common/logging/structured-logger";
import type { EnvironmentVariables } from "../../config/env.validation";
import { PricingFacade } from "../../pricing/pricing.facade";
import { RideStatus } from "../../rides/enums/ride-status.enum";
import { RidesFacade } from "../../rides/rides.facade";
import { LedgerEntryType } from "../enums/ledger-entry-type.enum";
import { PaymentStatus } from "../enums/payment-status.enum";
import { AUTO_RIDE_IDEMPOTENCY_PREFIX, PAYMENT_PROCESSOR_CONTEXT } from "../payments.constants";
import type {
  PaymentFailurePayload,
  PaymentPricingSnapshot,
  PaymentSucceededPayload
} from "../payments.types";
import { LedgerRepository } from "../ledger/ledger.repository";
import type { Payment } from "../entities/payment.entity";
import { PaymentRepository } from "../payment/payment.repository";
import { WalletRepository } from "../wallet/wallet.repository";
import { FareSplitService } from "./fare-split.service";

@Injectable()
export class PaymentProcessorService {
  private readonly walletSeedVnd: number;

  constructor(
    private readonly dataSource: DataSource,
    private readonly ridesFacade: RidesFacade,
    private readonly pricingFacade: PricingFacade,
    private readonly walletRepository: WalletRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly ledgerRepository: LedgerRepository,
    private readonly fareSplit: FareSplitService,
    private readonly eventEmitter: EventEmitter2,
    private readonly logger: StructuredLogger,
    configService: ConfigService<EnvironmentVariables, true>
  ) {
    this.walletSeedVnd = configService.get("PAYMENT_WALLET_SEED_VND", { infer: true });
  }

  async processRideCompletion(
    rideId: string,
    idempotencyKey = `${AUTO_RIDE_IDEMPOTENCY_PREFIX}${rideId}`
  ): Promise<Payment | null> {
    const existing = await this.paymentRepository.findByIdempotencyKey(idempotencyKey);
    if (existing !== null) {
      return existing;
    }

    const ride = await this.ridesFacade.getRideForPayment(rideId);
    if (ride === null || ride.status !== RideStatus.COMPLETED) {
      this.logger.log(
        { event: "payment.ride_completion.skipped", rideId, reason: "not_completed" },
        PAYMENT_PROCESSOR_CONTEXT
      );
      return null;
    }

    if (ride.driverUserId === null) {
      this.logger.error(
        { event: "payment.ride_completion.invalid_ride", rideId, reason: "missing_driver" },
        undefined,
        PAYMENT_PROCESSOR_CONTEXT
      );
      return null;
    }
    const driverUserId = ride.driverUserId;

    const snapshot = await this.pricingFacade.getSnapshotForRide(rideId);
    const result = await this.runIdempotentTransaction(rideId, idempotencyKey, async (manager) => {
      if (snapshot === null) {
        return this.createMissingSnapshotFailure(
          rideId,
          idempotencyKey,
          ride.customerId,
          driverUserId,
          manager
        );
      }

      return this.createPaymentFromSnapshot(
        rideId,
        idempotencyKey,
        ride.customerId,
        driverUserId,
        snapshot,
        manager
      );
    });

    if (result.created) {
      this.emitPaymentEvent(result.payment);
    }

    return result.payment;
  }

  private async runIdempotentTransaction(
    rideId: string,
    idempotencyKey: string,
    operation: (
      manager: EntityManager
    ) => Promise<{ payment: Payment; created: boolean }>
  ): Promise<{ payment: Payment; created: boolean }> {
    try {
      return await this.dataSource.transaction(async (manager) => operation(manager));
    } catch (error: unknown) {
      if (!isUniqueViolation(error)) {
        throw error;
      }

      const existing = await this.paymentRepository.findByIdempotencyKey(idempotencyKey);
      if (existing === null) {
        const paymentForRide = await this.paymentRepository.findByRideId(rideId);
        if (paymentForRide === null) {
          throw error;
        }
        return { payment: paymentForRide, created: false };
      }
      return { payment: existing, created: false };
    }
  }

  private async createMissingSnapshotFailure(
    rideId: string,
    idempotencyKey: string,
    customerUserId: string,
    driverUserId: string,
    manager: EntityManager
  ): Promise<{ payment: Payment; created: boolean }> {
    const existing = await this.paymentRepository.findByIdempotencyKey(
      idempotencyKey,
      manager,
      true
    );
    if (existing !== null) {
      return { payment: existing, created: false };
    }

    const payment = await this.paymentRepository.insertPending(
      {
        rideId,
        pricingSnapshotId: null,
        idempotencyKey,
        status: PaymentStatus.FAILED_MISSING_SNAPSHOT,
        customerUserId,
        driverUserId,
        totalVnd: 0,
        driverShareVnd: 0,
        platformShareVnd: 0,
        driverShareBps: 0,
        platformShareBps: 0,
        failureReason: "pricing_snapshot_missing"
      },
      manager
    );
    return { payment, created: true };
  }

  private async createPaymentFromSnapshot(
    rideId: string,
    idempotencyKey: string,
    customerUserId: string,
    driverUserId: string,
    snapshot: PaymentPricingSnapshot,
    manager: EntityManager
  ): Promise<{ payment: Payment; created: boolean }> {
    const split = this.fareSplit.split(snapshot.totalVnd);

    const existing = await this.paymentRepository.findByIdempotencyKey(
      idempotencyKey,
      manager,
      true
    );
    if (existing !== null) {
      return { payment: existing, created: false };
    }

    const wallets = await this.walletRepository.lockWalletsForPayment(
      customerUserId,
      driverUserId,
      this.walletSeedVnd,
      manager
    );
    const payment = await this.paymentRepository.insertPending(
      {
        rideId,
        pricingSnapshotId: snapshot.id,
        idempotencyKey,
        status: PaymentStatus.PENDING,
        customerUserId,
        driverUserId,
        totalVnd: snapshot.totalVnd,
        ...split
      },
      manager
    );

    if (wallets.customerWallet.balanceVnd < snapshot.totalVnd) {
      const failed = await this.paymentRepository.transitionStatus(
        payment,
        PaymentStatus.FAILED_INSUFFICIENT_BALANCE,
        manager,
        "insufficient_balance"
      );
      return { payment: failed, created: true };
    }

    wallets.customerWallet.balanceVnd -= snapshot.totalVnd;
    wallets.driverWallet.balanceVnd += split.driverShareVnd;
    wallets.platformWallet.balanceVnd += split.platformShareVnd;
    await this.walletRepository.saveAll(
      [wallets.customerWallet, wallets.driverWallet, wallets.platformWallet],
      manager
    );

    await this.ledgerRepository.appendEntries(
      [
        {
          paymentId: payment.id,
          walletId: wallets.customerWallet.id,
          entryType: LedgerEntryType.DEBIT,
          amountVnd: snapshot.totalVnd,
          balanceAfterVnd: wallets.customerWallet.balanceVnd,
          memo: "Ride payment"
        },
        {
          paymentId: payment.id,
          walletId: wallets.driverWallet.id,
          entryType: LedgerEntryType.CREDIT,
          amountVnd: split.driverShareVnd,
          balanceAfterVnd: wallets.driverWallet.balanceVnd,
          memo: "Ride earning"
        },
        {
          paymentId: payment.id,
          walletId: wallets.platformWallet.id,
          entryType: LedgerEntryType.CREDIT,
          amountVnd: split.platformShareVnd,
          balanceAfterVnd: wallets.platformWallet.balanceVnd,
          memo: "Platform fee"
        }
      ].filter((entry) => entry.amountVnd > 0),
      manager
    );

    const succeeded = await this.paymentRepository.transitionStatus(
      payment,
      PaymentStatus.SUCCEEDED,
      manager
    );
    return { payment: succeeded, created: true };
  }

  private emitPaymentEvent(payment: Payment): void {
    if (payment.status === PaymentStatus.SUCCEEDED) {
      const event: DomainEvent<PaymentSucceededPayload> = {
        eventId: randomUUID(),
        eventType: PAYMENT_SUCCEEDED_EVENT,
        aggregateType: "payment",
        aggregateId: payment.id,
        payload: {
          paymentId: payment.id,
          rideId: payment.rideId,
          totalVnd: payment.totalVnd,
          driverShareVnd: payment.driverShareVnd,
          platformShareVnd: payment.platformShareVnd
        },
        correlationId: randomUUID(),
        occurredAt: new Date().toISOString(),
        emittedBy: "payments"
      };
      this.eventEmitter.emit(PAYMENT_SUCCEEDED_EVENT, event);
      return;
    }

    if (
      payment.status === PaymentStatus.FAILED_INSUFFICIENT_BALANCE ||
      payment.status === PaymentStatus.FAILED_MISSING_SNAPSHOT
    ) {
      const event: DomainEvent<PaymentFailurePayload> = {
        eventId: randomUUID(),
        eventType: PAYMENT_FAILED_EVENT,
        aggregateType: "payment",
        aggregateId: payment.id,
        payload: {
          paymentId: payment.id,
          rideId: payment.rideId,
          status: payment.status,
          reason: payment.failureReason ?? payment.status
        },
        correlationId: randomUUID(),
        occurredAt: new Date().toISOString(),
        emittedBy: "payments"
      };
      this.eventEmitter.emit(PAYMENT_FAILED_EVENT, event);
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const maybeError = error as { code?: unknown; driverError?: { code?: unknown } };
  return maybeError.code === "23505" || maybeError.driverError?.code === "23505";
}
