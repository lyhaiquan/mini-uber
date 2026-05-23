"use client";

import type { LatLng } from "@ridex/ui-web";
import { useQuery } from "@tanstack/react-query";

import { ridesApi } from "@/lib/api";

export const quoteKey = (pickup: LatLng, destination: LatLng) =>
  ["quote", pickup.lat, pickup.lng, destination.lat, destination.lng] as const;

interface Input {
  pickup: LatLng | null;
  destination: LatLng | null;
}

export function useRideQuote({ pickup, destination }: Input) {
  const enabled = pickup !== null && destination !== null;
  return useQuery({
    queryKey: enabled ? quoteKey(pickup, destination) : (["quote", "idle"] as const),
    queryFn: () => ridesApi.getQuote({ pickup: pickup!, destination: destination! }),
    enabled,
    staleTime: 30_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false
  });
}
