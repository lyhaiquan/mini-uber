"use client";

import { useQuery } from "@tanstack/react-query";

import { adminApi } from "@/lib/api";

export const adminKeys = {
  all: ["admin"] as const,
  dashboardSummary: () => [...adminKeys.all, "dashboard", "summary"] as const
};

export const ADMIN_DASHBOARD_REFETCH_INTERVAL_MS = 30_000;

export function useAdminDashboardSummary() {
  return useQuery({
    queryKey: adminKeys.dashboardSummary(),
    queryFn: () => adminApi.getDashboardSummary(),
    refetchInterval: ADMIN_DASHBOARD_REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: true
  });
}
