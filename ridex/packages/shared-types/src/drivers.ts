import { z } from "zod";

import { isoDateTimeSchema } from "./common";

export const driverAvailabilitySchema = z.object({
  isOnline: z.boolean(),
  onlineSince: isoDateTimeSchema.nullable(),
  lastSeenAt: isoDateTimeSchema.nullable()
});
export type DriverAvailability = z.infer<typeof driverAvailabilitySchema>;

export const driverOnlineDtoSchema = z
  .object({
    isOnline: z.boolean()
  })
  .strict();
export type DriverOnlineDto = z.infer<typeof driverOnlineDtoSchema>;

export const driverLocationDtoSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    heading: z.number().min(0).max(359.999).optional(),
    speed: z.number().min(0).optional(),
    accuracy: z.number().min(0).optional(),
    recordedAt: isoDateTimeSchema
  })
  .strict();
export type DriverLocationDto = z.infer<typeof driverLocationDtoSchema>;

export const locationErrorCodeSchema = z.enum([
  "INVALID_PAYLOAD",
  "DRIVER_OFFLINE",
  "STALE_TIMESTAMP",
  "GPS_JUMP_DISTANCE",
  "GPS_JUMP_SPEED",
  "INTERNAL"
]);
export type LocationErrorCode = z.infer<typeof locationErrorCodeSchema>;

export const locationAckSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true) }),
  z.object({
    ok: z.literal(false),
    error: z.object({
      code: locationErrorCodeSchema,
      message: z.string()
    })
  })
]);
export type LocationAck = z.infer<typeof locationAckSchema>;
