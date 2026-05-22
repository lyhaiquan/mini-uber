import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { REFRESH_COOKIE_NAME } from "@/lib/auth-cookie";

const PUBLIC_PREFIXES = ["/", "/login", "/api/auth", "/_next", "/favicon"];

function isPublic(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (p) => p !== "/" && (pathname === p || pathname.startsWith(`${p}/`))
  );
}

export function middleware(req: NextRequest) {
  if (isPublic(req.nextUrl.pathname)) {
    return NextResponse.next();
  }
  const refresh = req.cookies.get(REFRESH_COOKIE_NAME)?.value;
  if (!refresh) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
