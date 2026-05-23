"use client";

import { toast } from "@ridex/ui-web";
import { useRouter } from "next/navigation";
import * as React from "react";

import { DriverMap } from "@/components/home/driver-map";
import { EarningsStrip } from "@/components/driver/earnings-strip";
import { OnlineToggle } from "@/components/driver/online-toggle";
import { StatusPill } from "@/components/driver/status-pill";
import {
  useDriverAvailability,
  useGoOffline,
  useGoOnline
} from "@/hooks/use-driver-status";
import { useLocationStream } from "@/hooks/use-location-stream";
import { useAuthStore } from "@/lib/auth-store";

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
    </section>
  );
}
