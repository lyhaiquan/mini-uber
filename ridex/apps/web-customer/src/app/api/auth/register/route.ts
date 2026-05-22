import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { setRefreshCookie } from "@/lib/auth-cookie";
import {
  type BackendErrorBody,
  authTokensResponseSchema,
  callBackend,
  flattenBackendError
} from "@/lib/auth-proxy";

const inputSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128)
});

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Body JSON không hợp lệ" }, { status: 400 });
  }

  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Dữ liệu đăng ký không hợp lệ" }, { status: 400 });
  }

  const backend = await callBackend<unknown>({ path: "/auth/register", body: parsed.data });
  if (backend.status >= 400) {
    return NextResponse.json(
      { message: flattenBackendError(backend.json as BackendErrorBody | null) },
      { status: backend.status }
    );
  }

  const tokens = authTokensResponseSchema.safeParse(backend.json);
  if (!tokens.success) {
    return NextResponse.json({ message: "Phản hồi backend không hợp lệ" }, { status: 502 });
  }

  const cookieJar = await cookies();
  setRefreshCookie(cookieJar, tokens.data.refreshToken);

  return NextResponse.json(
    {
      accessToken: tokens.data.accessToken,
      accessTokenExpiresInSeconds: tokens.data.accessTokenExpiresInSeconds,
      user: tokens.data.user
    },
    { status: 201 }
  );
}
