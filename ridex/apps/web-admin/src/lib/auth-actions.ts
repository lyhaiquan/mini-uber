"use client";

import { ApiClient, okResponseSchema } from "@ridex/api-client";
import type { z } from "zod";

import { clientAuthResponseSchema } from "./api";
import { apiErrorToMessage } from "./api-error";

export type ClientAuthResponse = z.infer<typeof clientAuthResponseSchema>;

export type AuthActionResult =
  | { ok: true; data: ClientAuthResponse }
  | { ok: false; error: string };

const localAuthClient = new ApiClient({
  baseUrl: "",
  credentials: "include",
  getAccessToken: () => null,
  onRefreshNeeded: async () => null,
  onAuthFailure: () => undefined
});

async function postAuth(path: string, body?: unknown): Promise<AuthActionResult> {
  try {
    const data = await localAuthClient.request({
      method: "POST",
      path,
      body,
      schema: clientAuthResponseSchema,
      skipAuth: true
    });
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: apiErrorToMessage(error) };
  }
}

export const authActions = {
  login: (input: { email: string; password: string }) => postAuth("/api/auth/login", input),
  register: (input: { email: string; password: string }) =>
    postAuth("/api/auth/register", input),
  refresh: () => postAuth("/api/auth/refresh"),
  logout: async (): Promise<void> => {
    try {
      await localAuthClient.request({
        method: "POST",
        path: "/api/auth/logout",
        schema: okResponseSchema,
        skipAuth: true
      });
    } catch {
      // Store is cleared regardless.
    }
  }
};
