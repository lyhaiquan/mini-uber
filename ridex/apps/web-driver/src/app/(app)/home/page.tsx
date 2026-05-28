"use client";

import { toast } from "@ridex/ui-web";
import { useRouter } from "next/navigation";
import * as React from "react";

import { EarningsStrip } from "@/components/driver/earnings-strip";
import { OfferModal } from "@/components/driver/offer-modal";
import { OnlineToggle } from "@/components/driver/online-toggle";
import { StatusPill } from "@/components/driver/status-pill";
import { DriverMap } from "@/components/home/driver-map";
import { useDriverActiveRide } from "@/hooks/use-active-ride";
import { useDriverOffer } from "@/hooks/use-driver-offer";
import {
  useDriverAvailability,
  useGoOffline,
  useGoOnline
} from "@/hooks/use-driver-status";
import { useLocationStream } from "@/hooks/use-location-stream";
import { useAuthStore } from "@/lib/auth-store";

// Driver-share of the fare for the modal preview. Hard-coded for T020; T022
// will surface the real split via a payments endpoint.
const DRIVER_SHARE_BPS = 8_000;

export default function DriverHomePage() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  const availability = useDriverAvailability();
  const goOnline = useGoOnline();
  const goOffline = useGoOffline();
  const isOnline = availability.data?.isOnline ?? false;

  // Restore the in-ride screen on reload: if the backend tells us a ride is
  // assigned, jump there immediately. The redirect happens once per ride
  // change so the driver can still navigate back home manually.
  const activeRide = useDriverActiveRide();
  React.useEffect(() => {
    const ride = activeRide.data;
    if (ride !== null && ride !== undefined) {
      router.replace(`/rides/${ride.id}`);
    }
  }, [activeRide.data, router]);

  // Offer subscription is only meaningful when the driver is online and
  // currently between rides — backend won't push a second offer otherwise,
  // but gating here avoids a useless socket subscription.
  const offerCtl = useDriverOffer({ enabled: isOnline && activeRide.data === null });
  const [offerPending, setOfferPending] = React.useState(false);

  const onAcceptOffer = async () => {
    if (offerCtl.offer === null) return;
    setOfferPending(true);
    const ack = await offerCtl.accept(offerCtl.offer.offerId);
    setOfferPending(false);
    if (ack.ok) {
      router.push(`/rides/${offerCtl.offer.rideId}`);
    } else {
      // Race lost (ALREADY_FINALIZED) or network timeout — surface a toast.
      toast.error(
        ack.error.code === "ALREADY_FINALIZED"
          ? "Chuyến đã được nhận hoặc đã hết hạn."
          : "Mạng chậm, vui lòng thử lại."
      );
    }
  };

  const onRejectOffer = async () => {
    if (offerCtl.offer === null) return;
    setOfferPending(true);
    await offerCtl.reject(offerCtl.offer.offerId);
    setOfferPending(false);
  };

  const estimatedPayoutVnd =
    offerCtl.offer === null
      ? null
      : null; // Offer payload doesn't carry total fare; T022 will pipe pricing snapshot through.

  const stream = useLocationStream({
    enabled: isOnline,
    onPermissionDenied: () => {
      // If we lose permission mid-shift, the spec says force the driver
      // offline so the server stops accepting their (now non-existent)
      // updates. Best-effort: ignore any error from the offline call here.
      toast.error("Cần cho phép truy cập vị trí. Đang chuyển sang offline.");
      goOffline.mutate();
    }
  });

  // App close / tab close → best-effort offline. sendBeacon survives unload
  // where fetch typically does not. We POST without a body since the endpoint
  // is identity-driven.
  React.useEffect(() => {
    const handler = () => {
      if (!isOnline) return;
      if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
        const token = useAuthStore.getState().accessToken;
        if (token === null) return;
        const url = `${process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}/drivers/me/offline`;
        const blob = new Blob([""], { type: "application/json" });
        // sendBeacon doesn't allow headers; the backend accepts cookie OR
        // bearer. In dev we have a httpOnly cookie wired by the auth proxy,
        // which keeps this best-effort beacon authorized.
        navigator.sendBeacon(url, blob);
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isOnline]);

  const onGo = () => {
    if (stream.permissionDenied) {
      toast.error("Cần cho phép truy cập vị trí.");
      return;
    }
    goOnline.mutate(undefined, {
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Không thể bật online.");
      }
    });
  };

  const onStop = () => {
    if (typeof window !== "undefined" && !window.confirm("Tắt trạng thái online?")) {
      return;
    }
    goOffline.mutate(undefined, {
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "Không thể tắt online.");
      }
    });
  };

  if (status !== "authenticated" || !user) {
    return <p className="text-sm text-surface-700 dark:text-surface-300">Đang tải...</p>;
  }

  const toggleState: "online" | "offline" | "going-online" | "going-offline" =
    goOnline.isPending
      ? "going-online"
      : goOffline.isPending
        ? "going-offline"
        : isOnline
          ? "online"
          : "offline";
  const pillState: "online" | "offline" | "loading" = availability.isLoading
    ? "loading"
    : isOnline
      ? "online"
      : "offline";

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Trạm điều phối</h1>
          <p className="text-sm text-surface-700 dark:text-surface-300">
            Tài xế: <strong>{user.email}</strong>
          </p>
        </div>
        <StatusPill state={pillState} />
      </header>

      <EarningsStrip />

      <div className="flex flex-col items-center gap-3">
        <OnlineToggle
          state={toggleState}
          disabled={stream.permissionDenied}
          onGo={onGo}
          onStop={onStop}
        />
        <p className="text-xs text-surface-600 dark:text-surface-400">
          {stream.permissionDenied
            ? "Bị từ chối quyền vị trí — không thể online."
            : isOnline
              ? "Đang nhận yêu cầu chuyến..."
              : "Tap để bắt đầu nhận chuyến"}
        </p>
      </div>

      <DriverMap />

      <OfferModal
        offer={offerCtl.offer}
        pending={offerPending}
        estimatedPayoutVnd={estimatedPayoutVnd}
        onAccept={() => void onAcceptOffer()}
        onReject={() => void onRejectOffer()}
        onTimeout={() => offerCtl.clear()}
      />
    </section>
  );
}

// Reserved for the T022 payout join — DRIVER_SHARE_BPS would multiply against
// the pricing snapshot total once that data is plumbed into the offer payload.
void DRIVER_SHARE_BPS;
