import { ApiClientError, errorMessage } from "@ridex/api-client";
import type { AuthTokens, User } from "@ridex/shared-types";

import { authApi, clearLocalAuth, persistAuthTokens } from "./api";
import { secureStorage } from "./secure-storage";

export interface AuthSession {
  accessToken: string;
  accessTokenExpiresInSeconds: number;
  user: User;
}

export type AuthResult = { ok: true; session: AuthSession } | { ok: false; error: string };

function sessionFromTokens(tokens: AuthTokens): AuthSession {
  return {
    accessToken: tokens.accessToken,
    accessTokenExpiresInSeconds: tokens.accessTokenExpiresInSeconds,
    user: tokens.user
  };
}

function messageFromError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return errorMessage(error.body) ?? "Yêu cầu thất bại";
  }
  return "Không kết nối được máy chủ";
}

async function persistResult(tokens: AuthTokens): Promise<AuthResult> {
  await persistAuthTokens(tokens);
  return { ok: true, session: sessionFromTokens(tokens) };
}

export const authClient = {
  async login(input: { email: string; password: string }): Promise<AuthResult> {
    try {
      return await persistResult(await authApi.login(input));
    } catch (error) {
      return { ok: false, error: messageFromError(error) };
    }
  },

  async register(input: { email: string; password: string }): Promise<AuthResult> {
    try {
      return await persistResult(await authApi.register(input));
    } catch (error) {
      return { ok: false, error: messageFromError(error) };
    }
  },

  async refresh(): Promise<AuthResult> {
    const refreshToken = await secureStorage.get("refreshToken");
    if (refreshToken === null) {
      await clearLocalAuth();
      return { ok: false, error: "Không có phiên đăng nhập" };
    }

    try {
      return await persistResult(await authApi.refresh({ refreshToken }));
    } catch (error) {
      await clearLocalAuth();
      return { ok: false, error: messageFromError(error) };
    }
  },

  async logout(): Promise<void> {
    const refreshToken = await secureStorage.get("refreshToken");
    if (refreshToken !== null) {
      try {
        await authApi.logout({ refreshToken });
      } catch {
        // Network down: proceed with local clear.
      }
    }
    await clearLocalAuth();
  }
};
