// Shared socket client for ride tracking. Web (apps/web-customer) and mobile
// (apps/mobile-customer) each create one Socket via createTrackingSocket and
// hand it to useRideWs (web) or its RN equivalent. Auth is re-read on every
// (re)connection so a silent access-token refresh in the parent app
// flows through without recreating the socket.

import { io, type Socket } from "socket.io-client";

// Wire-protocol constants — must match
// apps/backend/src/rides/gateways/ride-tracking-events.ts.
export const RIDE_TRACKING_NAMESPACE = "/rides";
export const RIDE_SUBSCRIBE_EVENT = "ride.subscribe";
export const RIDE_UNSUBSCRIBE_EVENT = "ride.unsubscribe";
export const RIDE_DRIVER_LOCATION_EVENT = "ride.driver-location";
export const RIDE_STATUS_CHANGED_EVENT = "ride.status-changed";
export const WS_ERROR_EVENT = "ws:error";

export type RideStatus =
  | "REQUESTED"
  | "MATCHING"
  | "ACCEPTED"
  | "DRIVER_ARRIVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_DRIVERS_FOUND";

export interface RideDriverLocationPayload {
  rideId: string;
  driverUserId: string;
  lat: number;
  lng: number;
  heading: number | null;
  recordedAt: string;
}

export interface RideStatusChangedPayload {
  rideId: string;
  fromStatus: RideStatus | null;
  toStatus: RideStatus;
  driverUserId: string | null;
  occurredAt: string;
}

export interface RideSubscribePayload {
  rideId: string;
}

export type RideSubscribeAck =
  | { ok: true }
  | {
      ok: false;
      code: "INVALID_PAYLOAD" | "RIDE_NOT_FOUND" | "RIDE_FORBIDDEN_ACCESS";
      message: string;
    };

export interface WsErrorPayload {
  code: "WS_AUTH_FAILED" | "WS_FORBIDDEN";
  message: string;
}

export interface CreateTrackingSocketOptions {
  url: string;
  // Called on every (re)connect handshake. Return null when the user is
  // logged out — the socket will surface ws:error and the host app should
  // disconnect / send the user back to login.
  getToken: () => string | null;
  // Fired when the server emits ws:error with code WS_AUTH_FAILED. Hosts use
  // this to refresh the access token or kick the user back to login.
  onAuthError?: (payload: WsErrorPayload) => void;
}

export function createTrackingSocket(opts: CreateTrackingSocketOptions): Socket {
  const baseUrl = opts.url.replace(/\/$/, "");
  const socket = io(`${baseUrl}${RIDE_TRACKING_NAMESPACE}`, {
    // Pull a fresh token from the host every time socket.io needs to (re)connect.
    // Using a callback (vs static object) is what makes silent token refresh
    // flow through reconnections without recreating the socket.
    auth: (cb) => cb({ token: opts.getToken() ?? "" }),
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    transports: ["websocket"]
  });

  if (opts.onAuthError !== undefined) {
    const handler = opts.onAuthError;
    socket.on(WS_ERROR_EVENT, (payload: WsErrorPayload) => {
      if (payload.code === "WS_AUTH_FAILED" || payload.code === "WS_FORBIDDEN") {
        handler(payload);
      }
    });
  }

  return socket;
}

export type { Socket };

export function subscribeRide(
  socket: Socket,
  rideId: string
): Promise<RideSubscribeAck> {
  return new Promise((resolve) => {
    // Socket.io emits with a callback as the last arg trigger acks. Backend
    // gateway uses @Ack to reply, so we always get a structured response.
    socket.emit(RIDE_SUBSCRIBE_EVENT, { rideId }, (ack: RideSubscribeAck) => {
      resolve(ack);
    });
  });
}

export function unsubscribeRide(socket: Socket, rideId: string): void {
  socket.emit(RIDE_UNSUBSCRIBE_EVENT, { rideId });
}

// --- Driver-side: position publishing on the default (driver) namespace ----
//
// The driver app connects to the root socket.io endpoint (no namespace) which
// is handled by LocationGateway on the backend. Customer ride-tracking uses
// "/rides" via createTrackingSocket; the two are separate connections by
// design — the driver socket requires role=DRIVER and never receives
// ride-tracking traffic.

export const DRIVER_LOCATION_UPDATE_EVENT = "driver.location.update";

export interface DriverLocationPayload {
  lat: number;
  lng: number;
  recordedAt: string;
  heading?: number;
  speed?: number;
  accuracy?: number;
}

