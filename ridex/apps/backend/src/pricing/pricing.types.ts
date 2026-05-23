import type { RouteConfidence, RouteCoordinate } from "../routing/routing.types";

export interface FareBreakdown {
  baseFareVnd: number;
  distanceMeters: number;
  distanceFeeVnd: number;
  durationSeconds: number;
  durationFeeVnd: number;
  subtotalVnd: number;
  surgeMultiplier: number;
  surgeAmountVnd: number;
  minimumFareVnd: number;
  totalVnd: number;
  routeConfidence: RouteConfidence;
}

export interface FareCalculatorConfig {
  baseFareVnd: number;
  perKmVnd: number;
  perMinVnd: number;
  minimumFareVnd: number;
}

export interface ComputeFareInput {
  distanceMeters: number;
  durationSeconds: number;
  surgeMultiplier: number;
  routeConfidence: RouteConfidence;
}

export interface ComputePricingInput {
  pickup: RouteCoordinate;
  destination: RouteCoordinate;
}

export interface SurgeContext {
  cellR8: string;
  demand: number;
  supply: number;
  ratio: number;
  multiplier: number;
}

export interface PricingEstimate extends FareBreakdown {
  currency: "VND";
  pickupH3R8: string;
  surge: SurgeContext;
}
