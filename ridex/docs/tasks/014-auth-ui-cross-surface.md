# Task 014: Auth UI Cross-Surface

## Task Name

Implement login + register screens trên cả 5 surface (3 web + 2 mobile). Token storage (httpOnly cookie web, secure-store mobile), auth Zustand store, route guard, logout, boot refresh. Re-use Task 002 backend endpoints.

## Goal

User mở bất kỳ app nào → register hoặc login → app lưu token an toàn → navigate tới authenticated route. Refresh page (web) hoặc reopen app (mobile) phải giữ session qua boot refresh. Logout xóa token + redirect login. Admin app gate role ADMIN client-side.

## Context

- Backend Task 002 có `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`. Response shape: `{ accessToken, refreshToken, accessTokenExpiresInSeconds, user: { id, email, role } }`. Endpoint base = `/api/v1`.
- Web app dùng httpOnly cookie cho refresh token (set qua Next.js Route Handler proxy). Access token giữ trong memory + Zustand store.
- Mobile dùng `expo-secure-store` cho cả access + refresh token + userId + userRole.
- T011 đã có Zod schemas trong `@ridex/shared-types` (`authTokensSchema`, `userSchema`, etc.). T012, T013 đã có app shells + route group placeholders.
- 401 auto-refresh interceptor defer T016.

## Locked design decisions (2026-05-20)

1. **Admin role gating** — middleware Next.js chỉ check `ridex_refresh` cookie tồn tại. Sau login client check `user.role !== "ADMIN"` → gọi `authActions.logout()` (clear cookie) + redirect `/403`. Không thêm cookie thứ 2.
2. **AuthForm location** — `packages/ui-web/src/components/auth-form.tsx`, react-hook-form + zod. Component nhận `mode`, `title`, `submitLabel`, `onSubmit` props; tự render email + password + (optional) confirmPassword.
3. **Driver register UX** — web-driver KHÔNG có `/register` route. Landing CTA "Đăng ký lái xe" → mailto link "Liên hệ vận hành để đăng ký" (`mailto:ops@ridex.local`).
4. **API client package** — KHÔNG tạo `packages/api-client` ở T014. Logic fetch inline:
   - Web: route handlers (`app/api/auth/*`) gọi backend; client lib `auth-actions.ts` post tới route handlers.
   - Mobile: `src/lib/auth-client.ts` per-app gọi backend trực tiếp.
   - T016 sẽ extract khi có refresh interceptor + TanStack Query.
5. **Boot refresh** — `<AuthBootstrap/>` component mount-effect gọi `/api/auth/refresh` (web) hoặc `authClient.refresh()` (mobile) một lần khi app load. Thành công → hydrate Zustand. Thất bại → clear cookie/secure-store + set status `unauthenticated`.

## Cookie config (web)

- Name: `ridex_refresh`
- httpOnly: `true`
- secure: `true` (production) / `false` (dev)
- sameSite: `lax`
- path: `/`
- maxAge: `7 * 24 * 60 * 60` (7 ngày, match `JWT_REFRESH_TTL`)

Access token KHÔNG vào cookie (client-only, memory).

## Files / folders

### packages/ui-web

```
packages/ui-web/src/
  components/auth-form.tsx                # react-hook-form + zod, AuthFormProps
  __tests__/auth-form.spec.tsx            # 3 tests
  index.ts                                # export AuthForm + types
package.json                              # +react-hook-form, +@hookform/resolvers, +shared-types
                                          # devDeps: @testing-library/react, jsdom, @vitejs/plugin-react
vitest.config.ts                          # plugin-react + jsdom environmentMatchGlobs
```

### Per web app (web-customer, web-driver, web-admin)

```
apps/<app>/src/
  lib/
    server-env.ts                         # API_BASE_URL_INTERNAL Zod parse + fallback
    auth-cookie.ts                        # REFRESH_COOKIE_NAME + set/clear helpers
    auth-proxy.ts                         # callBackend() + flattenBackendError + authTokensResponseSchema
    auth-store.ts                         # Zustand: { accessToken, user, status, setAuth, setStatus, clear }
    auth-actions.ts                       # client-side: login/register/refresh/logout via fetch /api/auth/*
  app/api/auth/
    login/route.ts                        # POST → backend, set cookie, return access+user
    register/route.ts                     # POST → backend, set cookie (CUSTOMER) — customer app only
    refresh/route.ts                      # read cookie → backend → rotate cookie
    logout/route.ts                       # backend best-effort + clear cookie
  app/(auth)/login/page.tsx               # uses AuthForm mode="login"
  app/(auth)/register/page.tsx            # customer app only
  app/(app)/home/page.tsx                 # authenticated landing per surface
  app/403/page.tsx                        # admin app only
  components/
    auth-bootstrap.tsx                    # mount-effect calls /api/auth/refresh
    auth-menu.tsx                         # header: login/register links OR email + logout
  middleware.ts                           # public paths whitelist + cookie redirect
  app/layout.tsx                          # injects <AuthBootstrap/> + <Toaster/>
.env.local.example                        # +API_BASE_URL_INTERNAL
```

### Per mobile app (mobile-customer, mobile-driver)

