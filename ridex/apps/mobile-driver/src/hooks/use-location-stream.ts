import { emitDriverLocation } from "@ridex/socket-client";
import * as Location from "expo-location";
import * as React from "react";

import { getDriverSocket } from "../lib/socket";

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

// expo-location's watchPositionAsync already throttles natively via
// timeInterval + distanceInterval, so we don't add a JS-side throttle here.
// The hook does not connect/disconnect the socket itself — that is the
// singleton's job.
export function useLocationStream(
  opts: UseLocationStreamOptions
): UseLocationStreamResult {
  const { enabled, intervalMs = DEFAULT_INTERVAL_MS, onPermissionDenied } = opts;
  const [permissionDenied, setPermissionDenied] = React.useState<boolean>(false);
  const [lastEmittedAt, setLastEmittedAt] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    void (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") {
        const req = await Location.requestForegroundPermissionsAsync();
        if (req.status !== "granted") {
          setPermissionDenied(true);
          onPermissionDenied?.();
          return;
        }
      }
      if (cancelled) return;

      const socket = getDriverSocket();
      if (!socket.connected) {
        socket.connect();
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: intervalMs,
          // 10m matches the spec snippet. Keeps idle drivers from spamming
          // identical fixes while still updating fast enough when moving.
          distanceInterval: 10
        },
        (loc) => {
          const recordedAt = new Date(loc.timestamp).toISOString();
          const heading = loc.coords.heading;
          const speed = loc.coords.speed;
          const accuracy = loc.coords.accuracy;
          // expo-location uses -1 to mean "unknown" on some platforms. Drop
          // those rather than send invalid downstream — the gateway DTO
          // requires non-negative values where present.
          const payload = {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            recordedAt,
            ...(typeof heading === "number" && heading >= 0
              ? { heading: heading >= 360 ? heading % 360 : heading }
              : {}),
            ...(typeof speed === "number" && speed >= 0 ? { speed } : {}),
            ...(typeof accuracy === "number" && accuracy >= 0 ? { accuracy } : {})
          };
          void emitDriverLocation(socket, payload).then((ack) => {
            if (cancelled) return;
            if (ack.ok) {
              setLastEmittedAt(recordedAt);
            }
            // STALE_TIMESTAMP / GPS_JUMP_* are silent per spec — they are
            // device noise, not user-facing errors.
          });
        }
      );
    })();

    return () => {
      cancelled = true;
      if (subscription !== null) {
        subscription.remove();
      }
    };
  }, [enabled, intervalMs, onPermissionDenied]);

  return { permissionDenied, lastEmittedAt };
}
