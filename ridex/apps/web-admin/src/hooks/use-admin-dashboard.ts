"use client";

import { useQuery } from "@tanstack/react-query";

import { adminApi } from "@/lib/api";

export const adminKeys = {
  all: ["admin"] as const,
  dashboardSummary: () => [...adminKeys.all, "dashboard", "summary"] as const
};

export function useAdminDashboardSummary() {
  return useQuery({
    queryKey: adminKeys.dashboardSummary(),
    queryFn: () => adminApi.getDashboardSummary(),
    refetchInterval: 30_000
  });
}
