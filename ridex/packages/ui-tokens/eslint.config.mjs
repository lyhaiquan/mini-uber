import packageConfig from "@ridex/config-eslint/package";

export default [
  ...packageConfig,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    ignores: ["dist/**"]
  }
];
