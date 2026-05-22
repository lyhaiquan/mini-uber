import { baseConfig } from "./base.mjs";

/**
 * Flat config for Expo / React Native apps. Adds RN globals.
 * React Native lint plugins are intentionally not wired here — they don't
 * publish stable flat-config exports yet. Treat this as a TS-only baseline.
 */
export const expoConfig = [
  ...baseConfig,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      globals: {
        __DEV__: "readonly",
        fetch: "readonly",
        FormData: "readonly",
        navigator: "readonly",
        global: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly"
      }
    },
    rules: {
      "no-console": "off"
    }
  },
  {
    ignores: ["android/**", "ios/**", ".expo/**", "expo-env.d.ts"]
  }
];

export default expoConfig;
