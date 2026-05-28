"use client";

import { toast } from "@ridex/ui-web";
import { useParams, useRouter } from "next/navigation";
import * as React from "react";

import { InRideCard } from "@/components/driver/in-ride-card";
import { InRideMap } from "@/components/driver/in-ride-map";
import { useDriverActiveRide, useRideTransition } from "@/hooks/use-active-ride";
import { apiErrorToMessage } from "@/lib/api-error";

const vnd = new Intl.NumberFormat("vi-VN");

export default function DriverRidePage() {
  const params = useParams<{ id: string }>();
  const rideId = params.id;
  const router = useRouter();

  // Reuse the driver's active-ride query — it returns the same RideDetail
  // shape the customer's GET /rides/:id does, so we don't need a second
  // endpoint. If the active-ride id doesn't match the URL id (driver navigated
  // to a stale link) we render a "not your ride" hint instead of 403'ing.
  const activeQuery = useDriverActiveRide();
  const transition = useRideTransition(rideId);

  const ride = activeQuery.data ?? null;
  const matches = ride !== null && ride.id === rideId;

  // Pricing only lives on RideDetailResponse (the active-ride query). The
  // transition mutation returns RideResponse without pricing, and the query
  // returns null after COMPLETED is persisted (backend's active-ride
  // whitelist excludes terminal statuses). Capture the last seen pricing so
  // the payout toast still has the number when completion lands.
  const lastPricingRef = React.useRef<{ totalVnd: number } | null>(null);
  React.useEffect(() => {
    if (ride !== null && ride.pricing !== null) {
      lastPricingRef.current = { totalVnd: ride.pricing.totalVnd };
    }
  }, [ride]);

  // Drive completion off the mutation result, not the query — the query
  // returns null the moment the ride leaves the active whitelist, so we'd
  // otherwise flash "no active ride" and never show the toast.
  const completedShown = React.useRef(false);
  const [completing, setCompleting] = React.useState(false);
  React.useEffect(() => {
    const updated = transition.data;
    if (updated === undefined) return;
    if (updated.status !== "COMPLETED") return;
    if (completedShown.current) return;
    completedShown.current = true;
    setCompleting(true);
    const pricing = lastPricingRef.current;
    const payout = pricing !== null ? Math.round(pricing.totalVnd * 0.8) : null;
    toast.success(
      payout !== null
        ? `Hoàn thành! Ước tính thu nhập: ${vnd.format(payout)} ₫`
        : "Hoàn thành chuyến."
    );
    const id = window.setTimeout(() => router.replace("/home"), 1_500);
    return () => window.clearTimeout(id);
  }, [transition.data, router]);

  if (completing) {
    return (
      <section className="space-y-3">
        <p className="text-sm">Đang hoàn tất chuyến...</p>
      </section>
    );
  }

  if (activeQuery.isLoading) {
    return <p className="text-sm text-surface-600 dark:text-surface-300">Đang tải...</p>;
  }

  if (ride === null) {
    return (
      <section className="space-y-3">
        <p className="text-sm">Bạn đang không có chuyến nào.</p>
      </section>
    );
  }

  if (!matches) {
    return (
      <section className="space-y-3">
        <p className="text-sm">Chuyến không thuộc về bạn hoặc đã kết thúc.</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">Chuyến hiện tại</h1>
      <InRideMap ride={ride} />
      <InRideCard
        ride={ride}
        transitionPending={transition.isPending}
        onTransition={(next) => {
          transition.mutate(
            { toStatus: next },
            {
              onError: (err) => {
                toast.error(apiErrorToMessage(err));
              }
            }
          );
        }}
      />
    </section>
  );
}
