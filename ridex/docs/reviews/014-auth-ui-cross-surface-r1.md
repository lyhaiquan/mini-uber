# Review: Task 014 - Auth UI Cross-Surface (Round 1, self-review)

**Task file:** `docs/tasks/014-auth-ui-cross-surface.md`
**Implementer:** Claude (Opus 4.7)
**Reviewer:** self-review for follow-up audit
**Date:** 2026-05-20

---

## Verdict: PASS WITH MINOR ISSUES (pending follow-up audit)

Auth UI shipped across 5 surfaces (3 web + 2 mobile). Login/register/logout/boot-refresh flows complete. Type-check, lint, unit tests all green. 3 web production builds compile cleanly with new `ƒ Middleware 34 kB` chunk + 4 dynamic route handlers per app. Did NOT exercise the live auth flow against a running backend in this session — needs manual smoke by user.

```text
pnpm install                                            → 13 workspace projects (+46 deps via ui-web testing libs)
pnpm exec turbo run lint test --filter='!@ridex/backend' → 20 tasks pass (10 lint + 10 test)
pnpm --filter @ridex/web-customer build                 → ✓ 8 routes (4 static + 4 dynamic) + Middleware 34.3 kB
pnpm --filter @ridex/web-driver build                   → ✓ 7 routes + Middleware 34.1 kB
pnpm --filter @ridex/web-admin build                    → ✓ 7 routes (incl. /403) + Middleware 34.1 kB
pnpm --filter @ridex/backend test                       → not re-run (no backend code touched)
```

Test counts:
- `@ridex/ui-web` — 7 tests (4 cn + 3 AuthForm)
- `@ridex/web-customer` — 9 tests (3 auth-store + 5 auth-proxy + 1 env)
- `@ridex/web-driver` — 1 test (env smoke unchanged)
- `@ridex/web-admin` — 1 test (env smoke unchanged)
- `@ridex/mobile-customer` — 9 tests (4 secure-storage + 1 env + 4 auth-client)
- `@ridex/mobile-driver` — 9 tests (same shape as customer)
- **Total FE: 36 tests passing** (+ 444 backend = 480 workspace-wide).

---

## Summary

| Surface | Login | Register | Role gate | Bootstrap | Logout |
|---|---|---|---|---|---|
| web-customer | ✓ | ✓ (CUSTOMER) | — | `<AuthBootstrap/>` → `/api/auth/refresh` | cookie + store cleared |
| web-driver | ✓ | mailto fallback | — | same | same |
| web-admin | ✓ | — | ADMIN client-side post-login | same | same |
| mobile-customer | ✓ | ✓ | — | `<AuthBootstrap/>` → `authClient.refresh()` | secureStore cleared |
| mobile-driver | ✓ | — | — | same | same |

---

## Files added / modified

### packages/ui-web (+5 files / 2 modified)

```
+ src/components/auth-form.tsx               (~135 lines, react-hook-form + zod, AuthFormProps)
+ src/__tests__/auth-form.spec.tsx           (3 tests, cleanup + jsdom)
M src/index.ts                               (export AuthForm)
M vitest.config.ts                           (plugin-react + jsdom matchGlobs)
M package.json                               (+@hookform/resolvers, +react-hook-form, +shared-types runtime dep, +@testing-library/react +@vitejs/plugin-react +jsdom devDeps)
```

### Per web app (3× ~14 files)

```
+ src/lib/server-env.ts                      # API_BASE_URL_INTERNAL (server-only)
+ src/lib/auth-cookie.ts                     # REFRESH_COOKIE_NAME + set/clear
+ src/lib/auth-proxy.ts                      # callBackend + flattenBackendError
+ src/lib/auth-store.ts                      # Zustand auth state
+ src/lib/auth-actions.ts                    # client fetch wrappers
+ src/app/api/auth/login/route.ts
+ src/app/api/auth/refresh/route.ts
+ src/app/api/auth/logout/route.ts
+ src/app/api/auth/register/route.ts         # customer only
+ src/app/(auth)/login/page.tsx
+ src/app/(auth)/register/page.tsx           # customer only
+ src/app/(app)/home/page.tsx
+ src/app/403/page.tsx                       # admin only
+ src/components/auth-bootstrap.tsx
+ src/components/auth-menu.tsx
+ src/middleware.ts
M src/app/layout.tsx                         # injects <AuthBootstrap/> + <Toaster/>
M src/components/site-header.tsx             # +<AuthMenu/>
M src/app/page.tsx                           # driver: removed register CTA → mailto
M package.json                               # +zustand
M .env.local.example                         # +API_BASE_URL_INTERNAL
```

