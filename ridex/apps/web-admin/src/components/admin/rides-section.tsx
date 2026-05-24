"use client";

import type { DashboardRideCounts } from "@ridex/shared-types";
import * as React from "react";

import { MetricCard } from "./metric-card";

import { formatNumber } from "@/lib/format";

void React;

export interface RidesSectionProps {
  data: DashboardRideCounts | null;
  loading: boolean;
}

// "Active" is the headline number — the only non-cumulative metric and the
// one ops cares about for live load. The 24h breakdown sits beneath as the
// supporting context.
export function RidesSection({ data, loading }: RidesSectionProps) {
  return (
    <MetricCard
      title="Chuyến đi"
      badge="24h"
      loading={loading}
      data-section="rides"
      metrics={
        data === null
          ? []
          : [
              { label: "Đang hoạt động", value: formatNumber(data.active), emphasis: true },
              { label: "Hoàn thành 24h", value: formatNumber(data.completedLast24h) },
              { label: "Hủy 24h", value: formatNumber(data.cancelledLast24h) },
              {
                label: "Không có tài xế 24h",
                value: formatNumber(data.noDriversFoundLast24h)
              },
              { label: "Tổng 24h", value: formatNumber(data.totalLast24h) }
            ]
      }
    />
  );
}
