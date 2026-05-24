import {
  driverEarningsSummarySchema,
  paymentHistoryResponseSchema,
  walletSummarySchema
} from "@ridex/shared-types";

import type { ApiClient } from "./client";
import { enveloped } from "./schemas";

export function createPaymentsApi(client: ApiClient) {
  return {
    getMyWallet() {
      return client.request({
        method: "GET",
        path: "/me/wallet",
        schema: enveloped(walletSummarySchema)
      });
    },

    getMyPayments(input?: { page?: number; pageSize?: number }) {
      const query = new URLSearchParams();
      if (input?.page !== undefined) query.set("page", String(input.page));
      if (input?.pageSize !== undefined) query.set("pageSize", String(input.pageSize));
      const qs = query.toString();
      return client.request({
        method: "GET",
        path: qs.length > 0 ? `/me/payments?${qs}` : "/me/payments",
        schema: paymentHistoryResponseSchema
      });
    },

    getDriverEarnings(input?: { from?: string; to?: string }) {
      const query = new URLSearchParams();
      if (input?.from !== undefined) query.set("from", input.from);
      if (input?.to !== undefined) query.set("to", input.to);
      const qs = query.toString();
      return client.request({
        method: "GET",
        path: qs.length > 0 ? `/me/driver/earnings?${qs}` : "/me/driver/earnings",
        schema: enveloped(driverEarningsSummarySchema)
      });
    }
  };
}