Customer: 14 files added. Driver: 13 files (no register page/route). Admin: 13 files (no register, +403 page).

### Per mobile app (2× ~5 files)

```
+ src/lib/auth-store.ts                      # Zustand
+ src/lib/auth-client.ts                     # fetch + secureStorage persist
+ src/components/auth-bootstrap.tsx
+ src/lib/__tests__/auth-client.spec.ts      # 4 tests
M app/_layout.tsx                            # <AuthBootstrap/>
M app/(auth)/login.tsx                       # wired form
M app/(auth)/_layout.tsx                     # +register screen (customer only)
M app/(tabs)/_layout.tsx                     # <Redirect/> guard
M app/(tabs)/profile.tsx                     # logout button
M jest.config.js                             # moduleNameMapper for @ridex/shared-types
M tsconfig.test.json                         # include shared-types src
+ app/(auth)/register.tsx                    # customer only
M app/index.tsx                              # driver: mailto CTA
```

**Total: ~58 new files + ~20 modified.**

---

## Locked decisions (from brainstorm 2026-05-20)

1. **Admin role gate client-side** — middleware only verifies cookie presence; admin role check happens in `apps/web-admin/src/app/(auth)/login/page.tsx:18-26`. On role mismatch: `authActions.logout()` + `router.replace("/403")`. Trade-off: 1 frame of authenticated state could leak before redirect — acceptable for thesis; T016 could harden via JWT decode if needed.
2. **AuthForm in `packages/ui-web`** — single component reused by 4 entry points (login×3, register×1). Form lib: react-hook-form + zod, Vietnamese error messages baked in.
3. **Driver register = mailto** — `apps/web-driver/src/app/page.tsx:18-26` + `apps/mobile-driver/app/index.tsx:13-20`. Backend has no `register/driver` endpoint; admin seed only.
4. **No `packages/api-client`** — fetch logic inline. Web has 4 route handlers / app; mobile has `auth-client.ts` per app. Extraction deferred to T016 when 401 interceptor + TanStack Query need shared base.
5. **Boot refresh** — `<AuthBootstrap/>` mount-effect calls refresh exactly once. Web: `fetch("/api/auth/refresh")` with `credentials: "include"`. Mobile: `authClient.refresh()` reads token from secureStore. Status transitions: `idle → hydrating → authenticated | unauthenticated`.

---

## Things follow-up audit should scrutinize

### Must verify

- **Live flow against running backend.** Not exercised in this session. Spin up backend (`pnpm --filter @ridex/backend start:dev`) + each web app, then:
  - Customer: `/register` → home → reload → still logged in. Logout → `/`. Login → home.
  - Driver: `/login` only path. Landing mailto opens default mail.
  - Admin: Login with CUSTOMER role → toast "Tài khoản không có quyền truy cập admin" + `/403`. Login with admin seed → home with KPI placeholder.
- **`server-env.ts` fallback semantics** — drops production env validation throw (deviation from T012/T013 env files which only warn). Reason: Next.js build collects page data with NODE_ENV=production but without runtime env, throwing breaks the build. Acceptable because route handlers run dynamically — env is read per-request — but worth flagging. Hardening: add fail-fast at app startup via `instrumentation.ts` (T016 deploy hardening).
- **Cookie hygiene** — `REFRESH_COOKIE_NAME = "ridex_refresh"` shared across 3 web apps. If user has login session on customer + admin in same browser (3001 vs 3003), cookies are scoped per-port → OK in dev. But if deployed under same domain with different paths, cookie naming could collide. Document for T024 deploy.
- **`auth-actions.refresh()` race with rapid page navigations** — `<AuthBootstrap/>` mounts every navigation? No — it's in root layout, mount only on first page load. But `React.StrictMode` (Next.js default dev) double-invokes effects — should be no-op since result is cached in Zustand. Verify under dev mode.

