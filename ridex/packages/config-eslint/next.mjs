import { baseConfig } from "./base.mjs";

/**
 * Flat config for Next.js 15 apps. Adds browser + dom globals.
 * React-specific lint rules are deferred to Next's built-in `next lint` until
 * eslint-plugin-react publishes a stable flat-config build.
 */
export const nextConfig = [
  ...baseConfig,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        fetch: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        HTMLElement: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly"
      }
    },
    rules: {
      "no-console": "off"
    }
  },
  {
    ignores: [".next/**", "next-env.d.ts", "public/**"]
  }
];

export default nextConfig;
