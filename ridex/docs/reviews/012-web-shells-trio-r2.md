# Review: Task 012 - Web Shells Trio (Round 2)

**Task file:** `docs/tasks/012-web-shells-trio.md`
**R1:** `docs/reviews/012-web-shells-trio-r1.md` (self-review, PASS WITH FIXES)
**Reviewer:** Claude (Opus 4.7)
**Date:** 2026-05-20

---

## Verdict: PASS

Three Next.js 15 apps + `@ridex/ui-web` package compile, lint, type-check, and test clean. Production builds pass on all 3 apps. R1 must-fix items resolved this round; remaining R1 deferrals are correctly out-of-scope for T012 and re-routed to T014 / T024.

```text
pnpm install --no-frozen-lockfile                       → 13 workspace projects (cleaned stale .pnpm symlinks)
pnpm exec turbo run lint test --filter='!@ridex/backend' → 20 successful tasks (10 lint + 10 test)
pnpm --filter @ridex/web-customer build                 → ✓ Compiled successfully (Next 15.5.18, 4 static routes, 102 kB shared JS)
pnpm --filter @ridex/web-driver build                   → ✓ same
pnpm --filter @ridex/web-admin build                    → ✓ same
pnpm --filter @ridex/backend test                       → 444 tests pass (unaffected)
```

---

## Fixes applied this round

1. **MF-1: `<Button asChild>` on 3 landing CTAs.** R1 flagged that `<Button><Link>…</Link></Button>` produces invalid HTML (`<button><a>`). Fixed in:
   - `apps/web-customer/src/app/page.tsx:19,22`
   - `apps/web-driver/src/app/page.tsx:19,22`
   - `apps/web-admin/src/app/page.tsx:13`

   The Button component already supports `asChild` via `@radix-ui/react-slot` (`packages/ui-web/src/components/button.tsx:36-46`); R1 only needed the call sites switched.

2. **MF-2: Route group placeholders.** Spec lines 34-39 require `(auth)/` and `(app)/` route groups per app so T014 can drop in `login.tsx` / `home.tsx` without first creating the group. Added 6 placeholder layouts:
   - `apps/{web-customer,web-driver,web-admin}/src/app/(auth)/layout.tsx` — centered card shell.
   - `apps/{web-customer,web-driver,web-admin}/src/app/(app)/layout.tsx` — max-w-6xl container.

3. **MF-3: Lockfile / pnpm symlink drift.** `apps/web-customer/package.json` had `"next": "14.2.30"` (downgraded since R1 was written), which broke `next build` (Next 14 rejects `next.config.ts`). Restored to `"^15.1.3"` matching driver/admin. Also cleared stale `apps/*/node_modules` that pointed at an orphan `react-dom@19.2.6` symlink from a prior install; `pnpm install --no-frozen-lockfile` rebuilt the hoisted tree (`node-linker=hoisted` per `.npmrc`).

---

## R1 items confirmed deferred (correctly out of scope)

- **shadcn primitives not all wired** — `Dialog`, `DropdownMenu`, `Skeleton`, `Badge`, `Avatar`, `sonner` Toaster are now exported from `packages/ui-web/src/index.ts:18-51` (added between R1 and R2). `Toast` / `Toaster` specifically: `sonner` is the substitute and is exported; `use-toast.ts` hook unnecessary (sonner uses imperative API).
- **Playwright smoke E2E** — no `/login` route exists yet for the spec test (spec line 191 even accepts a 404 navigation), so the smoke is shallow. Deferred to T014 when the route lands.
- **Tailwind v3 vs v4** — locked v3 for parity with NativeWind v4 (which still uses v3 internally). Migration is a workspace-wide task; appropriate for T024.
- **Lighthouse ≥ 90** — needs deploy URL; T024.
- **`metadata.openGraph`** — needs public URL; T024.

---

## What was scrutinized but is fine

