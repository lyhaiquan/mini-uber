# Review: Task 011 - Frontend Monorepo + Shared Packages (Round 1, self-review)

**Task file:** `docs/tasks/011-frontend-monorepo-setup.md`
**Implementer:** Claude (Opus 4.7)
**Reviewer:** self-review for Codex follow-up audit
**Date:** 2026-05-18

---

## Verdict: PASS WITH FIXES (pending Codex audit)

Scaffolding compiles, all unit tests pass, backend remains untouched. Several deferred or uncertain choices are flagged below for Codex to scrutinize.

Verification commands run:

```text
pnpm install                                          → 982 packages resolved, OK
pnpm --filter @ridex/shared-types test                → 3 suites, 14 tests passed
pnpm --filter @ridex/shared-types build               → emitted dist/*.{js,d.ts,*.map}
pnpm --filter @ridex/ui-tokens build                  → emitted dist/*.{js,d.ts,*.map}
pnpm --filter @ridex/backend build                    → clean (backend unaffected)
pnpm exec turbo run test --filter @ridex/shared-types --filter @ridex/ui-tokens
                                                      → 2 successful tasks
```

Backend test suite (444 tests) was NOT re-run in this round; nothing in the diff touches `apps/backend/`, but Codex should confirm with `pnpm --filter @ridex/backend test`.

---

## Summary

Implements Task 011 scaffolding:

- Root: `pnpm-workspace.yaml` now globs `packages/*`; `package.json` switched to `turbo run *` with backend-only scripts preserved as `backend:*`; new `turbo.json` (Turborepo 2.x **`tasks`** key, not legacy `pipeline`).
- `@ridex/config-typescript`: 4 tsconfig presets (`base`, `nextjs`, `expo`, `package-lib`).
- `@ridex/config-eslint`: 4 ESLint presets (`base`, `next`, `expo`, `package`).
- `@ridex/shared-types`: Zod schemas mirroring backend DTOs for auth, rides, drivers, payments, admin, common envelope, WS events. 14 Vitest tests across 3 files.
- `@ridex/ui-tokens`: color/spacing/typography/radius tokens + Tailwind preset.
- `packages/README.md` documents structure and future packages.

---

## Files added / changed

```
M ridex/pnpm-workspace.yaml
M ridex/package.json
A ridex/turbo.json
A ridex/packages/README.md
A ridex/packages/config-typescript/{package.json, base.json, nextjs.json, expo.json, package-lib.json}
A ridex/packages/config-eslint/{package.json, base.js, next.js, expo.js, package.js}
A ridex/packages/shared-types/{package.json, tsconfig.json, tsconfig.build.json, .eslintrc.cjs, vitest.config.ts}
A ridex/packages/shared-types/src/{index.ts, common.ts, auth.ts, rides.ts, drivers.ts, payments.ts, admin.ts, events.ts}
A ridex/packages/shared-types/src/__tests__/{auth.spec.ts, rides.spec.ts, common.spec.ts}
A ridex/packages/ui-tokens/{package.json, tsconfig.json, tsconfig.build.json, .eslintrc.cjs}
A ridex/packages/ui-tokens/src/{index.ts, colors.ts, spacing.ts, typography.ts, radius.ts, tailwind-preset.ts}
```

Total: ~30 files (spec estimated ~20; extras are Vitest config, build tsconfig, eslintrc per package, Tailwind preset module).

---

## Deviations from the task spec

1. **`turbo.json` uses `tasks` not `pipeline`.** Spec example used `"pipeline"`, which is the Turborepo 1.x key. Turborepo 2.x renamed it to `"tasks"`. Using `pipeline` on v2 prints a deprecation warning and falls back; using `tasks` is the current canonical form. Codex: please confirm preference — if v1 syntax is desired for consistency with existing docs, revert and pin `turbo@^1.13`.

2. **Backend scripts renamed to `backend:*` namespace** in root `package.json` so root `pnpm test` / `pnpm build` / `pnpm lint` flow through Turbo (otherwise root `pnpm test` would have called backend Jest directly and bypassed FE packages). Reviewer should verify this doesn't break any existing CI hook. Old names (`build`, `test`, `lint`) now mean "turbo across workspace."

3. **`api-client`, `socket-client`, `ui-web`, `ui-mobile` deliberately deferred** to T012/T013/T016 per spec section "Các package khác … tạo ở task sau".

4. **Test count = 14 (spec target: 6+).** Three suites: auth (6), rides (5), common (3).

---

## Things Codex should scrutinize

### Must verify

- **Backend test suite still 444 passing.** Run `pnpm --filter @ridex/backend test`. The diff doesn't touch `apps/backend/`, but `pnpm-lockfile.yaml` changed; `pnpm install` may have nudged a transitive dependency in backend's resolution graph.
- **Zod schemas vs backend DTOs.** I cross-referenced these backend files but may have drift:
  - `auth/dto/auth-response.dto.ts` (AuthTokensResponse) ↔ `shared-types/src/auth.ts` `authTokensSchema`. `registerDtoSchema` adds optional `role` because the backend register flow currently hardcodes role on the server — verify FE never sends role, OR keep field but flag for stripping before send.
  - `rides/dto/ride-response.dto.ts` ↔ `rides.ts` `rideResponseSchema`. Note: backend uses native `Date` serialized to ISO string; Zod uses `.datetime({ offset: true })` which **requires** offset or `Z`. If backend ever emits naive timestamps (no Z), this will fail parse.
  - `payments/entities/*` — there is no DTO yet; `payments.ts` is a forward guess for T022 (`GET /me/payments`). May be over-spec'd; let Codex prune if too speculative.
  - `admin/dto/dashboard-summary.dto.ts` ↔ `admin.ts`. Strict equivalent.
  - `location/dto/driver-location.dto.ts` ↔ `drivers.ts` `driverLocationDtoSchema`. OK.
