import type { TransitionRideDto } from "@ridex/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { driversApi, ridesApi } from "../lib/api";

export const activeRideKey = ["driver", "active-ride"] as const;

export function useDriverActiveRide() {
  return useQuery({
    queryKey: activeRideKey,
    queryFn: () => driversApi.getActiveRide(),
    staleTime: 5_000
  });
}

export function useRideTransition(rideId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TransitionRideDto) => ridesApi.transitionRide(rideId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: activeRideKey });
      void qc.invalidateQueries({ queryKey: ["rides", rideId] });
    }
  });
}
