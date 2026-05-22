# RideX Shared Packages

This directory contains shared packages consumed by the frontend apps under `apps/web-*` and `apps/mobile-*`. All packages are private (no npm publish) and reference each other through `workspace:*`.

## Packages (T011 scaffolding)

| Package | Purpose |
|---|---|
| `@ridex/config-typescript` | tsconfig presets: `base.json`, `nextjs.json`, `expo.json`, `package-lib.json`. |
| `@ridex/config-eslint` | ESLint presets: `base.js`, `next.js`, `expo.js`, `package.js`. |
| `@ridex/shared-types` | Zod schemas + inferred TS types for auth, rides, drivers, payments, admin, WS events. Single source of truth that mirrors backend DTOs. |
| `@ridex/ui-tokens` | Design tokens (colors, spacing, typography, radius) + a Tailwind preset consumed by web + mobile apps. |

## Coming in later tasks

| Package | Added in |
|---|---|
| `@ridex/api-client` | T016 — fetch wrapper, JWT refresh, typed routes. |
| `@ridex/socket-client` | T016 — socket.io-client wrapper. |
| `@ridex/ui-web` | T012 — shadcn/ui registry, shared web components. |
| `@ridex/ui-mobile` | T013 — RN primitives. |

## Conventions

- Every package is `"private": true`, version `0.0.1`.
- Package name prefix: `@ridex/`.
- Source TypeScript in `src/`, compiled output to `dist/`.
- Tests collocated under `src/**/__tests__/` or named `*.spec.ts`.

## Common scripts

From repo root:

```bash
pnpm install                              # bootstrap workspace
pnpm build                                # turbo build all
pnpm test                                 # turbo test all
pnpm --filter @ridex/shared-types test    # one package
pnpm --filter @ridex/shared-types build   # one package
```
