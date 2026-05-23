"use client";

import * as React from "react";

void React;

export interface StatusPillProps {
  state: "online" | "offline" | "loading";
}

export function StatusPill({ state }: StatusPillProps) {
  const label = state === "online" ? "Online" : state === "loading" ? "..." : "Offline";
  const cls =
    state === "online"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
      : state === "loading"
        ? "bg-surface-200 text-surface-600 dark:bg-surface-700 dark:text-surface-300"
        : "bg-surface-200 text-surface-700 dark:bg-surface-700 dark:text-surface-300";
  return (
    <span
      data-state={state}
      aria-label={`driver-status-${state}`}
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}
