# Frontend Plan — RideX UI Phase

## Mục tiêu

Xây dựng giao diện ride-hailing kiểu Uber/Grab cho toàn bộ backend RideX (Tasks 001-010). Bao gồm 5 surfaces: 3 web app (Customer / Driver / Admin) + 2 mobile app (Customer / Driver). Frontend phase chia thành 12 tasks (T011-T022), tổ chức trong 5 phase (11-15).

## Locked Decisions

| Quyết định | Lựa chọn | Lý do |
|---|---|---|
| Mobile platform | **Expo React Native** (managed workflow) | Native UX trên iOS+Android, share code với web qua `packages/shared-*`, ecosystem trưởng thành (expo-router, expo-location, secure-store), không cần Xcode/Android Studio cho dev cycle |
| Web framework | **Next.js 15 (App Router) + React 19** | SSR for SEO của landing, RSC giảm bundle, ecosystem TanStack Query mature, file-based routing rõ ràng |
| UI primitives | **shadcn/ui + Tailwind CSS** trên web; **NativeWind v4** trên mobile (Tailwind cho RN) | Component copy-paste không lock-in, design tokens share được giữa web & mobile qua Tailwind config |
| State / data | **TanStack Query v5** + **Zustand** (chỉ cho client-only state) | Server state rời rạc khỏi UI state. Zustand chỉ cho map state, form drafts, theme toggle |
| Map provider | **Mapbox GL JS** (web) + **@rnmapbox/maps** (mobile) | Free tier 50k loads/tháng đủ thesis, style Uber-like, single account key cả 2 SDK |
| WebSocket | **socket.io-client** | Match backend Task 004/007 gateway (đã dùng socket.io platform) |
| Auth storage | Web: **httpOnly cookies + memory access token**; Mobile: **expo-secure-store** | XSS-safe trên web, secure-enclave trên mobile |
| Type sharing | **Zod schemas** trong `packages/shared-types`, generate types vào FE | Single source of truth khớp DTO backend, runtime validation phía FE cho response từ API |
| Form | **react-hook-form + zod resolver** | Industry standard, work cả web + RN |
| i18n | **next-intl** (web) + **expo-localization** (mobile) | VN/EN scaffold, các string ride-hailing dài có thể i18n |
| Test | Web: **Vitest + Playwright**; Mobile: **Jest + Maestro** | Match phase 8 quality bar |

## Monorepo Structure

```
ridex/
  apps/
    backend/                           # Existing
    web-customer/                      # Next.js, port 3001
    web-driver/                        # Next.js, port 3002
    web-admin/                         # Next.js, port 3003
    mobile-customer/                   # Expo, dev server 8081
    mobile-driver/                     # Expo, dev server 8082
  packages/
    api-client/                        # fetch wrapper, JWT refresh, typed routes
    socket-client/                     # socket.io-client wrapper, reconnect logic
    shared-types/                      # Zod schemas + TS types từ backend DTOs
    ui-tokens/                         # Tailwind config + color/spacing/typography tokens
    ui-web/                            # shadcn/ui registry, app-shared components
    ui-mobile/                         # RN component primitives (button, card, etc.)
    config-eslint/                     # Shared ESLint preset
    config-typescript/                 # Shared tsconfig presets (base, next, expo)
```

Workspace mới ngoài `apps/`: `packages/` được thêm vào `pnpm-workspace.yaml`. Tooling: pnpm workspace + Turborepo (đã có pnpm-workspace.yaml; thêm `turbo.json` cho task pipeline `build`, `lint`, `test`, `dev` parallel).

## Dependency Graph (cross-app)

```
shared-types ← api-client ← socket-client
ui-tokens ← ui-web (web apps)
ui-tokens ← ui-mobile (mobile apps)

web-customer → api-client, socket-client, ui-web, shared-types
web-driver   → api-client, socket-client, ui-web, shared-types
web-admin    → api-client, ui-web, shared-types
mobile-customer → api-client, socket-client, ui-mobile, shared-types
mobile-driver   → api-client, socket-client, ui-mobile, shared-types
```

Không có cross-app import. Mỗi app independent, share qua packages.

## Backend Contract Changes Needed

Phần này list những endpoint backend **CHƯA có** mà frontend cần. Các task FE sẽ flag dependency này, có thể spin-off "Backend addon" tasks nếu cần:

| Cần cho | Endpoint còn thiếu | Defer / Add now |
|---|---|---|
| Customer wallet page | `GET /me/wallet` | Add trong Task T022 (small backend addon) |
| Payment history | `GET /me/payments?page=...` | Add trong T022 |
| Driver earnings | `GET /me/driver/earnings?from=&to=` | Add trong T022 |
| Address autocomplete | Mapbox Geocoding API trực tiếp từ FE (key public, rate limit Mapbox) | No backend addon |
| Ride offer queue (driver) | WS event `ride.offer.created` (đã có Task 007) + REST poll fallback `GET /me/driver/offers/current` | Add fallback trong T020 |
| Past rides | `GET /me/rides?page=...` | Add trong T018 |
| Real-time driver position (customer view) | WS event `driver.location-updated` filtered by rideId | Add trong T018 (backend forwards via room subscription) |

Mỗi task FE liệt kê backend addons cụ thể.

