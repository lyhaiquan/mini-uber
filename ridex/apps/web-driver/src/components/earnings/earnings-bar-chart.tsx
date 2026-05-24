"use client";

import * as React from "react";

void React;

export function EarningsBarChart(props: {
  data: Array<{ date: string; earningsVnd: number; trips: number }>;
}) {
  if (props.data.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-surface-200 p-6 dark:border-surface-800">
        <p className="text-sm text-surface-500 dark:text-surface-400">Chưa có dữ liệu trong kỳ này</p>
      </div>
    );
  }

  const max = Math.max(1, ...props.data.map((item) => item.earningsVnd));

  return (
    <div className="rounded-xl border border-surface-200 p-4 dark:border-surface-800">
      <div className="flex h-44 items-end gap-3">
        {props.data.map((item) => (
          <div key={item.date} className="flex flex-1 flex-col items-center gap-2">
            <div className="text-[11px] text-surface-500">{item.trips}</div>
            <div className="flex h-32 w-full items-end">
              <div
                className="w-full rounded-t-md bg-emerald-500"
                style={{ height: `${Math.max(8, (item.earningsVnd / max) * 100)}%` }}
                title={`${item.date}: ${item.earningsVnd}`}
              />
            </div>
            <div className="text-[11px] text-surface-600 dark:text-surface-300">
              {item.date.slice(5)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
