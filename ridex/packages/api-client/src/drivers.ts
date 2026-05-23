import {
  driverAvailabilitySchema,
  driverOfferResponseSchema,
  rideDetailResponseSchema
} from "@ridex/shared-types";
import { z } from "zod";

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
    },

    getCurrentOffer() {
      return client.request({
        method: "GET",
        path: "/drivers/me/offers/current",
        schema: enveloped(z.union([driverOfferResponseSchema, z.null()]))
      });
    },

    getActiveRide() {
      return client.request({
        method: "GET",
        path: "/drivers/me/active-ride",
        schema: enveloped(z.union([rideDetailResponseSchema, z.null()]))
      });
    }
  };
}
