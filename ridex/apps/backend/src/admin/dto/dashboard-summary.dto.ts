export interface DashboardPlaceholder {
  value: null;
  source: string;
}

export interface DashboardRideCountsDto {
  active: number;
  completedLast24h: number;
  cancelledLast24h: number;
  noDriversFoundLast24h: number;
  totalLast24h: number;
}

export interface DashboardDriverCountsDto {
  online: number;
  totalRegistered: number;
}

export interface DashboardPaymentStatsDto {
  successCountLast24h: number;
  failureCountLast24h: number;
  platformRevenueLast24hVnd: number;
  platformRevenueAllTimeVnd: number;
}

export interface DashboardPlaceholdersDto {
  matchingDurationMs: DashboardPlaceholder;
  fraudAlerts: DashboardPlaceholder;
}

export interface DashboardSummaryDto {
  generatedAt: string;
  windowHours: number;
  rides: DashboardRideCountsDto;
  drivers: DashboardDriverCountsDto;
  payments: DashboardPaymentStatsDto;
  placeholders: DashboardPlaceholdersDto;
}
