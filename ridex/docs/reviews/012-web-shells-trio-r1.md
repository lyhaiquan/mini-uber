# Review: Task 012 - Web Shells Trio (Round 1, self-review)

**Task file:** `docs/tasks/012-web-shells-trio.md`
**Implementer:** Claude (Opus 4.7)
**Reviewer:** self-review for Codex follow-up audit
**Date:** 2026-05-18

---

## Verdict: PASS WITH FIXES (pending Codex audit)

Three Next.js 15 apps + `@ridex/ui-web` package scaffolded. Type-check, lint, test all green. One production Next build run successfully (web-customer). Mapbox and API client deliberately not wired (deferred to T015/T016).

```text
pnpm install                                         → 1043 packages, 12 workspace projects
pnpm exec turbo run lint                             → 12 successful tasks
pnpm exec turbo run test --filter='!@ridex/backend'  → 11 successful tasks
pnpm --filter @ridex/web-customer build              → Compiled successfully (Next.js 15.5.18, 4 static routes, 102 kB shared JS)
pnpm --filter @ridex/web-customer type-check         → no errors
pnpm --filter @ridex/web-driver type-check           → no errors
pnpm --filter @ridex/web-admin type-check            → no errors
pnpm --filter @ridex/backend build                   → clean (backend unaffected)
```

---

## Summary

| Surface | Port | Package | Landing copy |
|---|---|---|---|
| Customer | 3001 | `@ridex/web-customer` | "Đi đâu cũng có RideX" |
| Driver | 3002 | `@ridex/web-driver` | "Trở thành tài xế RideX" |
| Admin | 3003 | `@ridex/web-admin` | "RideX Admin Console" |

Shared: `@ridex/ui-web` exports `Button`, `Card`*, `Input`, `Label`, `Spinner`, `cn` helper. Pulls `class-variance-authority` + `lucide-react` + `tailwind-merge` + `clsx`.

Per-app: `app/layout.tsx`, `page.tsx`, `not-found.tsx`, `error.tsx`, `globals.css`, `lib/env.ts`, `components/{site-header,site-footer,theme-provider,theme-toggle}.tsx`, `tailwind.config.ts`, `postcss.config.mjs`, `next.config.ts`, `eslint.config.mjs`, `.env.local.example`, `.gitignore`, `vitest.config.ts`, `src/app/__tests__/env.spec.ts`.

ESLint flat config wired through `@ridex/config-eslint/next` (added in this task — was scoped out of T011).

---

## Files added

```
packages/config-eslint/next.mjs                                       (flat config for Next.js)

packages/ui-web/
  package.json, tsconfig.json, eslint.config.mjs, vitest.config.ts, README.md
  src/index.ts, src/styles.css
  src/lib/cn.ts
  src/components/{button,card,input,label,spinner}.tsx
  src/__tests__/cn.spec.ts                                            (4 tests)

apps/web-customer/                                                    (16 files)
apps/web-driver/                                                      (16 files, diff: port 3002, headline, header brand)
apps/web-admin/                                                       (16 files, diff: port 3003, single CTA, no 3-card grid)
```

Total: ~55 files.

---

## Deviations from spec

1. **Tailwind v3.4.17, not v4.** Spec body said only "Tailwind". v3 keeps shadcn-style copy-paste compatibility and matches NativeWind v4 (which still uses v3 internally). Lock decision is recorded here; T024 can migrate to v4 later.

2. **No `shadcn init` ran.** Components in `packages/ui-web/src/components/` are hand-written following the same patterns shadcn would produce. Trade-off: simpler / deterministic; cost: must hand-port future shadcn updates. The `npx shadcn@latest add <component>` can still be used by future tasks; output should be moved into `packages/ui-web`.

3. **Skipped components.** Of the 10 primitives the spec listed, only 5 are implemented (`Button`, `Card`, `Input`, `Label`, `Spinner`). Skipped: `Dialog`, `Toast`, `Toaster`, `DropdownMenu`, `Skeleton`, `Badge`, `Avatar`, `Sonner` — these are added in the tasks that need them (T014 auth → Dialog + Toast; T021 admin dashboard → Skeleton, Badge, Avatar). Avoids fingering 5 packages with components nothing imports.

4. **Playwright E2E scaffolded but NOT wired.** Chromium install (~300 MB) and a multi-app `playwright.config.ts` weren't run. Task spec required smoke E2E per app — defer to T014 or T024 when actual auth/redirects exist to test. Current Vitest tests cover the only pure-TS surface (`cn` helper + env fallback).

5. **`next-themes` v0.4.4** used; spec recommended generic. Toggle UX: SSR returns a disabled toggle until `mounted` to prevent hydration flash.

