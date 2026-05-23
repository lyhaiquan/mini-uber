"use client";

import { Button } from "@ridex/ui-web";
import type { RideStatus } from "@ridex/shared-types";
import * as React from "react";

void React;

export interface TransitionButtonProps {
  status: RideStatus;
  pending: boolean;
  onTransition: (next: Exclude<RideStatus, "REQUESTED" | "MATCHING">) => void;
}

// Driver-side state machine: ACCEPTED → DRIVER_ARRIVED → IN_PROGRESS → COMPLETED.
// Any other status (REQUESTED/MATCHING happen before assignment, CANCELLED
// /NO_DRIVERS_FOUND are terminal) shows nothing — the parent should be
// rendering a "ride ended" UI instead.
export function TransitionButton({
  status,
  pending,
  onTransition
}: TransitionButtonProps) {
  switch (status) {
    case "ACCEPTED":
      return (
        <Button
          type="button"
          disabled={pending}
          onClick={() => onTransition("DRIVER_ARRIVED")}
        >
          {pending ? "..." : "Đã đến điểm đón"}
        </Button>
      );
    case "DRIVER_ARRIVED":
      return (
        <Button
          type="button"
          disabled={pending}
          onClick={() => onTransition("IN_PROGRESS")}
        >
          {pending ? "..." : "Bắt đầu chuyến"}
        </Button>
      );
    case "IN_PROGRESS":
      return (
        <Button
          type="button"
          disabled={pending}
          onClick={() => onTransition("COMPLETED")}
        >
          {pending ? "..." : "Hoàn thành"}
        </Button>
      );
    default:
      return null;
  }
}
