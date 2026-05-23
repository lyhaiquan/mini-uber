# Task 010: Admin Operational Dashboard

## Task Name

Admin-only dashboard endpoint với operational metrics tổng hợp (active rides, online drivers, revenue, payment outcomes) + admin bootstrap qua migration seed.

## Goal

Cung cấp admin user một endpoint duy nhất để xem snapshot tình trạng hệ thống: số ride đang active, số driver online, doanh thu platform 24h gần nhất + all-time, success/failure rate của payments. Mọi metric đọc từ source of truth qua existing facades — không tạo bảng mới, không build frontend.

Admin user được seed qua migration từ env vars để không cần tạo HTTP register endpoint với role=ADMIN (an toàn hơn: production chỉ admin được phép tạo qua infra/ops path).

## Context

- Task 002 đã có `RolesGuard` + `@Roles()` decorator. Pattern: `@Roles(Role.ADMIN)` trên controller route → guard reject 403 nếu role không khớp.
- Task 003 có `ACTIVE_RIDE_STATUSES` constant, ride status enum đầy đủ.
- Task 004 có `drivers.is_online` boolean column trên `drivers` table (source of truth) + partial index `drivers_is_online_idx WHERE is_online=true`.
- Task 008 có `pricing_snapshots` (chỉ pricing tham chiếu).
- Task 009 có `payments` với `status`, `total_vnd`, `driver_share_vnd`, `platform_share_vnd`, `created_at`, `completed_at`. Cho phép aggregate.
- Facades hiện có: `RidesFacade`, `DriversFacade`, `PaymentsFacade`, `GeoFacade`, `PricingFacade`. Tất cả `exports` từ module riêng.
- ARCHITECTURE lock: `admin` module import từ `rides`, `drivers`, `payments`, `auth`, `common`, `config`. Không có ai reverse-import từ `admin`.
- Decisions locked với user:
  - **Admin bootstrap**: migration seed `1778951100000-SeedAdminUser`. Đọc `ADMIN_BOOTSTRAP_EMAIL` + `ADMIN_BOOTSTRAP_PASSWORD` từ env. Nếu cả hai set, hash password bằng argon2id và INSERT ... ON CONFLICT DO NOTHING. Nếu thiếu một trong hai, migration log warn và skip (không fail) — để CI/test environment vẫn chạy được.
  - **Không có admin register endpoint**. Admin chỉ tạo qua migration (hoặc direct DB cho production ops). Defense in depth.
  - **Time window**: 24h hardcoded cho v1. Không có query params. Future task có thể thêm range.
  - **Metrics scope**: tổng hợp đơn (single response). Không có list endpoints, không pagination. Future task thêm `GET /admin/rides` `GET /admin/payments` nếu cần.
  - **Placeholders**: `matchingDuration` + `fraudAlerts` trả về object có `value: null` + `source: "future-task"` để dashboard frontend (Task 010+) biết phân biệt placeholder vs real data.
  - **Audit**: log qua `StructuredLogger` event `admin.dashboard.accessed` với `userId` + `correlationId`. Không có audit table (deferred from Task 002).

## Scope

### Module structure

```
apps/backend/src/admin/
  admin.module.ts                              # imports RidesModule, DriversModule, PaymentsModule
  admin.controller.ts                          # @Roles(Role.ADMIN) GET /admin/dashboard/summary
  admin.controller.spec.ts                     # admin allowed, customer/driver denied, returns DTO
  dto/
    dashboard-summary.dto.ts                   # response shape
  dashboard/
    dashboard.service.ts                       # gathers from 3 facades, assembles DTO
    dashboard.service.spec.ts                  # facade composition tests
    placeholder.constants.ts                   # PLACEHOLDER_SOURCE_FUTURE_TASK
```

Plus extensions to existing modules (read-only methods, additive only):

