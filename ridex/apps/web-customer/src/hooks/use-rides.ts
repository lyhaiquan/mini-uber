"use client";

import type { CreateRideDto, TransitionRideDto } from "@ridex/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ridesApi } from "@/lib/api";

export const rideKeys = {
  all: ["rides"] as const,
  active: () => [...rideKeys.all, "active"] as const,
  detail: (rideId: string) => [...rideKeys.all, rideId] as const
};

export function useActiveRide(enabled = true) {
  return useQuery({
    queryKey: rideKeys.active(),
    queryFn: () => ridesApi.getActiveRide(),
    enabled,
    staleTime: 10_000,
    refetchOnWindowFocus: false
  });
}

export function useCreateRide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRideDto) => ridesApi.createRide(input),
    onSuccess: (ride) => {
      queryClient.invalidateQueries({ queryKey: rideKeys.active() });
      queryClient.setQueryData(rideKeys.detail(ride.id), ride);
    }
  });
}

export function useTransitionRide(rideId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TransitionRideDto) => ridesApi.transitionRide(rideId, input),
    onSuccess: (ride) => {
      queryClient.invalidateQueries({ queryKey: rideKeys.active() });
      queryClient.setQueryData(rideKeys.detail(ride.id), ride);
    }
  });
}
