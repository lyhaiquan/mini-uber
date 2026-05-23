import * as React from "react";

export const SAIGON_FALLBACK = { lat: 10.7769, lng: 106.7009 } as const;

export type CurrentLocationStatus =
  | "loading"
  | "ready"
  | "denied"
  | "unsupported"
  | "timeout";

export interface CurrentLocationResult {
  coords: { lat: number; lng: number };
  status: CurrentLocationStatus;
  isFallback: boolean;
}

export interface UseCurrentLocationOptions {
  timeoutMs?: number;
  fallback?: { lat: number; lng: number };
}

export function useCurrentLocation(
  options: UseCurrentLocationOptions = {}
): CurrentLocationResult {
  const { timeoutMs = 10_000, fallback = SAIGON_FALLBACK } = options;
  const [state, setState] = React.useState<CurrentLocationResult>({
    coords: fallback,
    status: "loading",
    isFallback: true
  });

  React.useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ coords: fallback, status: "unsupported", isFallback: true });
      return;
    }
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setState({
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          status: "ready",
          isFallback: false
        });
      },
      (err) => {
        if (cancelled) return;
        const status: CurrentLocationStatus =
          err.code === err.PERMISSION_DENIED
            ? "denied"
            : err.code === err.TIMEOUT
              ? "timeout"
              : "denied";
        setState({ coords: fallback, status, isFallback: true });
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 }
    );
    return () => {
      cancelled = true;
    };
  }, [fallback, timeoutMs]);

  return state;
}
