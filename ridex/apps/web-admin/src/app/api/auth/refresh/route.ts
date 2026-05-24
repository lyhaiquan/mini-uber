import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  clearRefreshCookie,
  clearRoleCookie,
  REFRESH_COOKIE_NAME,
  setRefreshCookie,
  setRoleCookie
} from "@/lib/auth-cookie";
import {
  type BackendErrorBody,
  authTokensResponseSchema,
  callBackend,
  flattenBackendError
} from "@/lib/auth-proxy";

export async function POST(): Promise<Response> {
  const cookieJar = await cookies();
  const refresh = cookieJar.get(REFRESH_COOKIE_NAME)?.value;

  if (!refresh) {
    return NextResponse.json({ message: "Không có phiên đăng nhập" }, { status: 401 });
  }

  const backend = await callBackend<unknown>({
    path: "/auth/refresh",
    body: { refreshToken: refresh }
  });

  if (backend.status >= 400) {
    // Only clear refresh cookie when the token itself is rejected (401/403).
    // Transient backend errors (5xx, timeouts, 502) must NOT log the user out.
    if (backend.status === 401 || backend.status === 403) {
      clearRefreshCookie(cookieJar);
      clearRoleCookie(cookieJar);
    }
    return NextResponse.json(
      { message: flattenBackendError(backend.json as BackendErrorBody | null) },
      { status: backend.status }
    );
  }

  const tokens = authTokensResponseSchema.safeParse(backend.json);
  if (!tokens.success) {
    // Backend returned 2xx but with a malformed body — keep the cookie so the
    // client can retry; the failure is on the backend contract, not the session.
    return NextResponse.json({ message: "Phản hồi backend không hợp lệ" }, { status: 502 });
  }

  setRefreshCookie(cookieJar, tokens.data.refreshToken);
  setRoleCookie(cookieJar, tokens.data.user.role);

  return NextResponse.json({
    accessToken: tokens.data.accessToken,
    accessTokenExpiresInSeconds: tokens.data.accessTokenExpiresInSeconds,
    user: tokens.data.user
  });
}
