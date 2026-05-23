// Wire-protocol constants for the ride-tracking namespace. Frontend (web +
// mobile customer) imports the matching values from packages/socket-client.
export const RIDE_TRACKING_NAMESPACE = "/rides";

export const RIDE_SUBSCRIBE_EVENT = "ride.subscribe";
export const RIDE_UNSUBSCRIBE_EVENT = "ride.unsubscribe";
export const RIDE_DRIVER_LOCATION_EVENT = "ride.driver-location";
export const RIDE_STATUS_CHANGED_EVENT = "ride.status-changed";
export const WS_ERROR_EVENT = "ws:error";

export interface RideSubscribePayload {
  rideId: string;
}

export type RideSubscribeAckCode =
  | "INVALID_PAYLOAD"
  | "RIDE_NOT_FOUND"
  | "RIDE_FORBIDDEN_ACCESS";

export type RideSubscribeAck =
  | { ok: true }
  | { ok: false; code: RideSubscribeAckCode; message: string };

export function rideSubscribeError(
  code: RideSubscribeAckCode,
  message: string
): RideSubscribeAck {
  return { ok: false, code, message };
}

export function rideRoomFor(rideId: string): string {
  return `ride:${rideId}`;
}