- `rides/rides.facade.ts` — add `getDashboardCounts(): Promise<DashboardRideCounts>`
- `rides/rides.service.ts` — add `countByStatusGroup(since: Date)` helper
- `drivers/drivers.facade.ts` — add `getDriverPopulation(): Promise<DashboardDriverCounts>`
- `drivers/drivers.service.ts` — add `countOnline()` + `countTotal()`
- `payments/payments.facade.ts` — add `getPaymentStats(since: Date): Promise<DashboardPaymentStats>`
- `payments/payment/payment.repository.ts` — add `aggregateStats(since: Date)` SQL aggregate
- `database/migrations/1778951100000-SeedAdminUser.ts` — conditional admin seed
- `config/env.validation.ts` — 2 new optional env keys
- `.env.example` — 2 new keys (placeholder values)
- `app.module.ts` — register `AdminModule`

### Endpoint

```
GET /admin/dashboard/summary
Auth: Bearer access token, role=ADMIN
Response 200:
{
  "generatedAt": "2026-05-18T03:14:15.000Z",
  "windowHours": 24,
  "rides": {
    "active": 7,
    "completedLast24h": 142,
    "cancelledLast24h": 11,
    "noDriversFoundLast24h": 3,
    "totalLast24h": 156
  },
  "drivers": {
    "online": 23,
    "totalRegistered": 95
  },
  "payments": {
    "successCountLast24h": 138,
    "failureCountLast24h": 6,
    "platformRevenueLast24hVnd": 4250000,
    "platformRevenueAllTimeVnd": 18750000
  },
  "placeholders": {
    "matchingDurationMs": { "value": null, "source": "future-task" },
    "fraudAlerts":       { "value": null, "source": "future-task" }
  }
}

Errors:
401 Unauthorized — no/invalid token
403 Forbidden — token valid but role != ADMIN
```

### Env keys mới

- `ADMIN_BOOTSTRAP_EMAIL` — optional, must be valid email if present.
- `ADMIN_BOOTSTRAP_PASSWORD` — optional, min length 12 if present (stronger than register endpoint default vì admin power).

Migration reads `process.env` directly. ConfigService validates these if present (so they pass through `validateEnvironment` without breaking other code).

### Migration `1778951100000-SeedAdminUser`

```typescript
up():
  email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim()
  password = process.env.ADMIN_BOOTSTRAP_PASSWORD
  if (!email || !password):
    console.warn("[migration] Admin bootstrap skipped: ADMIN_BOOTSTRAP_EMAIL or PASSWORD not set")
    return
  passwordHash = await argon2.hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 })
  await query(
    `INSERT INTO users (email, password_hash, role)
     VALUES ($1, $2, 'ADMIN')
     ON CONFLICT ((LOWER(email))) DO NOTHING`,
    [email, passwordHash]
  )

down():
  email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim()
  if (!email) return
  await query(`DELETE FROM users WHERE LOWER(email) = LOWER($1) AND role = 'ADMIN'`, [email])
```

Hash params match `auth.service.ts:298-303` để consistent.

### Facade extensions

`RidesFacade.getDashboardCounts(since: Date)`:
- Single SQL: `SELECT status, COUNT(*) FROM rides WHERE created_at >= $1 OR status IN (ACTIVE_RIDE_STATUSES) GROUP BY status`
- Map status counts → `{ active, completedLast24h, cancelledLast24h, noDriversFoundLast24h, totalLast24h }`
- Active count counts ALL active rides regardless of created_at (admin wants live system state).
- Last24h buckets restrict by `created_at >= since`.

`DriversFacade.getDriverPopulation()`:
- `online = COUNT(*) FROM drivers WHERE is_online = true` (uses partial index)
- `totalRegistered = COUNT(*) FROM drivers`

`PaymentsFacade.getPaymentStats(since: Date)`:
- One query: `SELECT status, COUNT(*), SUM(platform_share_vnd) FROM payments WHERE created_at >= $1 GROUP BY status`
- Plus: `SELECT COALESCE(SUM(platform_share_vnd), 0) FROM payments WHERE status = 'SUCCEEDED'` for all-time.
- Output `{ successCountLast24h, failureCountLast24h, platformRevenueLast24hVnd, platformRevenueAllTimeVnd }`.
- `failureCount` = both `FAILED_INSUFFICIENT_BALANCE` + `FAILED_MISSING_SNAPSHOT`.

