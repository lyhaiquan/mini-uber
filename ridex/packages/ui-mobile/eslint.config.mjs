import expoConfig from "@ridex/config-eslint/expo";

export default [
  ...expoConfig,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname
      }
    }
  }
];
