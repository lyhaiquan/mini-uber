"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { driversApi } from "@/lib/api";

export const driverKeys = {
  all: ["drivers"] as const,
  availability: () => [...driverKeys.all, "me", "availability"] as const
};

export function useDriverAvailability() {
  return useQuery({
    queryKey: driverKeys.availability(),
    queryFn: () => driversApi.getAvailability()
  });
}

export function useSetDriverOnline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => driversApi.goOnline(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: driverKeys.availability() });
    }
  });
}

export function useSetDriverOffline() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => driversApi.goOffline(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: driverKeys.availability() });
    }
  });
}
