export enum RideStatus {
  REQUESTED = "REQUESTED",
  MATCHING = "MATCHING",
  ACCEPTED = "ACCEPTED",
  DRIVER_ARRIVED = "DRIVER_ARRIVED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  NO_DRIVERS_FOUND = "NO_DRIVERS_FOUND"
}

export const ALL_RIDE_STATUSES: readonly RideStatus[] = [
  RideStatus.REQUESTED,
  RideStatus.MATCHING,
  RideStatus.ACCEPTED,
  RideStatus.DRIVER_ARRIVED,
  RideStatus.IN_PROGRESS,
  RideStatus.COMPLETED,
  RideStatus.CANCELLED,
  RideStatus.NO_DRIVERS_FOUND
];

export const TERMINAL_RIDE_STATUSES: readonly RideStatus[] = [
  RideStatus.COMPLETED,
  RideStatus.CANCELLED,
  RideStatus.NO_DRIVERS_FOUND
];

// Ride is considered "active" (not yet finished) while in one of these states.
// Used by matching dedup and chat ownership checks.
export const ACTIVE_RIDE_STATUSES: readonly RideStatus[] = [
  RideStatus.REQUESTED,
  RideStatus.MATCHING,
  RideStatus.ACCEPTED,
  RideStatus.DRIVER_ARRIVED,
  RideStatus.IN_PROGRESS
];

// Matching engine may pick up a ride only while it is awaiting a driver.
// Once a driver has accepted (ACCEPTED+) the ride is no longer a matching candidate.
export const MATCHING_ELIGIBLE_STATUSES: readonly RideStatus[] = [
  RideStatus.REQUESTED,
  RideStatus.MATCHING
];

export function isTerminalStatus(status: RideStatus): boolean {
  return TERMINAL_RIDE_STATUSES.includes(status);
}

export function isMatchingEligible(status: RideStatus): boolean {
  return MATCHING_ELIGIBLE_STATUSES.includes(status);
}
