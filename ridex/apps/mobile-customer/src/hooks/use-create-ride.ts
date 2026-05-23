import type { CreateRideDto } from "@ridex/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ridesApi } from "../lib/api";

export function useCreateRide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRideDto) => ridesApi.createRide(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rides", "active"] });
    }
  });
}

export function useActiveRide(enabled = true) {
  return useQuery({
    queryKey: ["rides", "active"] as const,
    queryFn: () => ridesApi.getActiveRide(),
    enabled,
    staleTime: 10_000,
    refetchOnWindowFocus: false
  });
}