export type DriverLocationAckCode =
  | "INVALID_PAYLOAD"
  | "DRIVER_OFFLINE"
  | "STALE_TIMESTAMP"
  | "GPS_JUMP_DISTANCE"
  | "GPS_JUMP_SPEED"
  | "INTERNAL";

export type DriverLocationAck =
  | { ok: true }
  | { ok: false; code: DriverLocationAckCode; message: string };

export interface CreateDriverSocketOptions {
  url: string;
  // Same contract as createTrackingSocket — called per (re)connect handshake.
  getToken: () => string | null;
  onAuthError?: (payload: WsErrorPayload) => void;
}

export function createDriverSocket(opts: CreateDriverSocketOptions): Socket {
  const baseUrl = opts.url.replace(/\/$/, "");
  const socket = io(baseUrl, {
    auth: (cb) => cb({ token: opts.getToken() ?? "" }),
    // Drivers stay online for the whole shift — reconnect aggressively but
    // never give up, so a brief flap doesn't take a driver offline silently.
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    transports: ["websocket"]
  });

  if (opts.onAuthError !== undefined) {
    const handler = opts.onAuthError;
    socket.on(WS_ERROR_EVENT, (payload: WsErrorPayload) => {
      if (payload.code === "WS_AUTH_FAILED" || payload.code === "WS_FORBIDDEN") {
        handler(payload);
      }
    });
  }

  return socket;
}

// Wraps the ack-style emit so the caller awaits a structured response instead
// of chasing socket callbacks. GPS jump rejections (STALE_TIMESTAMP /
// GPS_JUMP_*) come back as { ok: false } with a recognisable code — the spec
// says FE silently ignores these (it does NOT toast or roll back state).
export function emitDriverLocation(
  socket: Socket,
  payload: DriverLocationPayload
): Promise<DriverLocationAck> {
  return new Promise((resolve) => {
    socket.emit(DRIVER_LOCATION_UPDATE_EVENT, payload, (ack: DriverLocationAck) => {
      resolve(ack);
    });
  });
}

// --- Driver-side: ride offer push + accept/reject -------------------------
//
// Mirrors apps/backend/src/matching/matching.constants.ts. The OfferGateway
// shares the default (driver) namespace with LocationGateway, so the same
// socket created by createDriverSocket also carries these events.

export const RIDE_OFFER_RECEIVED_EVENT = "ride.offer.received";
export const RIDE_OFFER_CANCELLED_EVENT = "ride.offer.cancelled";
export const RIDE_OFFER_ERROR_EVENT = "ride.offer.error";
export const RIDE_OFFER_ACCEPT_EVENT = "ride.offer.accept";
export const RIDE_OFFER_REJECT_EVENT = "ride.offer.reject";

export type RouteConfidence = "high" | "low";

export interface OfferReceivedPayload {
  offerId: string;
  rideId: string;
  pickup: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  distanceMeters: number;
  durationSeconds: number;
  routeConfidence: RouteConfidence;
  expiresAt: string;
}

export type OfferCancellationReason =
  | "TIMED_OUT"
  | "RIDE_CANCELLED"
  | "SUPERSEDED"
  | "TIMEOUT_SCHEDULING_FAILED";

export interface OfferCancelledPayload {
  offerId: string;
  reason: OfferCancellationReason;
}

export type OfferErrorCode =
  | "NOT_FOR_DRIVER"
  | "ALREADY_FINALIZED"
  | "OFFER_NOT_FOUND"
  | "INVALID_PAYLOAD";

export interface OfferErrorPayload {
  code: OfferErrorCode;
  offerId?: string;
}

export type OfferAck =
  | { ok: true }
  | { ok: false; error: OfferErrorPayload };

// Both accept/reject use the same ack shape as the OfferGateway. The reject
// reason defaults to "driver_declined" per spec; passing a custom reason is
// reserved for future taxonomy work.
export function acceptOffer(socket: Socket, offerId: string): Promise<OfferAck> {
  return new Promise((resolve) => {
    socket.emit(RIDE_OFFER_ACCEPT_EVENT, { offerId }, (ack: OfferAck) => {
      resolve(ack);
    });
  });
}

export function rejectOffer(
  socket: Socket,
  offerId: string,
  reason: string = "driver_declined"
): Promise<OfferAck> {
  return new Promise((resolve) => {
    socket.emit(RIDE_OFFER_REJECT_EVENT, { offerId, reason }, (ack: OfferAck) => {
      resolve(ack);
    });
  });
}
