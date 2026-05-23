"use client";

import type { QuoteResponse } from "@ridex/shared-types";
import { Card, CardContent, Skeleton } from "@ridex/ui-web";
import * as React from "react";

void React;

interface Props {
  quote?: QuoteResponse;
  loading?: boolean;
}

export function roundUpVnd(vnd: number): number {
  return Math.ceil(vnd / 1000) * 1000;
}

export function formatVnd(vnd: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(vnd)} ₫`;
}

export function FareEstimateCard({ quote, loading }: Props) {
  if (loading === true || quote === undefined) {
    return (
      <Card>
        <CardContent className="space-y-3 p-4" data-testid="fare-card-skeleton">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  const display = roundUpVnd(quote.totalVnd);
  const distanceKm = (quote.distanceMeters / 1000).toFixed(1);
  const durationMin = Math.round(quote.durationSeconds / 60);

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-3xl font-semibold tabular-nums">
            {formatVnd(display)}
          </span>
          {quote.surgeMultiplier > 1 ? (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
              Giờ cao điểm ×{quote.surgeMultiplier.toFixed(1)}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-surface-700 dark:text-surface-300">
          {distanceKm} km · ~{durationMin} phút · Base {formatVnd(quote.baseFareVnd)}
        </p>
        {quote.routeConfidence === "low" ? (
          <p className="text-xs italic text-surface-500">
            Ước tính có thể chênh do dịch vụ định tuyến tạm thời gián đoạn.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
