import type { H3DriverIndexResolution } from "../geo.constants";

export function cellKey(resolution: H3DriverIndexResolution, cellId: string): string {
  return `h3:drivers:r${resolution}:${cellId}`;
}

export function companionKey(driverId: string): string {
  return `h3:driver:cells:${driverId}`;
}

export function lastSeenZsetKey(): string {
  return "h3:drivers:last-seen";
}
