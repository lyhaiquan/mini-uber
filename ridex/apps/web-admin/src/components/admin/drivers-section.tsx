"use client";

import type { DashboardDriverCounts } from "@ridex/shared-types";
import * as React from "react";

import { MetricCard } from "./metric-card";

import { formatNumber } from "@/lib/format";

void React;

export interface DriversSectionProps {
  data: DashboardDriverCounts | null;
  loading: boolean;
}

// Online is the operational signal — totalRegistered is mostly background
// context, so it sits in the supporting row beneath.
export function DriversSection({ data, loading }: DriversSectionProps) {
  return (
    <MetricCard
      title="Tài xế"
      loading={loading}
      data-section="drivers"
      metrics={
        data === null
          ? []
          : [
              { label: "Đang online", value: formatNumber(data.online), emphasis: true },
              { label: "Tổng đăng ký", value: formatNumber(data.totalRegistered) }
            ]
      }
    />
  );
}
