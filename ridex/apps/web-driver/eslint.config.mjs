import nextConfig from "@ridex/config-eslint/next";

export default [
  ...nextConfig,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    ignores: [".next/**", "next-env.d.ts"]
  }
];
