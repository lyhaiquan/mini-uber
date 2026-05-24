"use client";

import { Card, CardContent } from "@ridex/ui-web";
import * as React from "react";

import { useEarnings } from "@/hooks/use-earnings";

void React;

function formatCompactVnd(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `${Number.isInteger(m) ? String(m) : m.toFixed(1)}M ₫`;
  }
  if (value >= 1_000) return `${Math.round(value / 1_000)}K ₫`;
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(value);
}

export function EarningsStrip() {
  const { data, isLoading } = useEarnings("today");

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-3 text-sm">
        <span className="text-surface-600 dark:text-surface-300">Hôm nay</span>
        {isLoading ? (
          <span className="text-surface-400">...</span>
        ) : (
          <span className="font-semibold">
            {formatCompactVnd(data?.totalEarningsVnd ?? 0)} · {data?.tripsCompleted ?? 0} chuyến
          </span>
        )}
      </CardContent>
    </Card>
  );
}