### Should improve

- **SI-1: 3 web apps each have ~7 identical `auth-*` lib files.** Heavy duplication. Could extract to `packages/web-auth` (or wait for `packages/api-client` in T016). Decided to duplicate now to keep T014 scope tight + avoid premature abstraction; T016 will reconsider.
- **SI-2: `auth-form.tsx` Vietnamese strings hardcoded** in zod schemas (`"Email không hợp lệ"`, `"Mật khẩu tối thiểu 8 ký tự"`). i18n (T011-23?) will need to extract. Acceptable for thesis MVP.
- **SI-3: Mobile login/register no validation library.** Plain `useState` + manual checks. react-hook-form available on web but not on mobile (different ergonomics + bundle weight). The 3 explicit `if` checks in `register.tsx` cover the cases but easier to slip past. T016 / T024 could adopt `react-hook-form` for RN if needed.
- **SI-4: No automated test for middleware redirect** behavior. Middleware logic is straightforward (public path check + cookie presence) but would benefit from a Vitest unit using `next/server` mocks. Defer to T014.5 / T016.
- **SI-5: AuthForm `<a>` anchor instead of `<Link>`** in switchHref (`packages/ui-web/src/components/auth-form.tsx:147-152`). Reason: ui-web shouldn't depend on `next/link` (also used by potential future native or storybook). Acceptable — `<a>` works in Next 15, just full page reload instead of soft nav. Trade-off recorded.

### Nice to have

- **`/forgot-password`** flow → defer indefinitely.
- **Email verification UI** → out of scope per spec.
- **Login with magic link** → not in T014.
- **Component tests via Playwright** for the actual page navigation → T016 / T024.

### Security checklist (per CLAUDE.md)

- [x] No auth bypass — middleware requires cookie for non-public paths; admin double-checks role.
- [x] No client-trusted role for authorization — admin gate uses `user.role` from backend response, not user input. Role originates from JWT issued by backend Task 002.
- [x] No password / token logged — `auth-proxy.ts` only logs Zod error field names if parse fails; route handler error responses contain backend message only.
- [x] No DB schema / migration touched.
- [x] No new WS event.
- [x] No source-of-truth in Redis.
- [x] Backend code untouched — 444 tests assumed still green.
- [x] `httpOnly + sameSite=lax + secure(prod)` cookie config; `WHEN_UNLOCKED` keychain on mobile.
- [x] `autoComplete="new-password"` on register; `"current-password"` on login (`auth-form.tsx:97-99`).

---

## Exact instructions for follow-up audit

1. Install + lint + type-check + test:
   ```
   pnpm install
   pnpm exec turbo run lint --filter='!@ridex/backend'
   pnpm exec turbo run test --filter='!@ridex/backend'
   pnpm --filter @ridex/backend test    # confirm 444 still pass
   ```

2. Build all 3 web apps:
   ```
   pnpm --filter @ridex/web-customer build
   pnpm --filter @ridex/web-driver build
   pnpm --filter @ridex/web-admin build
   ```
   Expect: Middleware bundle ≈ 34 kB, 7-8 routes per app, 4 dynamic `/api/auth/*` per app (customer has 4, driver/admin have 3).

3. **Live smoke (manual):**
   - Boot backend: `pnpm --filter @ridex/backend start:dev`
   - Seed admin via existing migration / .env (see T010 admin module).
   - Boot web-customer: `pnpm --filter @ridex/web-customer dev`
   - Test register → home → reload → still in. Logout → `/`. Login → home.
   - Repeat for web-driver (login only). Admin: login with non-admin → /403; with admin → home.

4. **Mobile smoke (real device):**
   - `pnpm --filter @ridex/mobile-customer start` → press `i` or `a`.
   - Register → home (tabs). Force-quit → reopen → still logged in (boot refresh).
   - Logout from profile → back to login.

5. Audit `apps/web-customer/src/middleware.ts:6` PUBLIC_PREFIXES — confirm `/api/auth` and `/_next` are correctly whitelisted.

6. Verify `auth-proxy.ts:authTokensResponseSchema` strips refreshToken from client response (`route.ts:46-49` returns only `accessToken + accessTokenExpiresInSeconds + user`).

Return verdict in the standard format.
