import { driverAvailabilitySchema } from "@ridex/shared-types";

import type { ApiClient } from "./client";
import { emptyResponseSchema, enveloped } from "./schemas";

export function createDriversApi(client: ApiClient) {
  return {
    goOnline() {
      return client.request({
        method: "POST",
        path: "/drivers/me/online",
        schema: emptyResponseSchema
      });
    },

    goOffline() {
      return client.request({
        method: "POST",
        path: "/drivers/me/offline",
        schema: emptyResponseSchema
      });
    },

    getAvailability() {
      return client.request({
        method: "GET",
        path: "/drivers/me/availability",
        schema: enveloped(driverAvailabilitySchema)
      });
    }
  };
}
