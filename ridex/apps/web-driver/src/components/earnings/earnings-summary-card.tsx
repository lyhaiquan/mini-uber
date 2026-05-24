"use client";

import { Button, Card, CardContent } from "@ridex/ui-web";

import type { EarningsWindow } from "@/hooks/use-earnings";

function formatVnd(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
  }).format(value);
}

export function EarningsSummaryCard(props: {
  window: EarningsWindow;
  onWindowChange: (window: EarningsWindow) => void;
  totalEarningsVnd: number;
  tripsCompleted: number;
}) {
  const windows: Array<{ id: EarningsWindow; label: string }> = [
    { id: "today", label: "Hôm nay" },
    { id: "week", label: "Tuần này" },
    { id: "month", label: "Tháng" }
  ];

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap gap-2">
          {windows.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant={props.window === item.id ? "default" : "outline"}
              onClick={() => props.onWindowChange(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold tracking-tight">
            {formatVnd(props.totalEarningsVnd)}
          </p>
          <p className="text-sm text-surface-600 dark:text-surface-300">
            {props.tripsCompleted} chuyến hoàn thành
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
