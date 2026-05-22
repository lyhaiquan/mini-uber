import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { clearRefreshCookie, REFRESH_COOKIE_NAME, setRefreshCookie } from "@/lib/auth-cookie";
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
    clearRefreshCookie(cookieJar);
    return NextResponse.json(
      { message: flattenBackendError(backend.json as BackendErrorBody | null) },
      { status: backend.status }
    );
  }

  const tokens = authTokensResponseSchema.safeParse(backend.json);
  if (!tokens.success) {
    clearRefreshCookie(cookieJar);
    return NextResponse.json({ message: "Phản hồi backend không hợp lệ" }, { status: 502 });
  }

  setRefreshCookie(cookieJar, tokens.data.refreshToken);

  return NextResponse.json({
    accessToken: tokens.data.accessToken,
    accessTokenExpiresInSeconds: tokens.data.accessTokenExpiresInSeconds,
    user: tokens.data.user
  });
}
