import {
  ApiClient,
  createAuthApi,
  createDriversApi,
  createRidesApi,
  type ApiClientConfig
} from "@ridex/api-client";
import type { AuthTokens } from "@ridex/shared-types";

import { useAuthStore } from "./auth-store";
import { env } from "./env";
import { secureStorage } from "./secure-storage";

export async function persistAuthTokens(tokens: AuthTokens): Promise<void> {
  await secureStorage.set("accessToken", tokens.accessToken);
  await secureStorage.set("refreshToken", tokens.refreshToken);
  await secureStorage.set("userId", tokens.user.id);
  await secureStorage.set("userRole", tokens.user.role);
  useAuthStore.getState().setAuth(tokens);
}

export async function clearLocalAuth(): Promise<void> {
  await secureStorage.clear();
  useAuthStore.getState().clear();
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await secureStorage.get("refreshToken");
  if (refreshToken === null) return null;

  try {
    const tokens = await authApi.refresh({ refreshToken });
    await persistAuthTokens(tokens);
    return tokens.accessToken;
  } catch {
    return null;
  }
}

const config: ApiClientConfig = {
  baseUrl: env.apiBaseUrl,
  getAccessToken: () => useAuthStore.getState().accessToken,
  getAccessTokenExpiresAt: () => useAuthStore.getState().accessTokenExpiresAt,
  onRefreshNeeded: refreshAccessToken,
  onAuthFailure: () => {
    void clearLocalAuth();
  }
};

export const apiClient = new ApiClient(config);
export const authApi = createAuthApi(apiClient);
export const ridesApi = createRidesApi(apiClient);
export const driversApi = createDriversApi(apiClient);
