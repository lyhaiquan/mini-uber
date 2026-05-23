import type { RouteConfidence, RouteCoordinate } from "../routing/routing.types";

export interface MatchingRide {
  id: string;
  customerId: string;
  pickup: RouteCoordinate;
  destination: RouteCoordinate;
}

export interface CandidateScoreInput {
  distanceMeters: number;
  durationSeconds: number;
  confidence: RouteConfidence;
}

export interface MatchingCandidate {
  driverUserId: string;
  score: number;
  distanceMeters: number;
  durationSeconds: number;
  routeConfidence: RouteConfidence;
}

export interface CreateRideOfferInput extends MatchingCandidate {
  rideId: string;
  attemptNumber: number;
  expiresAt: Date;
}

export interface OfferTimeoutJobPayload {
  offerId: string;
}

export interface OfferReceivedPayload {
  offerId: string;
  rideId: string;
  pickup: RouteCoordinate;
  destination: RouteCoordinate;
  distanceMeters: number;
  durationSeconds: number;
  tripDistanceMeters?: number;
  tripDurationSeconds?: number;
  tripRouteConfidence?: RouteConfidence;
  expiresAt: string;
  routeConfidence: RouteConfidence;
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

export interface OfferErrorPayload {
  code: "NOT_FOR_DRIVER" | "ALREADY_FINALIZED" | "OFFER_NOT_FOUND" | "INVALID_PAYLOAD";
  offerId?: string;
}
