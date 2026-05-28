import type { RideStatus } from "@ridex/shared-types";
import { Button } from "@ridex/ui-mobile";
import * as React from "react";

void React;

export interface TransitionButtonProps {
  status: RideStatus;
  pending: boolean;
  onTransition: (next: Exclude<RideStatus, "REQUESTED" | "MATCHING">) => void;
}

// Mirrors the web TransitionButton: ACCEPTED -> DRIVER_ARRIVED -> IN_PROGRESS ->
// COMPLETED. Terminal and pre-assignment statuses render nothing.
export function TransitionButton({
  status,
  pending,
  onTransition
}: TransitionButtonProps) {
  switch (status) {
    case "ACCEPTED":
      return (
        <Button
          accessibilityLabel="driver-transition-arrived"
          onPress={() => onTransition("DRIVER_ARRIVED")}
          disabled={pending}
        >
          {pending ? "..." : "Đã đến điểm đón"}
        </Button>
      );
    case "DRIVER_ARRIVED":
      return (
        <Button
          accessibilityLabel="driver-transition-start"
          onPress={() => onTransition("IN_PROGRESS")}
          disabled={pending}
        >
          {pending ? "..." : "Bắt đầu chuyến"}
        </Button>
      );
    case "IN_PROGRESS":
      return (
        <Button
          accessibilityLabel="driver-transition-complete"
          onPress={() => onTransition("COMPLETED")}
          disabled={pending}
        >
          {pending ? "..." : "Hoàn thành"}
        </Button>
      );
    default:
      return null;
  }
}
