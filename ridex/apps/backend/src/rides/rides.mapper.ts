import type { Ride } from "./entities/ride.entity";
import type { RideResponseDto } from "./dto/ride-response.dto";
import type { RideSummaryDto } from "./dto/ride-summary.dto";

export function rideToResponseDto(ride: Ride): RideResponseDto {
  return {
    id: ride.id,
    customerId: ride.customerId,
    driverUserId: ride.driverUserId,
    status: ride.status,
    pickup: {
      lat: ride.pickupLat,
      lng: ride.pickupLng,
      address: ride.pickupAddress
    },
    destination: {
      lat: ride.destinationLat,
      lng: ride.destinationLng,
      address: ride.destinationAddress
    },
    requestedAt: ride.requestedAt.toISOString(),
    matchingStartedAt: toIso(ride.matchingStartedAt),
    acceptedAt: toIso(ride.acceptedAt),
    driverArrivedAt: toIso(ride.driverArrivedAt),
    startedAt: toIso(ride.startedAt),
    completedAt: toIso(ride.completedAt),
    cancelledAt: toIso(ride.cancelledAt),
    cancelledBy: ride.cancelledBy,
    cancellationReason: ride.cancellationReason,
    version: ride.version
  };
}

export function rideToSummaryDto(ride: Ride): RideSummaryDto {
  return {
    id: ride.id,
    customerId: ride.customerId,
    driverUserId: ride.driverUserId,
    status: ride.status,
    pickup: { lat: ride.pickupLat, lng: ride.pickupLng },
    destination: { lat: ride.destinationLat, lng: ride.destinationLng },
    version: ride.version
  };
}

function toIso(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}
