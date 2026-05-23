import { createTrackingSocket, type Socket } from "@ridex/socket-client";

import { useAuthStore } from "./auth-store";
import { env } from "./env";

let cached: Socket | null = null;

// Singleton per process. Re-using one socket avoids burning a connection per
// screen mount while expo-router pushes/pops the ride tracking screen.
export function getTrackingSocket(): Socket {
  if (cached !== null) {
    return cached;
  }
  cached = createTrackingSocket({
    // apiBaseUrl includes the /api/v1 prefix; the WS server is mounted at the
    // host root, so use wsUrl for the socket transport.
    url: env.wsUrl,
    getToken: () => useAuthStore.getState().accessToken,
    onAuthError: () => {
      // The REST client also clears auth in its own onAuthFailure path; this
      // is the WS-side mirror so a server-initiated reject doesn't leave the
      // socket masking auth state from the rest of the app.
      useAuthStore.getState().clear();
    }
  });
  return cached;
}
