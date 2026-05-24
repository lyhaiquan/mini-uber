import type { Payment } from "./entities/payment.entity";
import type { Wallet } from "./entities/wallet.entity";
import { WalletKind } from "./enums/wallet-kind.enum";
import type { PaymentRepository } from "./payment/payment.repository";
import { PaymentsFacade } from "./payments.facade";
import type { WalletRepository } from "./wallet/wallet.repository";

describe("PaymentsFacade", () => {
  it("delegates getDashboardStats to repository.aggregateDashboardStats", async () => {
    const { facade, paymentRepository } = createFacade();
    const stats = {
      successCountLast24h: 138,
      failureCountLast24h: 6,
      platformRevenueLast24hVnd: 4_250_000,
      platformRevenueAllTimeVnd: 18_750_000
    };
    paymentRepository.aggregateDashboardStats.mockResolvedValue(stats);
    const since = new Date("2026-05-17T03:14:15.000Z");

    await expect(facade.getDashboardStats(since)).resolves.toBe(stats);
    expect(paymentRepository.aggregateDashboardStats).toHaveBeenCalledWith(since);
  });

  it("returns payment for ride via repository", async () => {
    const { facade, paymentRepository } = createFacade();
    paymentRepository.findByRideId.mockResolvedValue({ id: "payment-1" } as Payment);

    await expect(facade.getPaymentForRide("ride-1")).resolves.toMatchObject({ id: "payment-1" });
    expect(paymentRepository.findByRideId).toHaveBeenCalledWith("ride-1");
  });

  it("returns wallet for user and kind via repository", async () => {
    const { facade, walletRepository } = createFacade();
    walletRepository.getWalletForUser.mockResolvedValue({ id: "wallet-1" } as Wallet);

    await expect(facade.getWalletForUser("user-1", WalletKind.CUSTOMER)).resolves.toMatchObject({
      id: "wallet-1"
    });
    expect(walletRepository.getWalletForUser).toHaveBeenCalledWith("user-1", WalletKind.CUSTOMER);
  });

  it("delegates payment history lookup to repository", async () => {
    const { facade, paymentRepository } = createFacade();
    paymentRepository.getPaymentHistoryForUser.mockResolvedValue({ items: [], total: 0 });

    await expect(
      facade.getPaymentHistoryForUser("CUSTOMER", "user-1", 1, 20)
    ).resolves.toEqual({ items: [], total: 0 });
    expect(paymentRepository.getPaymentHistoryForUser).toHaveBeenCalledWith(
      "CUSTOMER",
      "user-1",
      1,
      20
    );
  });

  it("delegates driver earnings lookup to repository", async () => {
    const { facade, paymentRepository } = createFacade();
    const from = new Date("2026-05-11T00:00:00.000Z");
    const to = new Date("2026-05-18T00:00:00.000Z");
    paymentRepository.aggregateDriverEarnings.mockResolvedValue({
      tripsCompleted: 4,
      totalEarningsVnd: 280_000,
      byDay: []
    });

    await expect(facade.getDriverEarnings("driver-1", from, to)).resolves.toEqual({
      tripsCompleted: 4,
      totalEarningsVnd: 280_000,
      byDay: []
    });
    expect(paymentRepository.aggregateDriverEarnings).toHaveBeenCalledWith("driver-1", from, to);
  });
});

function createFacade(): {
  facade: PaymentsFacade;
  paymentRepository: jest.Mocked<PaymentRepository>;
  walletRepository: jest.Mocked<WalletRepository>;
} {
  const paymentRepository = {
    findByRideId: jest.fn(),
    aggregateDashboardStats: jest.fn(),
    getPaymentHistoryForUser: jest.fn(),
    aggregateDriverEarnings: jest.fn()
  } as unknown as jest.Mocked<PaymentRepository>;
  const walletRepository = {
    getWalletForUser: jest.fn()
  } as unknown as jest.Mocked<WalletRepository>;
  return {
    facade: new PaymentsFacade(paymentRepository, walletRepository),
    paymentRepository,
    walletRepository
  };
}
