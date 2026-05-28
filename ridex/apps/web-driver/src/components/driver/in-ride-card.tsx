"use client";

import type { RideDetailResponse, RideStatus } from "@ridex/shared-types";
import { Card, CardContent } from "@ridex/ui-web";

import { TransitionButton } from "./transition-button";

export interface InRideCardProps {
  ride: RideDetailResponse;
  transitionPending: boolean;
  onTransition: (next: Exclude<RideStatus, "REQUESTED" | "MATCHING">) => void;
}

const STATUS_LABEL: Record<RideStatus, string> = {
  REQUESTED: "Đang yêu cầu",
  MATCHING: "Đang tìm tài xế",
  ACCEPTED: "Đã nhận chuyến",
  DRIVER_ARRIVED: "Đã đến điểm đón",
  IN_PROGRESS: "Đang chở khách",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
  NO_DRIVERS_FOUND: "Không có tài xế"
};

// Bottom card on the in-ride screen. Shows the current status, the customer's
// pickup/destination addresses, and the single CTA that drives the state
// machine forward. Customer identity is intentionally not surfaced beyond
// what the spec allows (masked) — backend returns ride.driver but the
// driver side already knows themselves.
export function InRideCard({ ride, transitionPending, onTransition }: InRideCardProps) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-semibold">{STATUS_LABEL[ride.status]}</p>
        <div className="space-y-1 text-sm">
          <p>
            <span className="text-surface-600 dark:text-surface-300">Đón: </span>
            {ride.pickup.address}
          </p>
          <p>
            <span className="text-surface-600 dark:text-surface-300">Đến: </span>
            {ride.destination.address}
          </p>
        </div>
        <TransitionButton
          status={ride.status}
          pending={transitionPending}
          onTransition={onTransition}
        />
      </CardContent>
    </Card>
  );
}
