import * as Location from "expo-location";
import * as React from "react";

export type LocationPermissionStatus =
  | "undetermined"
  | "granted"
  | "denied"
  | "restricted";

export interface UseLocationPermissionResult {
  status: LocationPermissionStatus;
  isLoading: boolean;
  request: () => Promise<LocationPermissionStatus>;
}

function fromExpo(status: Location.PermissionStatus): LocationPermissionStatus {
  if (status === Location.PermissionStatus.GRANTED) return "granted";
  if (status === Location.PermissionStatus.DENIED) return "denied";
  return "undetermined";
}

export function useLocationPermission(): UseLocationPermissionResult {
  const [status, setStatus] = React.useState<LocationPermissionStatus>("undetermined");
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const current = await Location.getForegroundPermissionsAsync();
        if (cancelled) return;
        setStatus(fromExpo(current.status));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const request = React.useCallback(async (): Promise<LocationPermissionStatus> => {
    setIsLoading(true);
    try {
      const res = await Location.requestForegroundPermissionsAsync();
      const next = fromExpo(res.status);
      setStatus(next);
      return next;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { status, isLoading, request };
}
