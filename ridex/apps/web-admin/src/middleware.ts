import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { REFRESH_COOKIE_NAME, ROLE_COOKIE_NAME } from "@/lib/auth-cookie";

const PUBLIC_PREFIXES = ["/", "/login", "/403", "/api/auth", "/_next", "/favicon"];

function isPublic(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (p) => p !== "/" && (pathname === p || pathname.startsWith(`${p}/`))
  );
}

export function resolveAuthRedirect(
  pathname: string,
  refresh: string | undefined,
  role: string | undefined
): "/login" | "/403" | null {
  if (isPublic(pathname)) {
    return null;
  }
  if (!refresh) {
    return "/login";
  }
  // Role-aware guard: when we know the role from the httpOnly cookie and it
  // isn't ADMIN, block before the app shell renders. If the role cookie is
  // missing (older session), let the client/bootstrap re-validate normally.
  if (role !== undefined && role !== "ADMIN") {
    return "/403";
  }
  return null;
}

export function middleware(req: NextRequest) {
  const refresh = req.cookies.get(REFRESH_COOKIE_NAME)?.value;
  const role = req.cookies.get(ROLE_COOKIE_NAME)?.value;
  const redirectPath = resolveAuthRedirect(req.nextUrl.pathname, refresh, role);

  if (redirectPath !== null) {
    const url = req.nextUrl.clone();
    url.pathname = redirectPath;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
