import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { driversApi } from "../lib/api";

export const driverKeys = {
  all: ["drivers"] as const,
  availability: () => [...driverKeys.all, "availability"] as const
};

export function useDriverAvailability() {
  return useQuery({
    queryKey: driverKeys.availability(),
    queryFn: () => driversApi.getAvailability(),
    staleTime: 5_000
  });
}

export function useGoOnline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => driversApi.goOnline(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: driverKeys.availability() });
    }
  });
}

export function useGoOffline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => driversApi.goOffline(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: driverKeys.availability() });
    }
  });
}
