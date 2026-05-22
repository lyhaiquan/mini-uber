import { authTokensSchema } from "@ridex/shared-types";

import { serverEnv } from "./server-env";

export interface AuthProxyOptions {
  path: "/auth/login" | "/auth/register" | "/auth/refresh" | "/auth/logout";
  body: unknown;
}

export interface AuthProxyResult<T> {
  status: number;
  json: T;
}

export async function callBackend<T>({
  path,
  body
}: AuthProxyOptions): Promise<AuthProxyResult<T>> {
  const res = await fetch(`${serverEnv.API_BASE_URL_INTERNAL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store"
  });

  const text = await res.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { message: text };
    }
  }
  return { status: res.status, json: parsed as T };
}

export interface BackendErrorBody {
  message?: string | string[];
  statusCode?: number;
}

export function flattenBackendError(body: BackendErrorBody | null | undefined): string {
  if (!body) return "Yêu cầu thất bại";
  if (Array.isArray(body.message)) return body.message.join(", ");
  if (typeof body.message === "string") return body.message;
  return "Yêu cầu thất bại";
}

export const authTokensResponseSchema = authTokensSchema;
