import type { ConfigService } from "@nestjs/config";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import type { DataSource, EntityManager } from "typeorm";

import {
  PAYMENT_FAILED_EVENT,
  PAYMENT_SUCCEEDED_EVENT
} from "../../common/events/event-types";
import type { StructuredLogger } from "../../common/logging/structured-logger";
import type { EnvironmentVariables } from "../../config/env.validation";
import type { PricingFacade } from "../../pricing/pricing.facade";
import { RideStatus } from "../../rides/enums/ride-status.enum";
import type { RidesFacade } from "../../rides/rides.facade";
import type { LedgerRepository } from "../ledger/ledger.repository";
import type { PaymentRepository } from "../payment/payment.repository";
import type { WalletRepository } from "../wallet/wallet.repository";
import type { FareSplitService } from "./fare-split.service";
import type { Payment } from "../entities/payment.entity";
import type { Wallet } from "../entities/wallet.entity";
import { PaymentStatus } from "../enums/payment-status.enum";
import { WalletKind } from "../enums/wallet-kind.enum";
import type { PaymentPricingSnapshot } from "../payments.types";
import { PaymentProcessorService } from "./payment-processor.service";

const RIDE_ID = "ride-1";
const CUSTOMER_ID = "customer-1";
const DRIVER_ID = "driver-1";
const IDEM_KEY = `auto:ride:${RIDE_ID}`;

