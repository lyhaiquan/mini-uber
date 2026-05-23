import type { ActorType } from "../enums/actor-type.enum";
import type { RideStatus } from "../enums/ride-status.enum";

export interface GeoPointResponse {
  lat: number;
  lng: number;
  address: string;
}

export interface RideResponseDto {
  id: string;
  customerId: string;
  driverUserId: string | null;
  status: RideStatus;
  pickup: GeoPointResponse;
  destination: GeoPointResponse;
  requestedAt: string;
  matchingStartedAt: string | null;
  acceptedAt: string | null;
  driverArrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: ActorType | null;
  cancellationReason: string | null;
  version: number;
}
