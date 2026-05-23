export interface DriverAvailabilityDto {
  isOnline: boolean;
  onlineSince: string | null;
  lastSeenAt: string | null;
}

