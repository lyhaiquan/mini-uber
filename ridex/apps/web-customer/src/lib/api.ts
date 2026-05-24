"use client";

import {
  ApiClient,
  createAdminApi,
  createDriversApi,
  createPaymentsApi,
  createRidesApi
} from "@ridex/api-client";
import { userSchema } from "@ridex/shared-types";
import { z } from "zod";

import { useAuthStore } from "./auth-store";
import { env } from "./env";

const clientAuthResponseSchema = z.object({
  accessToken: z.string().min(1),
  accessTokenExpiresInSeconds: z.number().int().positive(),
  user: userSchema
});

async function refreshAccessToken(): Promise<string | null> {
  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
    cache: "no-store"
  });
  if (!res.ok) return null;
  const parsed = clientAuthResponseSchema.safeParse(await res.json());
  if (!parsed.success) return null;
  useAuthStore.getState().setAuth(parsed.data);
  return parsed.data.accessToken;
}

function handleAuthFailure(): void {
  useAuthStore.getState().clear();
  void fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
    cache: "no-store"
  }).catch(() => undefined);
}

export const apiClient = new ApiClient({
  baseUrl: env.NEXT_PUBLIC_API_BASE_URL,
  credentials: "include",
  getAccessToken: () => useAuthStore.getState().accessToken,
  getAccessTokenExpiresAt: () => useAuthStore.getState().accessTokenExpiresAt,
  onRefreshNeeded: refreshAccessToken,
  onAuthFailure: handleAuthFailure
});

export const ridesApi = createRidesApi(apiClient);
export const driversApi = createDriversApi(apiClient);
export const adminApi = createAdminApi(apiClient);
export const paymentsApi = createPaymentsApi(apiClient);
export { clientAuthResponseSchema };
