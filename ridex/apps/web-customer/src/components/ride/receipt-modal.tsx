"use client";

import type { PricingSummary } from "@ridex/shared-types";
import { Button } from "@ridex/ui-web";
import * as React from "react";

void React;

const vnd = new Intl.NumberFormat("vi-VN");

export interface ReceiptModalProps {
  open: boolean;
  pricing: PricingSummary | null;
  onClose: () => void;
}

export function ReceiptModal({ open, pricing, onClose }: ReceiptModalProps) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-surface-900">
        <h2 id="receipt-title" className="text-lg font-semibold">
          Chuyến đi hoàn tất
        </h2>
        {pricing === null ? (
          <p className="mt-2 text-sm text-surface-600 dark:text-surface-300">
            Đang tổng hợp hóa đơn...
          </p>
        ) : (
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Quãng đường" value={`${(pricing.distanceMeters / 1000).toFixed(2)} km`} />
            <Row
              label="Thời gian"
              value={`${Math.round(pricing.durationSeconds / 60)} phút`}
            />
            {pricing.surgeMultiplier > 1 ? (
              <Row
                label="Hệ số giờ cao điểm"
                value={`x${pricing.surgeMultiplier.toFixed(2)}`}
              />
            ) : null}
            <Row label="Thanh toán" value="Ví RideX" />
            <div className="my-2 h-px bg-surface-200 dark:bg-surface-700" />
            <Row label="Tổng" value={`${vnd.format(pricing.totalVnd)} ₫`} strong />
          </dl>
        )}
        <div className="mt-6 flex justify-end">
          <Button onClick={onClose} type="button">
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-surface-600 dark:text-surface-300">{label}</dt>
      <dd className={strong ? "font-semibold" : ""}>{value}</dd>
    </div>
  );
}
