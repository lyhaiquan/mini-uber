import type { ResponseCookies } from "next/dist/compiled/@edge-runtime/cookies";

export const REFRESH_COOKIE_NAME = "ridex_refresh";

export const REFRESH_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export function setRefreshCookie(cookies: ResponseCookies, token: string): void {
  cookies.set(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: REFRESH_COOKIE_MAX_AGE_SECONDS
  });
}

export function clearRefreshCookie(cookies: ResponseCookies): void {
  cookies.set(REFRESH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}
