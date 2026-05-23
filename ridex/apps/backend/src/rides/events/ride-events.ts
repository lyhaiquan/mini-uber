import type { DomainEvent } from "../../common/domain-event";
import {
  RIDE_COMPLETED_EVENT,
  RIDE_REQUESTED_EVENT,
  RIDE_TRANSITIONED_EVENT
} from "../../common/events/event-types";
import type { ActorType } from "../enums/actor-type.enum";
import type { RideStatus } from "../enums/ride-status.enum";

export { RIDE_COMPLETED_EVENT, RIDE_REQUESTED_EVENT, RIDE_TRANSITIONED_EVENT };

export interface RideTransitionedPayload {
  rideId: string;
  customerId: string;
  driverUserId: string | null;
  fromStatus: RideStatus | null;
  toStatus: RideStatus;
  actorType: ActorType;
  occurredAt: string;
}

export type RideTransitionedDomainEvent = DomainEvent<RideTransitionedPayload>;

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