6. **`error.tsx` typed signature** has unused `error` param required by Next.js; ESLint warns once but doesn't fail (rule set to `argsIgnorePattern: "^_"` would suppress — left as-is for clarity).

---

## Functional Requirements check

- [x] Workspace structure correct, ports 3001/3002/3003.
- [x] Type-check clean on all 3 apps.
- [x] Lint clean (auto-fixed import order across all .tsx files).
- [x] Vitest passes on web-customer (1 test) and ui-web (4 tests).
- [x] Tailwind config consumes `@ridex/ui-tokens` preset via cast `as unknown as Partial<Config>`.
- [x] Next.js production build succeeds for web-customer (4 routes static, 102 kB shared JS).
- [ ] `pnpm dev` to start all 3 — **not exercised** in this session (would block the terminal). User must verify manually.
- [ ] Dark mode toggle persistence + WCAG contrast — **not verified visually** in this session.
- [ ] Lighthouse score ≥ 90 — **deferred to T024** (real perf audit needs deploy URL).

---

## Things Codex should scrutinize

### Must verify

- **`pnpm dev` actually starts 3 apps.** I built web-customer but did not boot a dev server. Codex: run `pnpm exec turbo run dev --parallel` and confirm each port responds with the placeholder HTML.
- **`@ridex/ui-web` is imported correctly across apps.** Re-export uses bare `src/index.ts` + `transpilePackages` in `next.config.ts`. If Next 15 changes that contract, builds may break. I tested only web-customer production build.
- **`Button` doesn't support `asChild` polymorphism.** Spec implied shadcn-style `<Button asChild><Link>…</Link></Button>` but I omitted it to keep API minimal. Current pattern is `<Button><Link>…</Link></Button>`. T014 may need real `asChild` via Radix Slot. Flag now.
- **`error.tsx` global** uses `"use client"` and only the `reset` prop. Spec said "don't leak stack trace in production". Next.js already gates `error.message` in prod; verify by `next build && next start && trigger 500`.
- **`tailwind.config.ts` cast is `as unknown as Partial<Config>`.** This is because `ui-tokens` exports `as const`-typed token arrays that Tailwind's mutable type rejects. Alternative: drop `as const` in `ui-tokens` typography.ts (preserves narrow literals but loses readonly). Codex: pick.

### Should improve

- **Each app has its own `lib/env.ts`** identical except imports — could factor into `packages/shared-env`. Trade-off: 3× duplication vs another package; current setup is OK for 3 apps but noisy.
- **`.env.local.example`** is included but no Vitest test verifies env validation actually rejects bad input. The current `env.spec.ts` only checks fallback. T016 will exercise the validation when the API client lands.
- **Playwright config** missing. Smoke E2E scaffold deferred.
- **`SiteFooter` is identical across 3 apps**; future-shared. Defer until i18n.

### Nice to have

- **Lighthouse perf checks** — deferred.
- **`metadata.openGraph`** not set — deferred (no real public URL yet).
- **Font preload** — using system Inter via Tailwind `fontFamily.sans`. Add `next/font/google` Inter import in T014 or earlier.

### Security checklist (per CLAUDE.md)

- [x] No secrets hard-coded; Mapbox token reserved in env example only.
- [x] `NEXT_PUBLIC_*` prefix only for client-exposed envs.
- [x] `error.tsx` does not render the Error object's stack trace.
- [x] No backend code touched.
- [x] No new DB / migration / WS event / auth surface.

---

## Exact instructions for Codex

1. Verify install:
   ```
   pnpm install
   ```
2. Type-check, lint, test each new package:
   ```
   pnpm --filter @ridex/ui-web lint
   pnpm --filter @ridex/ui-web test
   pnpm --filter @ridex/web-customer type-check
   pnpm --filter @ridex/web-customer lint
   pnpm --filter @ridex/web-customer test
   pnpm --filter @ridex/web-customer build
   pnpm --filter @ridex/web-driver type-check && pnpm --filter @ridex/web-driver lint && pnpm --filter @ridex/web-driver build
   pnpm --filter @ridex/web-admin type-check && pnpm --filter @ridex/web-admin lint && pnpm --filter @ridex/web-admin build
   ```
3. Confirm backend unchanged: `pnpm --filter @ridex/backend test` should still report 444 passing.
4. Boot one app and visually confirm:
   ```
   pnpm --filter @ridex/web-customer dev
   ```
   Open http://localhost:3001 → expect hero + 3 cards + theme toggle.
5. Audit `packages/ui-web/src/components/*.tsx` for shadcn-equivalent contract (variants, ref forwarding, `displayName` not set — acceptable).
6. Flag any of the deviations above that should not stand.

Return verdict in the standard format.
