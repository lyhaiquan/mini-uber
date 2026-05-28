"use client";

import type { RideStatus } from "@ridex/shared-types";
import { Button, Card, CardContent } from "@ridex/ui-web";

import { StateMachineStepper } from "./state-machine-stepper";

export interface RideStatusCardProps {
  status: RideStatus;
  wsConnected: boolean;
  cancelable: boolean;
  cancelPending: boolean;
  onRequestCancel: () => void;
}

// Customer-side cancel is allowed only before the driver arrives. After
// DRIVER_ARRIVED the ride state machine accepts cancels but the spec treats
// that as a paid cancel which is out of scope for T018, so the button hides.
export const CUSTOMER_CANCELABLE_STATUSES: ReadonlyArray<RideStatus> = [
  "REQUESTED",
  "MATCHING",
  "ACCEPTED"
];

export function RideStatusCard({
  status,
  wsConnected,
  cancelable,
  cancelPending,
  onRequestCancel
}: RideStatusCardProps) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <StateMachineStepper status={status} />
        {!wsConnected ? (
          <p className="text-xs italic text-amber-700 dark:text-amber-300">
            Mất kết nối, đang thử lại...
          </p>
        ) : null}
        {cancelable ? (
          <Button
            variant="outline"
            type="button"
            onClick={onRequestCancel}
            disabled={cancelPending}
          >
            Hủy chuyến
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
