"use client";

import { createTrackingSocket, type Socket } from "@ridex/socket-client";

import { useAuthStore } from "./auth-store";
import { env } from "./env";

let cached: Socket | null = null;

// Singleton per browser tab. Sharing one socket avoids burning a connection
// slot per ride-tracking page mount; useRideWs joins/leaves rooms instead.
export function getTrackingSocket(): Socket {
  if (cached !== null) {
    return cached;
  }
  cached = createTrackingSocket({
    // NEXT_PUBLIC_API_BASE_URL ends with /api/v1; the WS server lives at the
    // host root, so use NEXT_PUBLIC_WS_URL as the socket transport target.
    url: env.NEXT_PUBLIC_WS_URL,
    getToken: () => useAuthStore.getState().accessToken,
    onAuthError: () => {
      // Mirror REST: clear auth then let the route guard send the user to /login
      // on next render. The socket itself disconnects from the server side.
      useAuthStore.getState().clear();
    }
  });
  return cached;
}

// Test seam: reset the cached socket between vitest runs to avoid module-state
// leakage. Not exported as part of the public surface.
export function __resetTrackingSocketForTests(): void {
  cached = null;
}
