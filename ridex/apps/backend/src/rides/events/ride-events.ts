import type { DomainEvent } from "../../common/domain-event";
import { RIDE_COMPLETED_EVENT, RIDE_REQUESTED_EVENT } from "../../common/events/event-types";

export { RIDE_COMPLETED_EVENT, RIDE_REQUESTED_EVENT };

export interface RideRequestedPayload {
  customerId: string;
  pickup: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  requestedAt: string;
}

export type RideRequestedDomainEvent = DomainEvent<RideRequestedPayload>;

export interface RideCompletedPayload {
  rideId: string;
  customerId: string;
  driverUserId: string | null;
  completedAt: string | null;
}

export type RideCompletedDomainEvent = DomainEvent<RideCompletedPayload>;
