"use client";

import { emitDriverLocation } from "@ridex/socket-client";
import * as React from "react";

import { getDriverSocket } from "@/lib/socket";

// Backend Task 004 expects updates roughly every 5s; quotes from the spec
// say emit interval 5s. watchPosition fires whenever the OS publishes a new
// fix, which can be much more often, so we throttle to one emit per window.
const DEFAULT_INTERVAL_MS = 5_000;

export interface UseLocationStreamOptions {
  enabled: boolean;
  intervalMs?: number;
  onPermissionDenied?: () => void;
}

export interface UseLocationStreamResult {
  permissionDenied: boolean;
  lastEmittedAt: string | null;
}

// Streams the browser's geolocation watch into the driver socket while
// `enabled` is true. Disabling tears down the watch and stops emitting — no
// background tracking. The hook does not connect/disconnect the socket itself;
// that is the singleton's job.
export function useLocationStream(
  opts: UseLocationStreamOptions
): UseLocationStreamResult {
  const { enabled, intervalMs = DEFAULT_INTERVAL_MS, onPermissionDenied } = opts;
  const [permissionDenied, setPermissionDenied] = React.useState<boolean>(false);
  const [lastEmittedAt, setLastEmittedAt] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setPermissionDenied(true);
      onPermissionDenied?.();
      return;
    }

    const socket = getDriverSocket();
    if (!socket.connected) {
      socket.connect();
    }

    let lastEmitMs = 0;
    let cancelled = false;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        // Throttle: native watchPosition can fire ~1/s on some browsers. The
        // backend gateway also has its own jump/rate guards, but emitting
        // less is cheaper for both sides.
        const now = Date.now();
        if (now - lastEmitMs < intervalMs) return;
        lastEmitMs = now;

        const recordedAt = new Date(pos.timestamp).toISOString();
        const payload = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          recordedAt,
          ...(pos.coords.heading !== null && !Number.isNaN(pos.coords.heading)
            ? { heading: pos.coords.heading }
            : {}),
          ...(pos.coords.speed !== null && !Number.isNaN(pos.coords.speed)
            ? { speed: pos.coords.speed }
            : {}),
          ...(pos.coords.accuracy !== null && !Number.isNaN(pos.coords.accuracy)
            ? { accuracy: pos.coords.accuracy }
            : {})
        };

        void emitDriverLocation(socket, payload).then((ack) => {
          if (cancelled) return;
          if (ack.ok) {
            setLastEmittedAt(recordedAt);
          }
          // GPS jump rejections and STALE_TIMESTAMP are intentionally silent
          // per the spec — they're noise from the device, not user-visible.
        });
      },
      (err) => {
        // PERMISSION_DENIED = 1 — covers user revoking permission mid-session.
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionDenied(true);
          onPermissionDenied?.();
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 }
    );

    return () => {
      cancelled = true;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled, intervalMs, onPermissionDenied]);

  return { permissionDenied, lastEmittedAt };
}
