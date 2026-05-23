import {
  createRideDtoSchema,
  quoteRequestSchema,
  quoteResponseSchema,
  rideDetailResponseSchema,
  rideResponseSchema,
  transitionRideDtoSchema,
  type CreateRideDto,
  type QuoteRequest,
  type TransitionRideDto
} from "@ridex/shared-types";
import { z } from "zod";

import type { ApiClient } from "./client";
import { enveloped } from "./schemas";

const activeRideEnvelopeSchema = enveloped(z.union([rideResponseSchema, z.null()]));

export function createRidesApi(client: ApiClient) {
  return {
    createRide(input: CreateRideDto) {
      return client.request({
        method: "POST",
        path: "/rides",
        body: createRideDtoSchema.parse(input),
        schema: enveloped(rideResponseSchema)
      });
    },

    transitionRide(rideId: string, input: TransitionRideDto) {
      return client.request({
        method: "POST",
        path: `/rides/${encodeURIComponent(rideId)}/transitions`,
        body: transitionRideDtoSchema.parse(input),
        schema: enveloped(rideResponseSchema)
      });
    },

    getActiveRide() {
      return client.request({
        method: "GET",
        path: "/rides/active",
        schema: activeRideEnvelopeSchema
      });
    },

    getRide(rideId: string) {
      return client.request({
        method: "GET",
        path: `/rides/${encodeURIComponent(rideId)}`,
        schema: enveloped(rideDetailResponseSchema)
      });
    },

    getQuote(input: QuoteRequest) {
      return client.request({
        method: "POST",
        path: "/rides/quote",
        body: quoteRequestSchema.parse(input),
        schema: enveloped(quoteResponseSchema)
      });
    }
  };
}
