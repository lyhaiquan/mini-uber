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
      <CardContent className="space-y-3 p-6 text-center">
        <p className="text-sm text-surface-600 dark:text-surface-300">Số dư hiện tại</p>
        <p className="text-3xl font-bold tracking-tight">{formatVnd(balanceVnd)}</p>
        <p className="text-xs text-surface-500 dark:text-surface-400">
          Nạp tiền sẽ được bổ sung ở bước sau.
        </p>
      </CardContent>
    </Card>
  );
}
