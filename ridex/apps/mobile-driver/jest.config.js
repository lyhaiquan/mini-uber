/**
 * Minimal Jest config — avoids `jest-expo` preset, which pulls in React Native's
 * Flow-typed setup files that don't transform cleanly under pnpm's nested layout.
 * Tests in this package only exercise pure TS modules (env, secure-storage) with
 * `expo-secure-store` and `expo-constants` mocked in jest.setup.js. The native
 * UI layer is covered by Maestro E2E in T024, not by Jest here.
 */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.spec.ts", "**/__tests__/**/*.spec.tsx"],
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.test.json" }]
  },
  setupFiles: ["./jest.setup.js"],
  moduleNameMapper: {
    "^@rnmapbox/maps$": "<rootDir>/__mocks__/@rnmapbox-maps.js",
    "^expo-secure-store$": "<rootDir>/jest.setup.js",
    "^expo-constants$": "<rootDir>/jest.setup.js",
    "^expo-location$": "<rootDir>/__mocks__/expo-location.js",
    "^expo-linking$": "<rootDir>/__mocks__/expo-linking.js",
    "^@ridex/shared-types$": "<rootDir>/../../packages/shared-types/src/index.ts"
  }
};
