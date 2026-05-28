"use client";

import type { DriverSummary } from "@ridex/shared-types";
import { Card, CardContent } from "@ridex/ui-web";

export interface DriverCardProps {
  driver: DriverSummary | null;
}

export function DriverCard({ driver }: DriverCardProps) {
  if (driver === null) {
    return (
      <Card>
        <CardContent className="space-y-1 p-4 text-sm text-surface-600 dark:text-surface-300">
          <p>Đang tìm tài xế gần bạn...</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-200 text-sm font-semibold uppercase dark:bg-surface-700">
          {driver.maskedEmail.charAt(0)}
        </div>
        <div className="text-sm">
          <p className="font-semibold">Tài xế của bạn</p>
          <p className="text-xs text-surface-600 dark:text-surface-400">{driver.maskedEmail}</p>
        </div>
      </CardContent>
    </Card>
  );
}