describe("PaymentProcessorService", () => {
  it("charges customer, credits driver/platform, writes ledger, and emits success", async () => {
    const setup = createProcessor();

    const result = await setup.service.processRideCompletion(RIDE_ID);

    expect(result?.status).toBe(PaymentStatus.SUCCEEDED);
    expect(setup.wallets.customer.balanceVnd).toBe(400_000);
    expect(setup.wallets.driver.balanceVnd).toBe(80_000);
    expect(setup.wallets.platform.balanceVnd).toBe(20_000);
    expect(setup.walletRepository.saveAll).toHaveBeenCalledWith(
      [setup.wallets.customer, setup.wallets.driver, setup.wallets.platform],
      setup.manager
    );
    expect(setup.ledgerRepository.appendEntries).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ walletId: setup.wallets.customer.id, amountVnd: 100_000 }),
        expect.objectContaining({ walletId: setup.wallets.driver.id, amountVnd: 80_000 }),
        expect.objectContaining({ walletId: setup.wallets.platform.id, amountVnd: 20_000 })
      ]),
      setup.manager
    );
    expect(setup.eventEmitter.emit).toHaveBeenCalledWith(
      PAYMENT_SUCCEEDED_EVENT,
      expect.objectContaining({
        eventType: PAYMENT_SUCCEEDED_EVENT,
        emittedBy: "payments",
        payload: expect.objectContaining({ rideId: RIDE_ID, totalVnd: 100_000 })
      })
    );
  });

  it("returns existing payment on idempotent replay without opening a transaction", async () => {
    const existing = payment({ id: "existing", status: PaymentStatus.SUCCEEDED });
    const setup = createProcessor();
    setup.paymentRepository.findByIdempotencyKey.mockResolvedValueOnce(existing);

    await expect(setup.service.processRideCompletion(RIDE_ID)).resolves.toBe(existing);

    expect(setup.dataSource.transaction).not.toHaveBeenCalled();
  });

  it("handles concurrent duplicate insert by returning the existing row", async () => {
    const existing = payment({ id: "winner", status: PaymentStatus.SUCCEEDED });
    const setup = createProcessor();
    setup.paymentRepository.insertPending.mockRejectedValueOnce({ code: "23505" });
    setup.paymentRepository.findByIdempotencyKey
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);

    await expect(setup.service.processRideCompletion(RIDE_ID)).resolves.toBe(existing);

    expect(setup.ledgerRepository.appendEntries).not.toHaveBeenCalled();
    expect(setup.eventEmitter.emit).not.toHaveBeenCalled();
  });

  it("handles ride-level unique conflict when the idempotency key differs", async () => {
    const existing = payment({
      id: "winner",
      idempotencyKey: IDEM_KEY,
      status: PaymentStatus.SUCCEEDED
    });
    const setup = createProcessor();
    setup.paymentRepository.insertPending.mockRejectedValueOnce({ code: "23505" });
    setup.paymentRepository.findByIdempotencyKey.mockResolvedValue(null);
    setup.paymentRepository.findByRideId.mockResolvedValue(existing);

    await expect(
      setup.service.processRideCompletion(RIDE_ID, "manual:retry:different")
    ).resolves.toBe(existing);

    expect(setup.paymentRepository.findByRideId).toHaveBeenCalledWith(RIDE_ID);
    expect(setup.eventEmitter.emit).not.toHaveBeenCalled();
  });

  it("creates FAILED_INSUFFICIENT_BALANCE without ledger or balance changes", async () => {
    const setup = createProcessor();
    setup.wallets.customer.balanceVnd = 50_000;

    const result = await setup.service.processRideCompletion(RIDE_ID);

    expect(result?.status).toBe(PaymentStatus.FAILED_INSUFFICIENT_BALANCE);
    expect(setup.wallets.customer.balanceVnd).toBe(50_000);
    expect(setup.walletRepository.saveAll).not.toHaveBeenCalled();
    expect(setup.ledgerRepository.appendEntries).not.toHaveBeenCalled();
    expect(setup.eventEmitter.emit).toHaveBeenCalledWith(
      PAYMENT_FAILED_EVENT,
      expect.objectContaining({
        payload: expect.objectContaining({ status: PaymentStatus.FAILED_INSUFFICIENT_BALANCE })
      })
    );
  });

  it("creates FAILED_MISSING_SNAPSHOT when pricing snapshot is absent", async () => {
    const setup = createProcessor();
    setup.pricingFacade.getSnapshotForRide.mockResolvedValue(null);

    const result = await setup.service.processRideCompletion(RIDE_ID);

    expect(result?.status).toBe(PaymentStatus.FAILED_MISSING_SNAPSHOT);
    expect(setup.walletRepository.lockWalletsForPayment).not.toHaveBeenCalled();
    expect(setup.ledgerRepository.appendEntries).not.toHaveBeenCalled();
  });

  it("skips rides that are not COMPLETED", async () => {
    const setup = createProcessor();
    setup.ridesFacade.getRideForPayment.mockResolvedValue({
      id: RIDE_ID,
      customerId: CUSTOMER_ID,
      driverUserId: DRIVER_ID,
      status: RideStatus.IN_PROGRESS
    });

    await expect(setup.service.processRideCompletion(RIDE_ID)).resolves.toBeNull();
    expect(setup.dataSource.transaction).not.toHaveBeenCalled();
  });

  it("skips completed rides without driver assignment", async () => {
    const setup = createProcessor();
    setup.ridesFacade.getRideForPayment.mockResolvedValue({
      id: RIDE_ID,
      customerId: CUSTOMER_ID,
      driverUserId: null,
      status: RideStatus.COMPLETED
    });

    await expect(setup.service.processRideCompletion(RIDE_ID)).resolves.toBeNull();
    expect(setup.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: "payment.ride_completion.invalid_ride" }),
      undefined,
      "PaymentProcessorService"
    );
  });

  it("uses split rounding from FareSplitService", async () => {
    const setup = createProcessor({ totalVnd: 99 });
    setup.fareSplit.split.mockReturnValue({
      driverShareVnd: 79,
      platformShareVnd: 20,
      driverShareBps: 8000,
      platformShareBps: 2000
    });

    await setup.service.processRideCompletion(RIDE_ID);

    expect(setup.paymentRepository.insertPending).toHaveBeenCalledWith(
      expect.objectContaining({ totalVnd: 99, driverShareVnd: 79, platformShareVnd: 20 }),
      setup.manager
    );
  });

  it("rechecks idempotency inside transaction", async () => {
    const existing = payment({ id: "inside-existing" });
    const setup = createProcessor();
    setup.paymentRepository.findByIdempotencyKey
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);

    await expect(setup.service.processRideCompletion(RIDE_ID)).resolves.toBe(existing);

    expect(setup.paymentRepository.insertPending).not.toHaveBeenCalled();
  });

  it("does not emit events for in-transaction idempotent replay", async () => {
    const existing = payment({ id: "inside-existing" });
    const setup = createProcessor();
    setup.paymentRepository.findByIdempotencyKey
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);

    await setup.service.processRideCompletion(RIDE_ID);

    expect(setup.eventEmitter.emit).not.toHaveBeenCalled();
  });

  it("passes default auto idempotency key to inserts", async () => {
    const setup = createProcessor();

    await setup.service.processRideCompletion(RIDE_ID);

    expect(setup.paymentRepository.insertPending).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: IDEM_KEY }),
      setup.manager
    );
  });

  it("supports an explicit idempotency key", async () => {
    const setup = createProcessor();

    await setup.service.processRideCompletion(RIDE_ID, "manual:retry:1");

    expect(setup.paymentRepository.findByIdempotencyKey).toHaveBeenCalledWith("manual:retry:1");
    expect(setup.paymentRepository.insertPending).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "manual:retry:1" }),
      setup.manager
    );
  });

  it("does not write zero-amount ledger entries", async () => {
    const setup = createProcessor({ totalVnd: 0 });
    setup.fareSplit.split.mockReturnValue({
      driverShareVnd: 0,
      platformShareVnd: 0,
      driverShareBps: 8000,
      platformShareBps: 2000
    });

    await setup.service.processRideCompletion(RIDE_ID);

    expect(setup.ledgerRepository.appendEntries).toHaveBeenCalledWith([], setup.manager);
  });

  it("propagates unexpected transaction errors and emits nothing", async () => {
    const setup = createProcessor();
    setup.paymentRepository.insertPending.mockRejectedValueOnce(new Error("db down"));

    await expect(setup.service.processRideCompletion(RIDE_ID)).rejects.toThrow("db down");
    expect(setup.eventEmitter.emit).not.toHaveBeenCalled();
  });
});

