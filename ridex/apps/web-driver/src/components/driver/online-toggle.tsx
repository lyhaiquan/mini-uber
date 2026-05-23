"use client";

import * as React from "react";

void React;

export interface OnlineToggleProps {
  state: "online" | "offline" | "going-online" | "going-offline";
  // Disabled covers permission-denied: we can't honor GO without a fix.
  disabled?: boolean;
  onGo: () => void;
  onStop: () => void;
}

export function OnlineToggle({ state, disabled, onGo, onStop }: OnlineToggleProps) {
  const isOnline = state === "online" || state === "going-offline";
  const isBusy = state === "going-online" || state === "going-offline";

  const label = isBusy
    ? state === "going-online"
      ? "Đang bật..."
      : "Đang tắt..."
    : isOnline
      ? "STOP"
      : "GO";

  // Big circular button per spec. Green/pulsing while online, gray while
  // offline. The pulse helper class is plain Tailwind animate-pulse which is
  // already available across the design system.
  const colorClass = isOnline
    ? "bg-emerald-600 hover:bg-emerald-700 animate-pulse"
    : "bg-surface-400 hover:bg-surface-500";

  return (
    <button
      type="button"
      onClick={() => (isOnline ? onStop() : onGo())}
      disabled={disabled === true || isBusy}
      data-state={state}
      aria-label={`driver-online-toggle-${state}`}
      className={`inline-flex h-32 w-32 items-center justify-center rounded-full text-2xl font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-60 ${colorClass}`}
    >
      {label}
    </button>
  );
}