## Task Roadmap

| # | Task | Phase | Surface | Est. effort | Depends on |
|---|---|---|---|---|---|
| T011 | Frontend Monorepo + Shared Packages | 11 | All | M | Backend |
| T012 | Web Shells Trio (Customer/Driver/Admin Next.js) | 11 | 3 web | M | T011 |
| T013 | Mobile Shells (Customer/Driver Expo) | 11 | 2 mobile | M | T011 |
| T014 | Auth UI Cross-Surface | 12 | All 5 | L | T012, T013 |
| T015 | Mapbox Integration (Web + Mobile) | 12 | 4 (skip admin) | M | T012, T013 |
| T016 | API Client + TanStack Query + 401 Refresh | 12 | All | M | T011, T014 |
| T017 | Customer Request Ride Flow | 13 | web-customer + mobile-customer | L | T014, T015, T016 |
| T018 | Customer Ride Tracking + Live Map | 13 | web-customer + mobile-customer | L | T017 + backend addon |
| T019 | Driver Online Toggle + Location Streaming | 14 | web-driver + mobile-driver | M | T015, T016 |
| T020 | Driver Offer Modal + In-Ride Screen | 14 | web-driver + mobile-driver | L | T019 + backend addon |
| T021 | Admin Dashboard UI | 14 | web-admin | M | T014, T016 |
| T022 | Wallet + Payment History | 15 | web-customer/driver + mobile both | M | All + backend addons |

**Tổng:** 12 task, ước lượng tương đương 8-12 tuần cho 1 dev solo, hoặc 4-6 tuần với Codex implement + Claude review.

## Cross-Cutting Rules (áp dụng cho mọi task FE)

### Security
- Access token (JWT) **không bao giờ** ghi vào `localStorage` hay `AsyncStorage`. Web dùng httpOnly cookie + memory; Mobile dùng `expo-secure-store`.
- Refresh token chỉ ở httpOnly cookie (web) hoặc secure-store (mobile), không truyền qua client JS.
- Không log token, password, balance, idempotency_key vào console hay analytics.
- CSRF: Next.js App Router server actions có built-in protection; custom POST cần token.
- Mapbox API key: dùng public token (pk.*) cho FE, KHÔNG dùng secret token (sk.*) ở client.

### Performance
- Code splitting per route trên Next.js (App Router làm sẵn).
- Image optimization qua `next/image` (web) + `expo-image` (mobile).
- Map tile caching: Mapbox SDK tự handle.
- TanStack Query staleTime mặc định 30s; mutation invalidate liên quan.
- WebSocket: 1 connection per app, reconnect exponential backoff.

### Accessibility
- WCAG AA contrast minimum.
- All interactive elements có `aria-label` hoặc visible label.
- Keyboard navigation full coverage trên web.
- Mobile: `accessibilityLabel` cho mọi `Pressable`.

### Internationalization
- VN làm default. EN scaffold sẵn nhưng không cần dịch hết.
- Number formatting: `Intl.NumberFormat("vi-VN")` cho VND.
- Date: `date-fns` với locale `vi`.

### Error Handling
- Backend error envelope `{ error: { code, message, details? }, meta: { requestId } }` được map sang Toast component (web) / Alert (mobile).
- Network down: show retry CTA, không crash.
- 401: auto-refresh token một lần, fail thì redirect login.
- Validation 400: hiển thị field-level errors trong form.

### Observability
- Sentry SDK (free tier) cho production error tracking — defer to T011 if cần.
- Web Vitals report qua Next.js (built-in).
- Mobile: chỉ console + native crash report (Expo built-in).

## Out of Scope (toàn phase FE)

- Payment gateway thật (Stripe/MoMo/VNPay) — chỉ dùng wallet simulation từ backend Task 009.
- Push notification production setup (defer phase observability).
- Native module customization (only Expo managed APIs).
- iOS App Store / Play Store publish — local build qua EAS đủ cho thesis demo.
- A11y screen reader testing chi tiết — chỉ baseline.
- E2E test cross-browser matrix — chỉ Chromium + 1 mobile simulator.
- Server-side rendering của ride status (live data, không phù hợp SSR).
- Offline-first mobile — chỉ cache TanStack Query, không IndexedDB / SQLite local mirror.
- Driver background location updates khi app closed (yêu cầu native foreground service).
- Custom map style từ Mapbox Studio — dùng `mapbox://styles/mapbox/streets-v12` mặc định, tinh chỉnh sau.

## Task-by-task Specs

Each task có file riêng trong `docs/tasks/`. Xem:
- `docs/tasks/011-frontend-monorepo-setup.md`
- `docs/tasks/012-web-shells-trio.md`
- `docs/tasks/013-mobile-shells.md`
- `docs/tasks/014-auth-ui-cross-surface.md`
- `docs/tasks/015-mapbox-integration.md`
- `docs/tasks/016-api-client-tanstack-query.md`
- `docs/tasks/017-customer-request-ride.md`
- `docs/tasks/018-customer-ride-tracking.md`
- `docs/tasks/019-driver-online-location-stream.md`
- `docs/tasks/020-driver-offer-flow.md`
- `docs/tasks/021-admin-dashboard-ui.md`
- `docs/tasks/022-wallet-payment-history.md`
