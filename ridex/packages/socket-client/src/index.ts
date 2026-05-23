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
