import type { RouteConfidence } from "../../routing/routing.types";

export interface QuoteResponseDto {
  distanceMeters: number;
  durationSeconds: number;
  baseFareVnd: number;
  perKmVnd: number;
  perMinVnd: number;
  surgeMultiplier: number;
  totalVnd: number;
  currency: "VND";
  routeConfidence: RouteConfidence;
  estimatedAt: string;
  expiresInSeconds: number;
}
