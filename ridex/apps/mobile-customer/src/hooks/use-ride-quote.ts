import type { LatLng } from "@ridex/ui-mobile";
import { useQuery } from "@tanstack/react-query";

import { ridesApi } from "../lib/api";

interface Input {
  pickup: LatLng | null;
  destination: LatLng | null;
}

export function useRideQuote({ pickup, destination }: Input) {
  const enabled = pickup !== null && destination !== null;
  return useQuery({
    queryKey: enabled
      ? (["quote", pickup.lat, pickup.lng, destination.lat, destination.lng] as const)
      : (["quote", "idle"] as const),
    queryFn: () => ridesApi.getQuote({ pickup: pickup!, destination: destination! }),
    enabled,
    staleTime: 30_000,
    gcTime: 60_000
  });
}
