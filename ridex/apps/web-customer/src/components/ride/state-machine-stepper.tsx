"use client";

import type { RideStatus } from "@ridex/shared-types";
import * as React from "react";

void React;

// Order matches the happy-path of allowed_transitions. CANCELLED and
// NO_DRIVERS_FOUND short-circuit the stepper — they are surfaced as error chips
// instead of progressing through the rail.
const STEPS: { status: RideStatus; label: string }[] = [
  { status: "REQUESTED", label: "Yêu cầu" },
  { status: "MATCHING", label: "Tìm tài xế" },
  { status: "ACCEPTED", label: "Đã nhận chuyến" },
  { status: "IN_PROGRESS", label: "Đang đi" },
  { status: "COMPLETED", label: "Hoàn tất" }
];

export interface StateMachineStepperProps {
  status: RideStatus;
}

export function StateMachineStepper({ status }: StateMachineStepperProps) {
  if (status === "CANCELLED" || status === "NO_DRIVERS_FOUND") {
    return (
      <div
        role="status"
        aria-label={status === "CANCELLED" ? "ride-cancelled" : "no-drivers-found"}
        className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-300"
      >
        {status === "CANCELLED" ? "Chuyến đi đã hủy." : "Không tìm thấy tài xế."}
      </div>
    );
  }

  // DRIVER_ARRIVED is collapsed into the ACCEPTED step on the rail — it would
  // bloat the visualization without adding signal a customer can act on.
  const effective: RideStatus = status === "DRIVER_ARRIVED" ? "ACCEPTED" : status;
  const currentIndex = STEPS.findIndex((s) => s.status === effective);

  return (
    <ol aria-label="ride-progress" className="flex items-center gap-2">
      {STEPS.map((step, index) => {
        const isPast = index < currentIndex;
        const isCurrent = index === currentIndex;
        const colorClass = isPast
          ? "bg-emerald-500 text-white"
          : isCurrent
            ? "bg-blue-600 text-white"
            : "bg-surface-200 text-surface-500 dark:bg-surface-700 dark:text-surface-400";
        return (
          <li
            key={step.status}
            aria-current={isCurrent ? "step" : undefined}
            data-status={step.status}
            data-state={isPast ? "past" : isCurrent ? "current" : "future"}
            className="flex flex-1 items-center gap-2"
          >
            <span
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${colorClass}`}
            >
              {isPast ? "✓" : index + 1}
            </span>
            <span className="hidden text-xs text-surface-700 dark:text-surface-300 sm:inline">
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
