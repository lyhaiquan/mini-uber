"use client";

import type { DashboardSummary } from "@ridex/shared-types";
import * as React from "react";

import { MetricCard } from "./metric-card";

void React;

export interface PlaceholderSectionProps {
  data: DashboardSummary["placeholders"] | null;
  loading: boolean;
}

// The backend currently returns { value: null } for both metrics with the
// shape locked in by the schema. When a future task (e.g. observability)
// starts returning a number, the schema will need to relax and this card
// will pick up the value automatically — until then we show "Sắp ra mắt"
// so ops doesn't read the empty card as a data gap.
export function PlaceholderSection({ data, loading }: PlaceholderSectionProps) {
  const matchingValue = data?.matchingDurationMs.value ?? null;
  const fraudValue = data?.fraudAlerts.value ?? null;

  return (
    <MetricCard
      title="Sắp ra mắt"
      badge="placeholder"
      loading={loading}
      data-section="placeholders"
      metrics={[
        {
          label: "Thời lượng matching (ms)",
          value: matchingValue === null ? "Sắp ra mắt" : String(matchingValue)
        },
        {
          label: "Cảnh báo gian lận",
          value: fraudValue === null ? "Sắp ra mắt" : String(fraudValue)
        }
      ]}
    />
  );
}
