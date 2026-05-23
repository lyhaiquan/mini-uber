export type RouteConfidence = "high" | "low";
export type PolylineFormat = "polyline5";
export type RouteEstimateSource = "osrm" | "fallback";

export interface RouteCoordinate {
  lat: number;
  lng: number;
}

export interface RouteEstimate {
  distanceMeters: number;
  durationSeconds: number;
  polyline: string | null;
  polylineFormat: PolylineFormat | null;
  confidence: RouteConfidence;
  source: RouteEstimateSource;
}

export class InvalidRouteCoordinateError extends Error {
  constructor(message = "Invalid route coordinate") {
    super(message);
    this.name = "InvalidRouteCoordinateError";
  }
}

