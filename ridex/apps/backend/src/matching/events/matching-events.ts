import type { DomainEvent } from "../../common/domain-event";
import {
  RIDE_MATCHING_NO_DRIVERS_EVENT,
  RIDE_MATCHING_STARTED_EVENT,
  RIDE_OFFER_ACCEPTED_EVENT,
  RIDE_OFFER_CANCELLED_EVENT,
  RIDE_OFFER_CREATED_EVENT,
  RIDE_OFFER_EXPIRED_EVENT,
  RIDE_OFFER_REJECTED_EVENT
} from "../../common/events/event-types";
import type { OfferStatus } from "../enums/offer-status.enum";

export {
  RIDE_MATCHING_NO_DRIVERS_EVENT,
  RIDE_MATCHING_STARTED_EVENT,
  RIDE_OFFER_ACCEPTED_EVENT,
  RIDE_OFFER_CANCELLED_EVENT,
  RIDE_OFFER_CREATED_EVENT,
  RIDE_OFFER_EXPIRED_EVENT,
  RIDE_OFFER_REJECTED_EVENT
};

export interface RideMatchingStartedPayload {
  rideId: string;
}

export interface RideMatchingNoDriversPayload {
  rideId: string;
  reason: string;
}

export interface RideOfferEventPayload {
  offerId: string;
  rideId: string;
  driverUserId: string;
  status: OfferStatus;
}

export type RideMatchingStartedDomainEvent = DomainEvent<RideMatchingStartedPayload>;
export type RideMatchingNoDriversDomainEvent = DomainEvent<RideMatchingNoDriversPayload>;
export type RideOfferDomainEvent = DomainEvent<RideOfferEventPayload>;

