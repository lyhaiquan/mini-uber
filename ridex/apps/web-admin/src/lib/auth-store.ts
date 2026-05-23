"use client";

import type { User } from "@ridex/shared-types";
import { create } from "zustand";

export interface AuthState {
  accessToken: string | null;
  accessTokenExpiresAt: number | null;
  user: User | null;
  status: "idle" | "hydrating" | "authenticated" | "unauthenticated";
  setAuth: (input: {
    accessToken: string;
    user: User;
    accessTokenExpiresInSeconds?: number;
  }) => void;
  setStatus: (status: AuthState["status"]) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  accessTokenExpiresAt: null,
  user: null,
  status: "idle",
  setAuth: ({ accessToken, user, accessTokenExpiresInSeconds }) =>
    set({
      accessToken,
      accessTokenExpiresAt:
        accessTokenExpiresInSeconds === undefined
          ? null
          : Date.now() + accessTokenExpiresInSeconds * 1000,
      user,
      status: "authenticated"
    }),
  setStatus: (status) => set({ status }),
  clear: () =>
    set({
      accessToken: null,
      accessTokenExpiresAt: null,
      user: null,
      status: "unauthenticated"
    })
}));
