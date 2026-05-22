import { baseConfig } from "./base.mjs";

/**
 * Flat config for library packages under packages/*.
 * Adds node-only globals; otherwise identical to base.
 */
export const packageConfig = [
  ...baseConfig,
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
    languageOptions: {
      globals: {
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly"
      }
    }
  }
];

export default packageConfig;
