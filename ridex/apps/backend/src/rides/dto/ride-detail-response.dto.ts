import type { PolylineFormat } from "../../routing/routing.types";
import type { RideResponseDto } from "./ride-response.dto";

export interface DriverSummaryDto {
  id: string;
  maskedEmail: string;
}

export interface PricingSummaryDto {
  currency: string;
  totalVnd: number;
  distanceMeters: number;
  durationSeconds: number;
  surgeMultiplier: number;
  baseFareVnd: number;
  surgeAmountVnd: number;
  routePolyline: string | null;
  routePolylineFormat: PolylineFormat | null;
}

export interface RideDetailResponseDto extends RideResponseDto {
  driver: DriverSummaryDto | null;
  pricing: PricingSummaryDto | null;
}
