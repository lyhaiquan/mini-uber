import type { User } from "@ridex/shared-types";
import { create } from "zustand";

export interface AuthState {
  accessToken: string | null;
  user: User | null;
  status: "idle" | "hydrating" | "authenticated" | "unauthenticated";
  setAuth: (input: { accessToken: string; user: User }) => void;
  setStatus: (status: AuthState["status"]) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  status: "idle",
  setAuth: ({ accessToken, user }) =>
    set({ accessToken, user, status: "authenticated" }),
  setStatus: (status) => set({ status }),
  clear: () => set({ accessToken: null, user: null, status: "unauthenticated" })
}));