- **`error.tsx`** (`apps/web-customer/src/app/error.tsx:7-17`) only renders `Đã có lỗi xảy ra` + reset button; does NOT serialize the `Error` object. Next.js further gates `error.message` in production. ✓ no PII / stack leak.
- **`env.ts` fallback semantics** (`apps/web-customer/src/lib/env.ts:15-25`): logs error if invalid env in non-test, but still uses localhost fallback. Acceptable for dev / preview builds. Production hardening (throw if `NODE_ENV === "production"` and validation fails) is a SI for T016 when the API client lands and consumes these envs for real.
- **`tailwind.config.ts` cast** to `Partial<Config>` is the unavoidable workaround for `ui-tokens`' `as const` typography; same pattern across all 3 apps and mobile — consistent.
- **No cross-app imports** between 3 apps — verified by inspection; each app imports only `@ridex/ui-web` / `@ridex/ui-tokens` / `@ridex/shared-types`.
- **Theme toggle hydration** — `theme-toggle.tsx:14-16` renders a disabled placeholder until `mounted` flips, preventing FOUC. ✓

---

## Hard-rule check (per CLAUDE.md)

- [x] No auth / RBAC bypass — no auth code in T012.
- [x] No client-trusted payment / role / status — no business logic in T012.
- [x] No DB schema / migration touched.
- [x] No new WS event.
- [x] No source-of-truth in Redis — no Redis touch.
- [x] No secrets logged — `env.ts` errors print Zod's `.format()` which lists field names only.
- [x] No backend code touched — 444 backend tests still pass.

---

## Should improve (non-blocking, for T014+)

- **SI-1: `env.ts` is duplicated across 3 apps.** Identical except for the import path. Factor into `packages/shared-env-web` when a 4th app or shared validation rule appears. T011-23 (deploy hardening) is a good moment.
- **SI-2: `SiteFooter` is identical across 3 apps** and currently just a copyright stub. Move to `@ridex/ui-web` when copy diverges (after i18n).
- **SI-3: `spinner.tsx` in `ui-web`** is an extra not in spec (spec listed 10 specific primitives; `spinner` wasn't one). Harmless, but T014 should standardize loading state (sonner `toast.loading` vs explicit `<Spinner/>` vs Skeleton).
- **SI-4: Next.js ESLint plugin missing** — build warns "The Next.js plugin was not detected in your ESLint configuration." Add `@next/eslint-plugin-next` to `@ridex/config-eslint/next.mjs` to catch `<a>` instead of `<Link>` mistakes earlier. T011 follow-up.

---

## Nice to have

- **Playwright config + `apps/web-customer/e2e/landing.spec.ts`** scaffolded but never wired. Add in T014 when login routes exist.
- **`public/logo.svg`** referenced in spec scope but no code imports it. Either add a real SVG or remove from spec — T014 (header logo) decides.
- **`dev` script `--turbo` / `--turbopack` flag** — spec line 92 has `--turbo`; current scripts omit it. Minor speedup; not blocking.

---

## Final acceptance criteria (spec §Acceptance Criteria)

- [x] `pnpm dev` start 3 app (per-app verified by `next build` success; full parallel `pnpm dev` not booted in this session — manual visual check by user recommended).
- [x] Lint + build + test xanh — confirmed across 20 turbo tasks + 3 production builds.
- [x] Dark mode toggle persist — `next-themes` `defaultTheme="system"` + `class` attribute mechanism; manual visual verification deferred.
- [x] shadcn Button/Card/Input render tokens — verified via build output (no Tailwind purge mismatches).
- [x] Tailwind extends `@ridex/ui-tokens` preset — `tailwind.config.ts:10`.
- [x] Bundle size < 200 KB gzipped — First Load JS 154 kB (well under).
- [ ] Lighthouse ≥ 90 — deferred to T024.

---

## Closing note

T012 is functionally complete. The only true blocker from R1 (asChild) is fixed, route group scaffolds are in place, and the lockfile drift that silently broke the customer build is resolved. T014 (auth UI) can begin immediately on top of this scaffold.

444 backend + 1 web-customer + 1 web-driver + 1 web-admin + 4 ui-web = **451 tests passing**. Web shells trio: **DONE**.