```
apps/<app>/
  src/lib/
    auth-client.ts                        # fetch + secureStorage persist
    auth-store.ts                         # Zustand: same shape as web (no persist middleware — secureStorage is the persistence layer)
  src/lib/__tests__/auth-client.spec.ts   # 4 tests
  src/components/auth-bootstrap.tsx       # mount-effect calls authClient.refresh()
  app/_layout.tsx                         # <AuthBootstrap/>
  app/(auth)/login.tsx                    # form using ui-mobile primitives + useState
  app/(auth)/register.tsx                 # customer only
  app/(tabs)/_layout.tsx                  # <Redirect href="/(auth)/login"/> if unauthenticated
  app/(tabs)/profile.tsx                  # logout button
  app/index.tsx                           # driver: CTA "Liên hệ vận hành" via mailto
package.json                              # zustand was already present (T013)
jest.config.js                            # +moduleNameMapper for @ridex/shared-types → source
tsconfig.test.json                        # include shared-types source
```

## Out of Scope

- Forgot password / email reset.
- Email verification.
- OAuth (Google/Facebook).
- 2FA.
- Biometric auth on mobile.
- Driver/admin specific registration backend endpoint (driver register endpoint chưa có; admin seed migration only).
- Token auto-refresh on 401 (T016).
- "Remember me" toggle.
- packages/api-client (T016).

## Functional Requirements

- Customer register → login → access `/home` → reload page → boot refresh rehydrates session.
- Customer logout → cookie cleared, store cleared → next navigation redirected to `/login` by middleware.
- Invalid credentials → toast error, không redirect.
- Form validation client-side: email format, password ≥ 8 chars cho register, confirm password match.
- Web admin login: kiểm role; nếu `!== ADMIN` → `authActions.logout()` + redirect `/403`.
- Web driver login: bất kỳ role nào cũng được (backend chưa tạo DRIVER qua register; chỉ admin seed). Login UI flat — không có register link.
- Mobile: kill app → reopen → boot refresh đọc refreshToken từ secure-store → rehydrate. Mất quyền (refresh fail) → clear secure-store → tabs layout redirect login.
- Toaster (sonner) gắn ở root layout của 3 web app.

## Security Requirements

- KHÔNG ghi `refreshToken` vào localStorage / response body cho client (web). Route handler strip `refreshToken` ra khỏi response, chỉ trả `{accessToken, accessTokenExpiresInSeconds, user}`.
- KHÔNG log `accessToken`, `refreshToken`, hoặc password.
- Password input `type="password"`, register page `autoComplete="new-password"`, login page `autoComplete="current-password"`.
- Cookie `httpOnly + sameSite=lax + secure (prod)`.
- Mobile: secure-store với `WHEN_UNLOCKED` (đã có từ T013); KHÔNG AsyncStorage.
- CSRF: route handlers chỉ POST, sameSite=lax — Next.js mặc định OK.
- Rate limiting: dựa backend Task 002 lockout (5 attempts/IP).
- Backend error responses parse qua `flattenBackendError` — array message joined với `, ` để hiển thị toast.

## Database Requirements

KHÔNG.

## API/WebSocket Changes

KHÔNG (chỉ proxy backend Task 002 hiện có).

## Business Rules

- Register chỉ tạo CUSTOMER role (backend Task 002 enforced).
- Driver app KHÔNG render register form.
- Admin app KHÔNG render register form + role-gate ADMIN client-side sau login.
- Token auto-refresh tự động defer T016.

## Edge Cases

- Network timeout → form button vẫn enable lại, toast "Không kết nối được máy chủ".
- Cookie disabled → boot refresh fail → user remain `unauthenticated`; tab middleware redirect login.
- Backend down → logout best-effort (cookie vẫn clear locally).
- User clear cookie ngoài app: next request 401 → boot refresh fails next time → store clears.
- 2 tab cùng login: cookie chung, cả 2 tab cùng authenticated sau bootstrap.
- Token expired in middle of session: hiện T014 user thấy 401 trên API call (T016 handle silent refresh).

## Tests Required

- **Vitest (packages/ui-web):** 3 AuthForm tests — email validation, confirm-password match, server error display.
- **Vitest (apps/web-customer):** 9 tests — auth-store (3) + auth-proxy callBackend + flattenBackendError (5) + existing env smoke (1).
- **Vitest (apps/web-driver, web-admin):** existing env smoke (1 each).
- **Jest (apps/mobile-customer, mobile-driver):** 9 tests each — existing secure-storage (4) + env (1) + new auth-client login success/error/network + logout clear (4).

Test target: **~30 tests** added vs T013 baseline.

## Acceptance Criteria

- [x] Tất cả 5 app có login (customer + mobile có register; driver/admin no register).
- [x] Refresh token cookie httpOnly (web) / secure-store (mobile).
- [x] Form validation client-side + server error display.
- [x] Logout xóa cookie + store + secure-store sạch.
- [x] Boot refresh trên app mount (`<AuthBootstrap/>`).
- [x] Reload (web) / restart (mobile) giữ session qua boot refresh.
- [x] Admin role-gated client-side.
- [x] Driver register flow → mailto link, không có route `/register`.
- [x] Lint + build + test xanh trên 11 workspace projects (excl. backend).
- [x] Backend 444 tests vẫn pass.
- [x] 3 web prod builds compile, middleware bundle ≈ 34 kB.
