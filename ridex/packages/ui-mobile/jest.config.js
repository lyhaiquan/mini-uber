/**
 * Component tests for shared mobile primitives. Avoids `jest-expo` because the
 * preset pulls in RN's NativePlatformConstantsIOS shim chain, which fails
 * under pnpm's isolated `.pnpm/` layout. Instead we mock `react-native` with
 * lightweight host-component stubs and render through `react-test-renderer`.
 * Maestro E2E (T025) covers the real native rendering layer.
 */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.test.json" }]
  },
  moduleNameMapper: {
    "^react-native$": "<rootDir>/__mocks__/react-native.tsx",
    "^nativewind$": "<rootDir>/__mocks__/nativewind.tsx",
    "^react-native-safe-area-context$": "<rootDir>/__mocks__/react-native-safe-area-context.tsx"
  }
};
