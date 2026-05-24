"use client";

import type { PaymentHistoryItem } from "@ridex/shared-types";
import { Card, CardContent } from "@ridex/ui-web";
import * as React from "react";

void React;

function formatVnd(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export function TransactionItem({ item }: { item: PaymentHistoryItem }) {
  const label =
    item.status === "SUCCEEDED" ? `-${formatVnd(item.totalVnd)}` : "Lỗi thanh toán";

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium">
              {item.rideSummary.pickupAddress} → {item.rideSummary.destinationAddress}
            </p>
            <p className="text-sm text-surface-600 dark:text-surface-300">
              {formatDate(item.createdAt)}
            </p>
          </div>
          <p
            className={
              item.status === "SUCCEEDED"
                ? "font-semibold text-rose-600"
                : "font-semibold text-amber-600"
            }
          >
            {label}
          </p>
        </div>
        {item.failureReason !== null ? (
          <p className="text-sm text-amber-700 dark:text-amber-300">{item.failureReason}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
