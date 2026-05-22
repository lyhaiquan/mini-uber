import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { clearRefreshCookie, REFRESH_COOKIE_NAME } from "@/lib/auth-cookie";
import { callBackend } from "@/lib/auth-proxy";

export async function POST(): Promise<Response> {
  const cookieJar = await cookies();
  const refresh = cookieJar.get(REFRESH_COOKIE_NAME)?.value;

  if (refresh) {
    try {
      await callBackend({ path: "/auth/logout", body: { refreshToken: refresh } });
    } catch {
      // Backend down: continue clearing the cookie locally so the client is logged out.
    }
  }

  clearRefreshCookie(cookieJar);
  return NextResponse.json({ ok: true });
}
