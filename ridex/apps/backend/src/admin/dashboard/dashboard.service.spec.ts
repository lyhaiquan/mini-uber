import type { DriversFacade } from "../../drivers/drivers.facade";
import type { PaymentsFacade } from "../../payments/payments.facade";
import type { RidesFacade } from "../../rides/rides.facade";
import { DashboardService } from "./dashboard.service";
import {
  DASHBOARD_WINDOW_HOURS,
  DASHBOARD_WINDOW_MS,
  PLACEHOLDER_SOURCE_FUTURE_TASK
} from "./placeholder.constants";

function createService(): {
  service: DashboardService;
  ridesFacade: jest.Mocked<RidesFacade>;
  driversFacade: jest.Mocked<DriversFacade>;
  paymentsFacade: jest.Mocked<PaymentsFacade>;
} {
  const ridesFacade = {
    getDashboardCounts: jest.fn().mockResolvedValue({
      active: 7,
      completedLast24h: 142,
      cancelledLast24h: 11,
      noDriversFoundLast24h: 3,
      totalLast24h: 156
    })
  } as unknown as jest.Mocked<RidesFacade>;
  const driversFacade = {
    getDriverPopulation: jest.fn().mockResolvedValue({ online: 23, totalRegistered: 95 })
  } as unknown as jest.Mocked<DriversFacade>;
  const paymentsFacade = {
    getDashboardStats: jest.fn().mockResolvedValue({
      successCountLast24h: 138,
      failureCountLast24h: 6,
      platformRevenueLast24hVnd: 4_250_000,
      platformRevenueAllTimeVnd: 18_750_000
    })
  } as unknown as jest.Mocked<PaymentsFacade>;
  return {
    service: new DashboardService(ridesFacade, driversFacade, paymentsFacade),
    ridesFacade,
    driversFacade,
    paymentsFacade
  };
}

describe("DashboardService", () => {
  it("assembles summary from all three facades in parallel", async () => {
    const { service, ridesFacade, driversFacade, paymentsFacade } = createService();

    const summary = await service.getSummary();

    expect(summary.rides.active).toBe(7);
    expect(summary.drivers.online).toBe(23);
    expect(summary.payments.successCountLast24h).toBe(138);
    expect(ridesFacade.getDashboardCounts).toHaveBeenCalledTimes(1);
    expect(driversFacade.getDriverPopulation).toHaveBeenCalledTimes(1);
    expect(paymentsFacade.getDashboardStats).toHaveBeenCalledTimes(1);
  });

  it("passes a 24h-ago Date to ride and payment facades", async () => {
    const { service, ridesFacade, paymentsFacade } = createService();
    const before = Date.now();

    await service.getSummary();

    const after = Date.now();
    const ridesSince = ridesFacade.getDashboardCounts.mock.calls[0]?.[0] as Date;
    const paymentsSince = paymentsFacade.getDashboardStats.mock.calls[0]?.[0] as Date;
    expect(ridesSince).toBeInstanceOf(Date);
    expect(paymentsSince).toBeInstanceOf(Date);
    expect(ridesSince.getTime()).toBeGreaterThanOrEqual(before - DASHBOARD_WINDOW_MS);
    expect(ridesSince.getTime()).toBeLessThanOrEqual(after - DASHBOARD_WINDOW_MS + 5);
    expect(paymentsSince.getTime()).toBe(ridesSince.getTime());
  });

  it("returns an ISO generatedAt and windowHours=24", async () => {
    const { service } = createService();

    const summary = await service.getSummary();

    expect(summary.windowHours).toBe(DASHBOARD_WINDOW_HOURS);
    expect(() => new Date(summary.generatedAt).toISOString()).not.toThrow();
    expect(new Date(summary.generatedAt).toISOString()).toBe(summary.generatedAt);
  });

  it("emits placeholders for matching duration and fraud alerts", async () => {
    const { service } = createService();

    const summary = await service.getSummary();

    expect(summary.placeholders.matchingDurationMs).toEqual({
      value: null,
      source: PLACEHOLDER_SOURCE_FUTURE_TASK
    });
    expect(summary.placeholders.fraudAlerts).toEqual({
      value: null,
      source: PLACEHOLDER_SOURCE_FUTURE_TASK
    });
  });

  it("returns zero counts when system is empty", async () => {
    const { service, ridesFacade, driversFacade, paymentsFacade } = createService();
    ridesFacade.getDashboardCounts.mockResolvedValue({
      active: 0,
      completedLast24h: 0,
      cancelledLast24h: 0,
      noDriversFoundLast24h: 0,
      totalLast24h: 0
    });
    driversFacade.getDriverPopulation.mockResolvedValue({ online: 0, totalRegistered: 0 });
    paymentsFacade.getDashboardStats.mockResolvedValue({
      successCountLast24h: 0,
      failureCountLast24h: 0,
      platformRevenueLast24hVnd: 0,
      platformRevenueAllTimeVnd: 0
    });

    const summary = await service.getSummary();

    expect(summary.rides.totalLast24h).toBe(0);
    expect(summary.drivers.totalRegistered).toBe(0);
    expect(summary.payments.platformRevenueAllTimeVnd).toBe(0);
  });
});
