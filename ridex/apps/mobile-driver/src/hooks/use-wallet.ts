import { useQuery } from "@tanstack/react-query";

import { paymentsApi } from "../lib/api";

export const walletKey = ["wallet", "me"] as const;

export function useWallet() {
  return useQuery({
    queryKey: walletKey,
    queryFn: () => paymentsApi.getMyWallet(),
    staleTime: 30_000
  });
}
