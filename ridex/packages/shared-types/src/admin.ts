import { z } from "zod";

import { isoDateTimeSchema } from "./common";

export const dashboardPlaceholderSchema = z.object({
  value: z.null(),
  source: z.string()
});

export const dashboardRideCountsSchema = z.object({
  active: z.number().int().min(0),
  completedLast24h: z.number().int().min(0),
  cancelledLast24h: z.number().int().min(0),
  noDriversFoundLast24h: z.number().int().min(0),
  totalLast24h: z.number().int().min(0)
});
export type DashboardRideCounts = z.infer<typeof dashboardRideCountsSchema>;

export const dashboardDriverCountsSchema = z.object({
  online: z.number().int().min(0),
  totalRegistered: z.number().int().min(0)
});
export type DashboardDriverCounts = z.infer<typeof dashboardDriverCountsSchema>;

export const dashboardPaymentStatsSchema = z.object({
  successCountLast24h: z.number().int().min(0),
  failureCountLast24h: z.number().int().min(0),
  platformRevenueLast24hVnd: z.number().int().min(0),
  platformRevenueAllTimeVnd: z.number().int().min(0)
});
export type DashboardPaymentStats = z.infer<typeof dashboardPaymentStatsSchema>;

export const dashboardPlaceholdersSchema = z.object({
  matchingDurationMs: dashboardPlaceholderSchema,
  fraudAlerts: dashboardPlaceholderSchema
});

export const dashboardSummarySchema = z.object({
  generatedAt: isoDateTimeSchema,
  windowHours: z.number().int().positive(),
  rides: dashboardRideCountsSchema,
  drivers: dashboardDriverCountsSchema,
  payments: dashboardPaymentStatsSchema,
  placeholders: dashboardPlaceholdersSchema
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
