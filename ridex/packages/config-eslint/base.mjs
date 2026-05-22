import typescriptEslint from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import prettierConfig from "eslint-config-prettier";

/**
 * Base flat config for TypeScript packages. Pure TS, no React/RN.
 * Consumers extend with their own languageOptions.parserOptions.project + tsconfigRootDir.
 */
export const baseConfig = [
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
    languageOptions: {
      parser: typescriptParser,
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly"
      }
    },
    plugins: {
      "@typescript-eslint": typescriptEslint,
      import: importPlugin
    },
    rules: {
      ...typescriptEslint.configs.recommended.rules,
      "@typescript-eslint/consistent-type-imports": ["warn", { prefer: "type-imports" }],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ],
      "import/order": [
        "warn",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true }
        }
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }]
    }
  },
  {
    ...prettierConfig,
    files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"]
  },
  {
    ignores: ["dist/**", "node_modules/**", ".next/**", ".turbo/**", "coverage/**", "build/**"]
  }
];

export default baseConfig;
