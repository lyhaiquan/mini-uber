"use client";

import { Card, CardContent } from "@ridex/ui-web";

function formatVnd(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(value);
}

export function BalanceCard({ balanceVnd }: { balanceVnd: number }) {
  return (
    <Card>
      <CardContent className="space-y-2 p-6 text-center">
        <p className="text-sm text-surface-600 dark:text-surface-300">Số dư ví tài xế</p>
        <p className="text-3xl font-bold tracking-tight">{formatVnd(balanceVnd)}</p>
      </CardContent>
    </Card>
  );
}
