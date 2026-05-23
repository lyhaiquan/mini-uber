"use client";

import { toast } from "@ridex/ui-web";
import { useParams, useRouter } from "next/navigation";
import * as React from "react";

import { CancelConfirmDialog } from "@/components/ride/cancel-confirm-dialog";
import { DriverCard } from "@/components/ride/driver-card";
import { ReceiptModal } from "@/components/ride/receipt-modal";
import {
  CUSTOMER_CANCELABLE_STATUSES,
  RideStatusCard
} from "@/components/ride/ride-status-card";
import { RideTrackingMap } from "@/components/ride/ride-tracking-map";
import { useCancelRide, useRide, useRideWs } from "@/hooks/use-ride";
import { apiErrorToMessage } from "@/lib/api-error";

export default function RideTrackingPage() {
  const params = useParams<{ id: string }>();
  const rideId = params.id;
  const router = useRouter();

  const { driverPosition, connected } = useRideWs(rideId);
  const rideQuery = useRide(rideId, { wsConnected: connected });
  const cancel = useCancelRide(rideId);

  const [confirmCancelOpen, setConfirmCancelOpen] = React.useState(false);
  const [receiptDismissed, setReceiptDismissed] = React.useState(false);

  const ride = rideQuery.data ?? null;

  // Auto-redirect home on hard 404 — covers the deleted-ride edge case from
  // the spec.
  React.useEffect(() => {
    if (rideQuery.isError) {
      const err = rideQuery.error;
      if (err instanceof Error && /RIDE_NOT_FOUND|404/.test(err.message)) {
        toast.error("Không tìm thấy chuyến đi.");
        router.replace("/home");
      }
    }
  }, [rideQuery.isError, rideQuery.error, router]);

  if (rideQuery.isLoading || ride === null) {
    return (
      <section className="space-y-3">
        <p className="text-sm text-surface-600 dark:text-surface-300">
          Đang tải chuyến đi...
        </p>
      </section>
    );
  }

  const cancelable = CUSTOMER_CANCELABLE_STATUSES.includes(ride.status);
  const showReceipt = ride.status === "COMPLETED" && !receiptDismissed;

  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">Chuyến đi</h1>
      <RideTrackingMap ride={ride} driverPosition={driverPosition} />
      <RideStatusCard
        status={ride.status}
        wsConnected={connected}
        cancelable={cancelable}
        cancelPending={cancel.isPending}
        onRequestCancel={() => setConfirmCancelOpen(true)}
      />
      <DriverCard driver={ride.driver} />

      <CancelConfirmDialog
        open={confirmCancelOpen}
        pending={cancel.isPending}
        onCancel={() => setConfirmCancelOpen(false)}
        onConfirm={() => {
          cancel.mutate(undefined, {
            onSuccess: () => {
              setConfirmCancelOpen(false);
              toast.success("Đã hủy chuyến.");
              router.replace("/home");
            },
            onError: (err) => {
              toast.error(apiErrorToMessage(err));
            }
          });
        }}
      />

      <ReceiptModal
        open={showReceipt}
        pricing={ride.pricing}
        onClose={() => {
          setReceiptDismissed(true);
          router.replace("/home");
        }}
      />
    </section>
  );
}
