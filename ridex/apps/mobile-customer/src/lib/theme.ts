import { create } from "zustand";

export type ColorScheme = "light" | "dark" | "system";

interface ThemeState {
  scheme: ColorScheme;
  setScheme: (scheme: ColorScheme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  scheme: "system",
  setScheme: (scheme) => set({ scheme })
}));
