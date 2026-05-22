import expoConfig from "@ridex/config-eslint/expo";

export default [
  ...expoConfig,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    ignores: [".expo/**", "expo-env.d.ts", "assets/**", "babel.config.js", "metro.config.js", "jest.config.js"]
  }
];
