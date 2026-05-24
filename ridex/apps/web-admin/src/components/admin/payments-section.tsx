"use client";

import type { DashboardPaymentStats } from "@ridex/shared-types";
import * as React from "react";

import { MetricCard } from "./metric-card";

import { formatCompactVnd, formatNumber, formatVnd } from "@/lib/format";

void React;

export interface PaymentsSectionProps {
  data: DashboardPaymentStats | null;
  loading: boolean;
}

// Revenue 24h is the live signal; all-time uses the compact "M ₫" formatter
// so a multi-million-đồng number doesn't blow the card width. Success vs
// failure counts live beneath as a single combined row to save vertical space.
export function PaymentsSection({ data, loading }: PaymentsSectionProps) {
  return (
    <MetricCard
      title="Thanh toán"
      loading={loading}
      data-section="payments"
      metrics={
        data === null
          ? []
          : [
              {
                label: "Doanh thu 24h",
                value: formatVnd(data.platformRevenueLast24hVnd),
                emphasis: true
              },
              {
                label: "Doanh thu tổng",
                value: formatCompactVnd(data.platformRevenueAllTimeVnd)
              },
              {
                label: "Thành công 24h",
                value: formatNumber(data.successCountLast24h)
              },
              {
                label: "Lỗi 24h",
                value: formatNumber(data.failureCountLast24h)
              }
            ]
      }
    />
  );
}
