import * as Location from "expo-location";
import * as React from "react";

import { SAIGON_FALLBACK, type LatLng } from "./types";
import { useLocationPermission } from "./use-location-permission";

export type CurrentLocationStatus =
  | "loading"
  | "ready"
  | "denied"
  | "unavailable";

export interface CurrentLocationResult {
  coords: LatLng;
  status: CurrentLocationStatus;
  isFallback: boolean;
}

export interface UseCurrentLocationOptions {
  fallback?: LatLng;
  autoRequest?: boolean;
}

export function useCurrentLocation(
  options: UseCurrentLocationOptions = {}
): CurrentLocationResult {
  const { fallback = SAIGON_FALLBACK, autoRequest = true } = options;
  const { status: permissionStatus, isLoading: permissionLoading, request } =
    useLocationPermission();
  const [state, setState] = React.useState<CurrentLocationResult>({
    coords: fallback,
    status: "loading",
    isFallback: true
  });

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (permissionLoading) return;
      let granted = permissionStatus === "granted";
      if (!granted && autoRequest && permissionStatus === "undetermined") {
        const next = await request();
        granted = next === "granted";
      }
      if (!granted) {
        if (cancelled) return;
        setState({ coords: fallback, status: "denied", isFallback: true });
        return;
      }
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });
        if (cancelled) return;
        setState({
          coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          status: "ready",
          isFallback: false
        });
      } catch {
        if (cancelled) return;
        setState({ coords: fallback, status: "unavailable", isFallback: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [permissionStatus, permissionLoading, autoRequest, fallback, request]);

  return state;
}
