import type { RideStatus } from "../enums/ride-status.enum";

export interface RideSummaryDto {
  id: string;
  customerId: string;
  driverUserId: string | null;
  status: RideStatus;
  pickup: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  version: number;
}