- **No backend DTO for `transitionRideDtoSchema` `expectedVersion`** — I included this because Task 003 review discussed optimistic concurrency. Confirm whether the wire DTO actually accepts it; if not, remove.

### Should improve

- **ESLint preset is not actually executed.** No `lint` script on `shared-types`/`ui-tokens` was run end-to-end because peer deps `eslint-plugin-react`, `react-hooks`, `react-native`, `next/core-web-vitals`, `eslint-import-resolver-typescript` are NOT installed in `config-eslint`'s `package.json` — they will only resolve in apps that install them. The `package.js` preset (used by current packages) only needs `@typescript-eslint/*`, `eslint-config-prettier`, `eslint-plugin-import`, which ARE declared. Verify by running `pnpm --filter @ridex/shared-types lint`.
- **`config-eslint/base.js` references `import/resolver: { typescript: true }` but `eslint-import-resolver-typescript` is not in the package deps.** Will not crash because the resolver setting is optional, but `import/no-unresolved` rule won't fire properly for path-aliased imports. Adding `eslint-import-resolver-typescript` is one-line.
- **Tailwind preset is exported as a plain object literal, NOT typed `Config` from `tailwindcss`.** Intentional: avoids dragging `tailwindcss` into `ui-tokens` peer deps. Tradeoff documented here.
- **`@types/node` declared but `tsconfig.base.json` already lists `"types": ["node"]`.** Each consumer package re-installs `@types/node` because backend uses NestJS-specific node types and frontend will use Node 20. Acceptable but verify no version conflict in lockfile.

### Nice to have

- No CHANGELOG per package (deferred per spec).
- No Storybook (out of scope).
- `events.ts` declares socket event names but no `Server → Client` / `Client → Server` directionality; T016/T020 should add a typed `ClientToServerEvents` / `ServerToClientEvents` map for `socket.io-client`.
- No `tsx` runner / no example "consumer" app to prove `import { authTokensSchema } from "@ridex/shared-types"` resolves from outside `packages/`. T012 (web shells) will exercise this; if Codex wants earlier proof, add a 3-line consumer test under `packages/shared-types/src/__tests__/index.spec.ts` importing from `../index`.

### Security checklist (per CLAUDE.md hard rules)

- [x] No secrets in any file (only public design tokens, schema definitions).
- [x] Backend untouched: no auth, RBAC, DB schema, WS, or payment code changed.
- [x] No new dependency that wasn't approved in `FRONTEND_PLAN.md` (zod, turbo, vitest, eslint plugins).
- [x] `shared-types` uses Zod, enabling FE-side runtime validation of API responses (defense against malformed backend output).
- [x] All packages `"private": true`.
- N/A — no DB migration, no WS event registration, no auth bypass surface.

---

## Exact instructions for Codex (audit pass)

1. Run from `D:/MINI-UBER/ridex`:
   ```
   pnpm install
   pnpm --filter @ridex/backend test                          # confirm 444 still passes
   pnpm --filter @ridex/shared-types test                     # expect 14 passed
   pnpm --filter @ridex/shared-types build
   pnpm --filter @ridex/ui-tokens build
   pnpm --filter @ridex/shared-types lint                     # NEW: verify ESLint preset wiring
   pnpm exec turbo run build --dry                            # confirm Turbo graph parses
   ```

2. Diff each Zod schema in `packages/shared-types/src/*.ts` against its backend DTO counterpart (paths listed under "Things Codex should scrutinize → Must verify"). Flag any field drift, especially:
   - nullable vs optional vs required
   - string format (uuid vs plain string; datetime offset requirement)
   - numeric ranges (lat/lng, heading 0..359.999, etc.)
   - enum member completeness

3. Check `packages/config-eslint/base.js` resolves cleanly when extended from a workspace package, NOT only when consumed inside an app. Currently exercised only by `package.js` chain. Either:
   - install `eslint-import-resolver-typescript` in `config-eslint`, OR
   - drop the `import/resolver.typescript` line.

4. Confirm `turbo.json` `tasks` key is correct for the installed Turbo (2.9.14). If `pipeline` is preferred for backwards docs compatibility, request swap.

5. Examine `events.ts` for completeness vs backend gateway events emitted by Tasks 004 (`location.gateway`) and 007 (matching). I may have missed: `ride.offer.accepted`, `ride.offer.declined`, `driver.heartbeat`, etc.

6. Optional: add a "smoke import" test that does `import * as shared from "@ridex/shared-types/dist"` from outside the package directory, to catch any export-map regressions before T016.

Return verdict + actionable items in the same format as previous reviews (e.g. `010-admin-dashboard-basic-r1.md`).
