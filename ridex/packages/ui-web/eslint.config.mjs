import packageConfig from "@ridex/config-eslint/package";

export default [
  ...packageConfig,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        HTMLElement: "readonly",
        HTMLButtonElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLLabelElement: "readonly",
        HTMLDivElement: "readonly"
      },
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    ignores: ["dist/**", "src/**/__tests__/**"]
  }
];