### Dashboard service

```
class DashboardService {
  constructor(ridesFacade, driversFacade, paymentsFacade, logger)
  async getSummary(): Promise<DashboardSummaryDto> {
    const now = new Date()
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const [rides, drivers, payments] = await Promise.all([
      ridesFacade.getDashboardCounts(since),
      driversFacade.getDriverPopulation(),
      paymentsFacade.getPaymentStats(since),
    ])
    return { generatedAt: now.toISOString(), windowHours: 24, rides, drivers, payments, placeholders: {...} }
  }
}
```

### Controller

```
@Controller("admin/dashboard")
@UseGuards(JwtAuthGuard)  // already global, but kept explicit for clarity
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private dashboardService, private logger) {}

  @Get("summary")
  async getSummary(@Req() req): Promise<DashboardSummaryDto> {
    this.logger.log({ event: "admin.dashboard.accessed", userId: req.user.userId }, "AdminController")
    return this.dashboardService.getSummary()
  }
}
```

## Out of Scope

- Admin mutation actions (force-complete ride, refund payment, etc.) — Task 011+.
- List endpoints (`GET /admin/rides`, `/admin/payments`).
- Pagination, filtering, sorting.
- Frontend dashboard UI.
- Real-time push (no WebSocket).
- Audit log table (still deferred from Task 002).
- ClickHouse / OLAP backend.
- Fraud detection logic.
- Matching duration computation (defer until matching emits proper timing events).
- Configurable time windows via query params.
- Admin register HTTP endpoint.
- Multiple admin seeds in one migration.
- Password rotation / admin profile update endpoint.

## Expected Files/Modules

11 mới + 9 modified. Ước tính ~25 files touched total.

## Functional Requirements

- Admin user (created qua migration seed) authenticate được và call `GET /admin/dashboard/summary` thành công.
- Customer / driver / unauthenticated request → 403 / 401.
- Response chứa tất cả 4 sections: rides counts, driver counts, payment stats, placeholders.
- Active rides count phản ánh tất cả rides hiện đang in `ACTIVE_RIDE_STATUSES`, không bị giới hạn 24h.
- Last24h buckets dùng `created_at >= now - 24h`.
- Revenue = sum `platform_share_vnd` của SUCCEEDED payments.
- All metrics safe khi không có data (zero counts, không throw, không null leak).
- Migration log warn (không fail) khi env vars thiếu — CI/test env vẫn migrate được.

## Security Requirements

- `@Roles(Role.ADMIN)` enforced. `RolesGuard` (global) đã verify. Test cover non-admin denial.
- `JwtAuthGuard` toàn cục đã enforce (existing in app).
- Migration password phải qua argon2id, KHÔNG plain text trong DB.
- Migration KHÔNG log password (chỉ log email).
- Endpoint KHÔNG trả về email/PII của customer/driver — chỉ aggregate counts/sums.
- Endpoint KHÔNG trả về individual ride_id / user_id / payment_id.
- Audit log event `admin.dashboard.accessed` chứa `userId` + `correlationId` qua StructuredLogger.
- Endpoint KHÔNG cho phép input từ client (no body, no query params trong v1).

## Database Requirements

- Migration `1778951100000-SeedAdminUser` — conditional INSERT, idempotent (ON CONFLICT DO NOTHING).
- No schema changes (no new tables, no new columns).
- Reuse existing indexes:
  - `drivers_is_online_idx` (partial WHERE is_online=true) → `COUNT(*)` online drivers cheap.
  - `payments.created_at` không có index riêng (acceptable for thesis — table sẽ nhỏ).
  - Rides có `created_at` từ Task 003 — acceptable.
- All queries read-only, không transaction wrapping cần thiết (snapshot tolerance OK).
- Migration `down()` chỉ xóa admin user nếu email match từ env.

## API/WebSocket Changes

- New: `GET /admin/dashboard/summary` — admin-only.
- No WebSocket changes.
- No request body / query params.

## Business Rules

