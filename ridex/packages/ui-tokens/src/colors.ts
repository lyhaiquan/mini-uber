export const colors = {
  primary: {
    50: "#eef9ff",
    100: "#d8f0ff",
    200: "#b1e1ff",
    300: "#7ccaff",
    400: "#3aabff",
    500: "#0a84ff",
    600: "#0567d6",
    700: "#0851a8",
    800: "#0b3f80",
    900: "#0b3a8a"
  },
  surface: {
    0: "#ffffff",
    50: "#fafafa",
    100: "#f5f5f7",
    200: "#e5e5e7",
    300: "#d2d2d7",
    700: "#3a3a3c",
    800: "#1c1c1e",
    900: "#0b0b0d"
  },
  text: {
    primary: "#0b0b0d",
    secondary: "#6c6c70",
    tertiary: "#aeaeb2",
    inverse: "#ffffff"
  },
  state: {
    success: "#10b981",
    warning: "#f59e0b",
    error: "#ef4444",
    info: "#0a84ff"
  },
  brand: {
    uberBlack: "#000000",
    uberWhite: "#ffffff"
  }
} as const;

export type ColorTokens = typeof colors;
