"use client";

import * as React from "react";

import { formatRelativeFromNow } from "@/lib/format";

void React;

export interface LastUpdatedPillProps {
  // dataUpdatedAt from useQuery — 0 means "no successful fetch yet" and the
  // pill renders a neutral state instead of "0s trước".
  dataUpdatedAt: number;
}

export function getLastUpdatedLabel(dataUpdatedAt: number, now: number): string {
  return dataUpdatedAt === 0
    ? "Chưa có dữ liệu"
    : `Cập nhật ${formatRelativeFromNow(dataUpdatedAt, now)}`;
}

// Re-renders every second so the relative time stays current without a
// query refetch. Cheap: one setInterval per pill instance, cleaned up on
// unmount.
export function LastUpdatedPill({ dataUpdatedAt }: LastUpdatedPillProps) {
  const [now, setNow] = React.useState<number>(() => Date.now());

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  const label = getLastUpdatedLabel(dataUpdatedAt, now);

  return (
    <span
      aria-label="dashboard-last-updated"
      data-data-updated-at={dataUpdatedAt}
      className="inline-flex items-center rounded-full bg-surface-100 px-3 py-1 text-xs text-surface-700 dark:bg-surface-800 dark:text-surface-300"
    >
      {label}
    </span>
  );
}
