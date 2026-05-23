import { Injectable } from "@nestjs/common";

import { DriversFacade } from "../../drivers/drivers.facade";
import { PaymentsFacade } from "../../payments/payments.facade";
import { RidesFacade } from "../../rides/rides.facade";
import type { DashboardSummaryDto } from "../dto/dashboard-summary.dto";
import {
  DASHBOARD_WINDOW_HOURS,
  DASHBOARD_WINDOW_MS,
  PLACEHOLDER_SOURCE_FUTURE_TASK
} from "./placeholder.constants";

@Injectable()
export class DashboardService {
  constructor(
    private readonly ridesFacade: RidesFacade,
    private readonly driversFacade: DriversFacade,
    private readonly paymentsFacade: PaymentsFacade
  ) {}

  async getSummary(): Promise<DashboardSummaryDto> {
    const now = new Date();
    const since = new Date(now.getTime() - DASHBOARD_WINDOW_MS);

    const [rides, drivers, payments] = await Promise.all([
      this.ridesFacade.getDashboardCounts(since),
      this.driversFacade.getDriverPopulation(),
      this.paymentsFacade.getDashboardStats(since)
    ]);

    return {
      generatedAt: now.toISOString(),
      windowHours: DASHBOARD_WINDOW_HOURS,
      rides,
      drivers,
      payments,
      placeholders: {
        matchingDurationMs: { value: null, source: PLACEHOLDER_SOURCE_FUTURE_TASK },
        fraudAlerts: { value: null, source: PLACEHOLDER_SOURCE_FUTURE_TASK }
      }
    };
  }
}
