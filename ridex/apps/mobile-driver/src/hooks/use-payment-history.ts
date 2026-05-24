import type { PaymentHistoryResponse } from "@ridex/shared-types";
import { useInfiniteQuery } from "@tanstack/react-query";

import { paymentsApi } from "../lib/api";

const PAGE_SIZE = 20;

export const paymentHistoryKey = ["payments", "me"] as const;

export function usePaymentHistory() {
  return useInfiniteQuery<PaymentHistoryResponse, Error, PaymentHistoryResponse, typeof paymentHistoryKey, number>({
    queryKey: paymentHistoryKey,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      paymentsApi.getMyPayments({ page: pageParam, pageSize: PAGE_SIZE }),
    getNextPageParam: (lastPage) =>
      lastPage.meta.page * lastPage.meta.pageSize < lastPage.meta.total
        ? lastPage.meta.page + 1
        : undefined
  });
}
