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
