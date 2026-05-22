import { z } from "zod";

import { isoDateTimeSchema } from "./common";

/**
 * Wire-level WebSocket event names and payload schemas emitted by the backend gateways.
 *
 * Backend has two gateways:
 *   - LocationGateway (handles inbound driver.location.update + outbound ws:error)
 *   - OfferGateway (emits ride.offer.received / cancelled / error; accepts ride.offer.accept / reject)
 *
 * Anything below labelled as "FUTURE BACKEND ADDON" is NOT yet emitted by the backend.
 * Tasks 018/020 add server-side forwarding so the customer/driver UIs can subscribe.
 */

// ── OfferGateway (driver inbound: ride.offer.* server → driver) ────────────────

export const routeConfidenceSchema = z.enum(["high", "low"]);
export type RouteConfidence = z.infer<typeof routeConfidenceSchema>;

const routeCoordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});

export const offerReceivedPayloadSchema = z.object({
  offerId: z.string().uuid(),
  rideId: z.string().uuid(),
  pickup: routeCoordinateSchema,
  destination: routeCoordinateSchema,
  distanceMeters: z.number().min(0),
  durationSeconds: z.number().min(0),
  tripDistanceMeters: z.number().min(0).optional(),
  tripDurationSeconds: z.number().min(0).optional(),
  tripRouteConfidence: routeConfidenceSchema.optional(),
  expiresAt: isoDateTimeSchema,
  routeConfidence: routeConfidenceSchema
});
export type OfferReceivedPayload = z.infer<typeof offerReceivedPayloadSchema>;

export const offerCancellationReasonSchema = z.enum([
  "TIMED_OUT",
  "RIDE_CANCELLED",
  "SUPERSEDED",
  "TIMEOUT_SCHEDULING_FAILED"
]);
export type OfferCancellationReason = z.infer<typeof offerCancellationReasonSchema>;

export const offerCancelledPayloadSchema = z.object({
  offerId: z.string().uuid(),
  reason: offerCancellationReasonSchema
});
export type OfferCancelledPayload = z.infer<typeof offerCancelledPayloadSchema>;

export const offerErrorCodeSchema = z.enum([
  "NOT_FOR_DRIVER",
  "ALREADY_FINALIZED",
  "OFFER_NOT_FOUND",
  "INVALID_PAYLOAD"
]);
export type OfferErrorCode = z.infer<typeof offerErrorCodeSchema>;

export const offerErrorPayloadSchema = z.object({
  code: offerErrorCodeSchema,
  offerId: z.string().uuid().optional()
});
export type OfferErrorPayload = z.infer<typeof offerErrorPayloadSchema>;

// ── OfferGateway (driver outbound: ride.offer.accept / reject) ─────────────────

export const offerActionDtoSchema = z
  .object({
    offerId: z.string().uuid(),
    reason: z.string().max(200).optional()
  })
  .strict();
export type OfferActionDto = z.infer<typeof offerActionDtoSchema>;

export const offerActionAckSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true) }),
  z.object({
    ok: z.literal(false),
    error: offerErrorPayloadSchema
  })
]);
export type OfferActionAck = z.infer<typeof offerActionAckSchema>;

// ── Connection-level error (both gateways) ─────────────────────────────────────

export const wsErrorPayloadSchema = z.object({
  code: z.enum(["WS_AUTH_FAILED", "WS_FORBIDDEN"]),
  message: z.string()
});
export type WsErrorPayload = z.infer<typeof wsErrorPayloadSchema>;

// ── Event name constants ────────────────────────────────────────────────────────

export const WS_EVENTS = {
  // OfferGateway: server → driver
  RIDE_OFFER_RECEIVED: "ride.offer.received",
  RIDE_OFFER_CANCELLED: "ride.offer.cancelled",
  RIDE_OFFER_ERROR: "ride.offer.error",
  // OfferGateway: driver → server
  RIDE_OFFER_ACCEPT: "ride.offer.accept",
  RIDE_OFFER_REJECT: "ride.offer.reject",
  // LocationGateway: driver → server
  DRIVER_LOCATION_UPDATE: "driver.location.update",
  // Connection-level (either gateway)
  WS_ERROR: "ws:error"
} as const;

export type WsEventName = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

/**
 * FUTURE BACKEND ADDONS — these schemas are forward-declared for the FE consumers
 * (customer ride tracking T018, driver in-ride T020). Backend does NOT yet emit them.
 * Do NOT add a socket listener for these names until the corresponding backend task lands.
 */
export const FUTURE_WS_EVENTS = {
  RIDE_STATUS_CHANGED: "ride.status-changed",
  DRIVER_LOCATION_UPDATED: "driver.location-updated"
} as const;

export const futureRideStatusChangedPayloadSchema = z.object({
  rideId: z.string().uuid(),
  status: z.string(),
  occurredAt: isoDateTimeSchema,
  version: z.number().int().min(0)
});
export type FutureRideStatusChangedPayload = z.infer<typeof futureRideStatusChangedPayloadSchema>;

export const futureDriverLocationUpdatedPayloadSchema = z.object({
  driverId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(359.999).optional(),
  speed: z.number().min(0).optional(),
  recordedAt: isoDateTimeSchema,
  receivedAt: isoDateTimeSchema
});
export type FutureDriverLocationUpdatedPayload = z.infer<
  typeof futureDriverLocationUpdatedPayloadSchema
>;
