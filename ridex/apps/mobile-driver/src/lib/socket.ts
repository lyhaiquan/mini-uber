import { createDriverSocket, type Socket } from "@ridex/socket-client";

import { useAuthStore } from "./auth-store";
import { env } from "./env";

let cached: Socket | null = null;

// Singleton per process. Created lazily so the JS engine doesn't pay the
// connection cost until the driver taps GO. expo-router keeps screens warm,
// but we still only need one socket per driver shift.
export function getDriverSocket(): Socket {
  if (cached !== null) {
    return cached;
  }
  cached = createDriverSocket({
    url: env.wsUrl,
    getToken: () => useAuthStore.getState().accessToken,
    onAuthError: () => {
      useAuthStore.getState().clear();
    }
  });
  return cached;
}
