import { dashboardSummarySchema } from "@ridex/shared-types";

import type { ApiClient } from "./client";
import { enveloped } from "./schemas";

export function createAdminApi(client: ApiClient) {
  return {
    getDashboardSummary() {
      return client.request({
        method: "GET",
        path: "/admin/dashboard/summary",
        schema: enveloped(dashboardSummarySchema)
      });
    }
  };
}
