import type { RouteConfidence } from "../../routing/routing.types";

// Wire shape for GET /drivers/me/offers/current. Mirrors the OfferReceivedPayload
// emitted via WS so the FE can render either source through the same code
// path; the REST endpoint exists purely as a fallback for the brief window
// where the driver's WS is still reconnecting after a page reload.
export interface DriverOfferResponseDto {
  offerId: string;
  rideId: string;
  pickup: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  distanceMeters: number;
  durationSeconds: number;
  routeConfidence: RouteConfidence;
  expiresAt: string;
}
