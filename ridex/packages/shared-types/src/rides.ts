import { z } from "zod";

import { geoPointSchema, isoDateTimeSchema } from "./common";

export const rideStatusSchema = z.enum([
  "REQUESTED",
  "MATCHING",
  "ACCEPTED",
  "DRIVER_ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_DRIVERS_FOUND"
]);
export type RideStatus = z.infer<typeof rideStatusSchema>;

export const TERMINAL_RIDE_STATUSES: readonly RideStatus[] = [
  "COMPLETED",
  "CANCELLED",
  "NO_DRIVERS_FOUND"
];

export const ACTIVE_RIDE_STATUSES: readonly RideStatus[] = [
  "REQUESTED",
  "MATCHING",
  "ACCEPTED",
  "DRIVER_ARRIVED",
  "IN_PROGRESS"
];

export const actorTypeSchema = z.enum(["CUSTOMER", "DRIVER", "ADMIN", "SYSTEM"]);
export type ActorType = z.infer<typeof actorTypeSchema>;

export const createRideDtoSchema = z.object({
  pickup: geoPointSchema,
  destination: geoPointSchema
});
export type CreateRideDto = z.infer<typeof createRideDtoSchema>;

export const rideResponseSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  driverUserId: z.string().uuid().nullable(),
  status: rideStatusSchema,
  pickup: geoPointSchema,
  destination: geoPointSchema,
  requestedAt: isoDateTimeSchema,
  matchingStartedAt: isoDateTimeSchema.nullable(),
  acceptedAt: isoDateTimeSchema.nullable(),
  driverArrivedAt: isoDateTimeSchema.nullable(),
  startedAt: isoDateTimeSchema.nullable(),
  completedAt: isoDateTimeSchema.nullable(),
  cancelledAt: isoDateTimeSchema.nullable(),
  cancelledBy: actorTypeSchema.nullable(),
  cancellationReason: z.string().nullable(),
  version: z.number().int().min(0)
});
export type RideResponse = z.infer<typeof rideResponseSchema>;

export const transitionRideDtoSchema = z
  .object({
    toStatus: rideStatusSchema,
    reason: z.string().max(500).optional(),
    expectedVersion: z.number().int().min(0).optional()
  })
  .strict();
export type TransitionRideDto = z.infer<typeof transitionRideDtoSchema>;

export function isTerminalStatus(status: RideStatus): boolean {
  return TERMINAL_RIDE_STATUSES.includes(status);
}

const quoteCoordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});

export const quoteRequestSchema = z.object({
  pickup: quoteCoordinateSchema,
  destination: quoteCoordinateSchema
});
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;

export const quoteResponseSchema = z.object({
  distanceMeters: z.number().int().min(0),
  durationSeconds: z.number().int().min(0),
  baseFareVnd: z.number().int().min(0),
  perKmVnd: z.number().int().min(0),
  perMinVnd: z.number().int().min(0),
  surgeMultiplier: z.number().min(1),
  totalVnd: z.number().int().min(0),
  currency: z.literal("VND"),
  routeConfidence: z.enum(["high", "low"]),
  estimatedAt: isoDateTimeSchema,
  expiresInSeconds: z.number().int().positive()
});
export type QuoteResponse = z.infer<typeof quoteResponseSchema>;

export const RIDE_ERROR_ALREADY_ACTIVE = "RIDE_ALREADY_ACTIVE" as const;