- Active rides = `status IN (REQUESTED, MATCHING, ACCEPTED, DRIVER_ARRIVED, IN_PROGRESS)` regardless of age. Reflect live state.
- `totalLast24h` = sum of `(completedLast24h + cancelledLast24h + noDriversFoundLast24h + still-active-from-last-24h)`. Implementation: `COUNT(*) WHERE created_at >= since`.
- Revenue = platform_share_vnd from SUCCEEDED payments (customer's debit ≠ platform's earning; platform earns share only).
- Placeholder responses MUST include `source` field documenting future origin (frontend disambiguation).
- Admin user role là terminal — không có endpoint promote/demote trong task này.

## Edge Cases

- **Empty DB**: 0 rides, 0 drivers, 0 payments → all counts = 0, all sums = 0, response 200.
- **Missing env vars on migration**: warn + skip, migration succeeds.
- **Admin email already exists**: ON CONFLICT DO NOTHING, migration succeeds, no error.
- **Token với role CUSTOMER call endpoint**: 403 via RolesGuard.
- **No auth header**: 401 via JwtAuthGuard.
- **Token valid nhưng user deleted**: existing JwtAuthGuard sẽ catch (depends on implementation; just rely on existing behavior).
- **Rides table có hàng triệu rows** (production): COUNT queries slow. Acceptable for thesis. Future: cache với 60s TTL.
- **Down migration với admin user đã thay đổi password**: vẫn delete (chỉ match email + role). Acceptable.

## Tests Required

- `admin.controller.spec.ts` (~5 tests):
  - Returns summary for ADMIN (mocked dashboard service)
  - Logs `admin.dashboard.accessed` event with userId
  - RolesGuard test: ADMIN allowed, CUSTOMER denied, DRIVER denied (via metadata check pattern existing in drivers.controller.spec.ts)

- `dashboard.service.spec.ts` (~5 tests):
  - Assembles DTO from 3 facade calls in parallel
  - Uses 24h window relative to now (verify `since` ≈ now - 24h)
  - Handles facade returning zero counts (empty system)
  - Placeholder block always present
  - `generatedAt` is ISO timestamp

- `rides.facade.spec.ts` (+3 tests):
  - `getDashboardCounts` returns active + 24h buckets from service
  - Active ignores 24h window
  - Empty result → zeros

- `drivers.facade.spec.ts` (+2 tests):
  - `getDriverPopulation` returns online + total
  - Online zero edge case

- `payments.facade.spec.ts` (+3 tests):
  - `getPaymentStats` returns success/failure/revenue
  - Failure aggregates both FAILED_* statuses
  - Empty result → zeros

- `payment.repository.spec.ts` (+2 tests):
  - `aggregateStats` SQL aggregate output mapping
  - All-time revenue separate from window

- `rides.service.spec.ts` (+2 tests):
  - `countByStatusGroup` SQL builder produces correct output

- `drivers.service.spec.ts` (+2 tests):
  - `countOnline`, `countTotal` use correct WHERE clauses

- `env.validation.spec.ts` (+3 tests):
  - Optional bootstrap keys accepted when absent
  - Email validated when present
  - Password min length validated when present

Total target: ≥+25 tests (412 → ≥437).

## Acceptance Criteria

- [x] `pnpm lint`, `pnpm build`, `pnpm test` xanh
- [x] Migration up (with env set) creates 1 ADMIN row idempotently
- [x] Migration up (without env) logs skip and succeeds
- [x] Migration down (with env set) removes admin row
- [x] 2 env keys validated optionally trong `env.validation.ts`
- [x] `GET /admin/dashboard/summary` returns 200 cho ADMIN, 403 cho CUSTOMER/DRIVER, 401 không token
- [x] Response chứa rides, drivers, payments, placeholders sections đầy đủ
- [x] Không endpoint nào trả về email/PII/individual IDs
- [x] Audit log `admin.dashboard.accessed` emitted on access
- [x] Test count ≥ 437 (≥+25 từ 412)
- [x] `admin` module 1-way imports: KHÔNG có reverse import từ rides/drivers/payments/auth

## Prompt for Codex

(Self-implemented by Claude — không có Codex prompt cho task này.)
