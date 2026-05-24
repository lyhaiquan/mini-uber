"use client";

import { useQuery } from "@tanstack/react-query";

import { paymentsApi } from "@/lib/api";

export type EarningsWindow = "today" | "week" | "month";

export function useEarnings(window: EarningsWindow) {
  const { from, to } = getWindowRange(window);
  return useQuery({
    queryKey: ["earnings", window, from, to] as const,
    queryFn: () => paymentsApi.getDriverEarnings({ from, to }),
    staleTime: 30_000
  });
}

export function getWindowRange(window: EarningsWindow): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  if (window === "today") {
    from.setHours(0, 0, 0, 0);
  } else if (window === "week") {
    from.setDate(from.getDate() - 7);
  } else {
    from.setDate(from.getDate() - 30);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}
