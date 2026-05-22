import { authTokensSchema, type User } from "@ridex/shared-types";

import { env } from "./env";
import { secureStorage } from "./secure-storage";

export interface AuthSession {
  accessToken: string;
  user: User;
}

export type AuthResult = { ok: true; session: AuthSession } | { ok: false; error: string };

interface BackendErrorBody {
  message?: string | string[];
}

function extractError(body: BackendErrorBody | null | undefined, fallback: string): string {
  if (!body) return fallback;
  if (Array.isArray(body.message)) return body.message.join(", ");
  if (typeof body.message === "string") return body.message;
  return fallback;
}

async function callAuth(path: string, body: unknown): Promise<AuthResult> {
  let res: Response;
  try {
    res = await fetch(`${env.apiBaseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch {
    return { ok: false, error: "Không kết nối được máy chủ" };
  }

  let json: unknown = null;
  const text = await res.text();
  if (text.length > 0) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { message: text };
    }
  }

  if (!res.ok) {
    return { ok: false, error: extractError(json as BackendErrorBody, "Yêu cầu thất bại") };
  }

  const parsed = authTokensSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, error: "Phản hồi backend không hợp lệ" };
  }

  await secureStorage.set("accessToken", parsed.data.accessToken);
  await secureStorage.set("refreshToken", parsed.data.refreshToken);
  await secureStorage.set("userId", parsed.data.user.id);
  await secureStorage.set("userRole", parsed.data.user.role);

  return {
    ok: true,
    session: { accessToken: parsed.data.accessToken, user: parsed.data.user }
  };
}

export const authClient = {
  login: (input: { email: string; password: string }) => callAuth("/auth/login", input),
  register: (input: { email: string; password: string }) => callAuth("/auth/register", input),

  async refresh(): Promise<AuthResult> {
    const refreshToken = await secureStorage.get("refreshToken");
    if (!refreshToken) {
      await secureStorage.clear();
      return { ok: false, error: "Không có phiên đăng nhập" };
    }
    const result = await callAuth("/auth/refresh", { refreshToken });
    if (!result.ok) {
      await secureStorage.clear();
    }
    return result;
  },

  async logout(): Promise<void> {
    const refreshToken = await secureStorage.get("refreshToken");
    if (refreshToken) {
      try {
        await fetch(`${env.apiBaseUrl}/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken })
        });
      } catch {
        // network down — proceed with local clear
      }
    }
    await secureStorage.clear();
  }
};