function createProcessor(options: { totalVnd?: number } = {}) {
  const manager = {} as EntityManager;
  const dataSource = {
    transaction: jest.fn(async (callback: (manager: EntityManager) => Promise<unknown>) =>
      callback(manager)
    )
  } as unknown as jest.Mocked<DataSource>;
  const ridesFacade = {
    getRideForPayment: jest.fn().mockResolvedValue({
      id: RIDE_ID,
      customerId: CUSTOMER_ID,
      driverUserId: DRIVER_ID,
      status: RideStatus.COMPLETED
    })
  } as unknown as jest.Mocked<RidesFacade>;
  const pricingFacade = {
    getSnapshotForRide: jest.fn().mockResolvedValue(snapshot(options.totalVnd ?? 100_000))
  } as unknown as jest.Mocked<PricingFacade>;
  const wallets = {
    customer: wallet({ id: "wallet-customer", userId: CUSTOMER_ID, balanceVnd: 500_000 }),
    driver: wallet({ id: "wallet-driver", userId: DRIVER_ID, kind: WalletKind.DRIVER, balanceVnd: 0 }),
    platform: wallet({ id: "wallet-platform", userId: null, kind: WalletKind.PLATFORM, balanceVnd: 0 })
  };
  const walletRepository = {
    lockWalletsForPayment: jest.fn().mockResolvedValue({
      customerWallet: wallets.customer,
      driverWallet: wallets.driver,
      platformWallet: wallets.platform,
      lockOrderIds: ["wallet-customer", "wallet-driver", "wallet-platform"]
    }),
    saveAll: jest.fn().mockResolvedValue([])
  } as unknown as jest.Mocked<WalletRepository>;
  const paymentRepository = {
    findByIdempotencyKey: jest.fn().mockResolvedValue(null),
    findByRideId: jest.fn().mockResolvedValue(null),
    insertPending: jest.fn(async (input) => payment({ ...input, id: "payment-1" })),
    transitionStatus: jest.fn(async (paymentRow: Payment, status: PaymentStatus, _manager, reason) =>
      payment({
        ...paymentRow,
        status,
        failureReason: reason ?? null,
        completedAt: status === PaymentStatus.SUCCEEDED ? new Date() : null
      })
    )
  } as unknown as jest.Mocked<PaymentRepository>;
  const ledgerRepository = {
    appendEntries: jest.fn().mockResolvedValue([])
  } as unknown as jest.Mocked<LedgerRepository>;
  const fareSplit = {
    split: jest.fn().mockReturnValue({
      driverShareVnd: Math.floor(((options.totalVnd ?? 100_000) * 8000) / 10_000),
      platformShareVnd:
        (options.totalVnd ?? 100_000) -
        Math.floor(((options.totalVnd ?? 100_000) * 8000) / 10_000),
      driverShareBps: 8000,
      platformShareBps: 2000
    })
  } as unknown as jest.Mocked<FareSplitService>;
  const eventEmitter = {
    emit: jest.fn()
  } as unknown as jest.Mocked<EventEmitter2>;
  const logger = {
    log: jest.fn(),
    error: jest.fn()
  } as unknown as jest.Mocked<StructuredLogger>;
  const configService = {
    get: jest.fn().mockReturnValue(500_000)
  } as unknown as ConfigService<EnvironmentVariables, true>;

  return {
    service: new PaymentProcessorService(
      dataSource,
      ridesFacade,
      pricingFacade,
      walletRepository,
      paymentRepository,
      ledgerRepository,
      fareSplit,
      eventEmitter,
      logger,
      configService
    ),
    manager,
    dataSource,
    ridesFacade,
    pricingFacade,
    walletRepository,
    paymentRepository,
    ledgerRepository,
    fareSplit,
    eventEmitter,
    logger,
    wallets
  };
}

function snapshot(totalVnd: number): PaymentPricingSnapshot {
  return {
    id: "snapshot-1",
    totalVnd
  };
}

function wallet(overrides: Partial<Wallet>): Wallet {
  return {
    id: "wallet",
    userId: "user",
    kind: WalletKind.CUSTOMER,
    currency: "VND",
    balanceVnd: 0,
    version: 0,
    createdAt: new Date("2026-05-17T00:00:00.000Z"),
    updatedAt: new Date("2026-05-17T00:00:00.000Z"),
    ...overrides
  };
}

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "payment",
    rideId: RIDE_ID,
    pricingSnapshotId: "snapshot-1",
    idempotencyKey: IDEM_KEY,
    status: PaymentStatus.PENDING,
    customerUserId: CUSTOMER_ID,
    driverUserId: DRIVER_ID,
    currency: "VND",
    totalVnd: 100_000,
    driverShareVnd: 80_000,
    platformShareVnd: 20_000,
    driverShareBps: 8000,
    platformShareBps: 2000,
    failureReason: null,
    createdAt: new Date("2026-05-17T00:00:00.000Z"),
    completedAt: null,
    ...overrides
  };
}
