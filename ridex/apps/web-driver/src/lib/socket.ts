"use client";

import { createDriverSocket, type Socket } from "@ridex/socket-client";

import { useAuthStore } from "./auth-store";
import { env } from "./env";

let cached: Socket | null = null;

// Singleton per tab. Created lazily so the JS bundle doesn't open a socket
// at module load — we only need it when the driver taps GO.
export function getDriverSocket(): Socket {
  if (cached !== null) {
    return cached;
  }
  cached = createDriverSocket({
    url: env.NEXT_PUBLIC_WS_URL,
    getToken: () => useAuthStore.getState().accessToken,
    onAuthError: () => {
      // Mirror REST auth failure: clear local auth so the route guard sends
      // the driver back to /login on next render. The socket also gets
      // disconnected by the server side.
      useAuthStore.getState().clear();
    }
  });
  return cached;
}

// Test seam — not part of public surface.
export function __resetDriverSocketForTests(): void {
  if (cached !== null) {
    cached.disconnect();
    cached = null;
  }
}
