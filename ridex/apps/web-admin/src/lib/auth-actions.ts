"use client";

import type { User } from "@ridex/shared-types";

export interface ClientAuthResponse {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  user: User;
}

export type AuthActionResult =
  | { ok: true; data: ClientAuthResponse }
  | { ok: false; error: string };

async function postAuth(path: string, body?: unknown): Promise<AuthActionResult> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "include",
      cache: "no-store"
    });
  } catch {
    return { ok: false, error: "Không kết nối được máy chủ" };
  }

  const text = await res.text();
  let json: unknown = null;
  if (text.length > 0) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { message: text };
    }
  }

  if (!res.ok) {
    const message =
      typeof (json as { message?: string } | null)?.message === "string"
        ? (json as { message: string }).message
        : "Yêu cầu thất bại";
    return { ok: false, error: message };
  }

  return { ok: true, data: json as ClientAuthResponse };
}

export const authActions = {
  login: (input: { email: string; password: string }) => postAuth("/api/auth/login", input),
  register: (input: { email: string; password: string }) =>
    postAuth("/api/auth/register", input),
  refresh: () => postAuth("/api/auth/refresh"),
  logout: async (): Promise<void> => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store"
      });
    } catch {
      // ignore — store will be cleared regardless
    }
  }
};
