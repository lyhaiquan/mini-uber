# Review: Task 010 - Admin Operational Dashboard (Round 1)

**Task file:** `docs/tasks/010-admin-dashboard-basic.md`
**Implementer:** Claude (self-implemented; no Codex run for this task)
**Reviewer:** Claude (self-review for Codex cross-check)
**Date:** 2026-05-18

---

## Verdict: PASS WITH FIXES

Implementation matches the locked spec: single admin-only `GET /admin/dashboard/summary` endpoint backed by facade-level read aggregations, migration seeds an admin user from optional env vars, no new tables, no PII in the response, audit event emitted. Lint clean, build clean, 56 suites / 439 tests passing (Δ+27 vs Task 009 baseline of 412 — vượt target +25).

```text
pnpm -C apps/backend lint  : clean
pnpm -C apps/backend build : clean
pnpm -C apps/backend test  : 56 suites, 439 tests passed
```

Two real defects (one mid, one borderline) should be addressed before this is considered done. Listed under **Must Fix** + **Should Improve** below. Nothing security-critical, no blockers.

---

## Summary

New `admin` module:

```text
admin/
  admin.module.ts              # imports RidesModule + DriversModule + PaymentsModule
  admin.controller.ts          # @Roles(Role.ADMIN) GET /admin/dashboard/summary
  admin.controller.spec.ts
  dashboard/
    dashboard.service.ts       # composes 3 facade calls via Promise.all
    dashboard.service.spec.ts
    placeholder.constants.ts   # PLACEHOLDER_SOURCE_FUTURE_TASK + DASHBOARD_WINDOW_*
  dto/dashboard-summary.dto.ts # response interfaces
```

Cross-module facade extensions (additive, read-only):

- `RidesFacade.getDashboardCounts(since)` → `{ active, completedLast24h, cancelledLast24h, noDriversFoundLast24h, totalLast24h }`
- `RidesService.countActive()` / `countByStatusSince(since, statuses)` / `countTotalSince(since)` — typed query-builder calls.
- `DriversFacade.getDriverPopulation()` → `{ online, totalRegistered }`
- `DriversService.countOnline()` / `countTotal()` — uses repo `.count({ where })`.
- `PaymentsFacade.getDashboardStats(since)` → forwards to `PaymentRepository.aggregateDashboardStats(since)`.
- `PaymentRepository.aggregateDashboardStats` — 2 SQL aggregates (windowed `GROUP BY status` + all-time SUCCEEDED sum).

Other touched files:

- `app.module.ts` — registers `AdminModule`.
- `config/env.validation.ts` — adds 2 optional env keys `ADMIN_BOOTSTRAP_EMAIL` + `ADMIN_BOOTSTRAP_PASSWORD` with email-regex / min-12-char validation; both nullable when absent.
- `database/migrations/1778951100000-SeedAdminUser.ts` — argon2id hash + `INSERT ... ON CONFLICT DO NOTHING`. `down()` deletes by `LOWER(email)` if env still set.
- `apps/backend/.env.example` (via `ridex/.env.example`) — adds 2 placeholders blank by default.
- Spec tests for envelope (+5), facades (+8), service-level counts (+5), repository (+3), dashboard service (+5), controller (+4) = +30; net Jest delta +27 after merging into existing files.

Endpoint contract:

```http
GET /api/v1/admin/dashboard/summary
Authorization: Bearer <admin access token>
→ 200 { data: { generatedAt, windowHours: 24, rides{...}, drivers{...}, payments{...}, placeholders{...} } }
→ 401 if no/invalid token
→ 403 if token valid but role != ADMIN
```

---

## Blockers

None.

---

## Must Fix

### MF-1 — Migration bypasses `validateEnvironment` admin-key validation

`database/migrations/1778951100000-SeedAdminUser.ts:5-15` reads `process.env.ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` directly. The `validateEnvironment()` rules (email regex, password min length 12 max 128) only run when the Nest app boots — TypeORM CLI `migration:run` does **not** invoke them.

Consequence: if an operator sets `ADMIN_BOOTSTRAP_PASSWORD=abc` (3 chars) in production `.env`, the migration cheerfully hashes it and inserts an admin row with a 3-char password. Same for malformed email.

This is the only path to mint an ADMIN in the system. A weak admin password defeats the entire role-gated dashboard.

**Fix:** revalidate inside the migration before hashing. Inline the same `EMAIL_PATTERN` and length bounds as `env.validation.ts`. On invalid value, throw with a clear message (do **not** silently skip — operator intent is clear, the value is just wrong).

```typescript
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 12;
const MAX_PASSWORD = 128;

if (!EMAIL_PATTERN.test(email) || email.length > 254) {
  throw new Error(
    `[migration:SeedAdminUser] ADMIN_BOOTSTRAP_EMAIL is not a valid email address.`
  );
}
if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
  throw new Error(
    `[migration:SeedAdminUser] ADMIN_BOOTSTRAP_PASSWORD must be ${MIN_PASSWORD}-${MAX_PASSWORD} characters.`
  );
}
```

Add 2 tests for the migration's validation branch (unit-test the validation helpers, or just call `up()` against a mocked QueryRunner).

---

## Should Improve

### SI-1 — `getDashboardCounts` issues 5 round-trips when 1 GROUP BY would do

`rides.facade.ts` calls `countActive()` + `countByStatusSince()` ×3 + `countTotalSince()` in parallel — 5 SQL queries per dashboard hit. With `Promise.all` the latency is `max(query_time)`, not sum, so it's not catastrophic. But it's also wasteful: a single

```sql
SELECT
  COUNT(*) FILTER (WHERE status IN (...active)) AS active,
  COUNT(*) FILTER (WHERE created_at >= $1 AND status = 'COMPLETED') AS completed,
  COUNT(*) FILTER (WHERE created_at >= $1 AND status = 'CANCELLED') AS cancelled,
  COUNT(*) FILTER (WHERE created_at >= $1 AND status = 'NO_DRIVERS_FOUND') AS no_drivers,
  COUNT(*) FILTER (WHERE created_at >= $1) AS total24h
FROM rides;
```

would return all 5 numbers in one scan. Same idea for payments. For thesis scope this is fine; for a real deployment it matters once rides crosses 100k rows.

Leave as-is for now, but document the consolidation idea as a future optimization in the task's `Out of Scope` or `Notes`.

### SI-2 — `RidesService.countByStatusSince` empty-array short-circuit is unreachable from current callers

```typescript
async countByStatusSince(since: Date, statuses: readonly RideStatus[]): Promise<number> {
  if (statuses.length === 0) return 0;
  ...
}
```

No caller in the codebase passes an empty `statuses[]` — `getDashboardCounts` hands in single-element arrays each time. The defensive branch exists only for hypothetical future callers. Either:

- Drop the branch (let `IN ()` fail loudly so the bug surfaces).
- Or keep + cover with the existing test that does call it explicitly with `[]`.

The test does cover it (`countByStatusSince short-circuits to 0 when statuses is empty`), so structurally it's safe. Just note it's dead-from-production-call-graph.

### SI-3 — `PaymentDashboardStats` type is exported from two places

`payment.repository.ts:11-16` declares `PaymentDashboardStats`, and `payments.facade.ts:9` re-exports it via `export type { PaymentDashboardStats } from "./payment/payment.repository";`.

`admin/dashboard/dashboard.service.ts` and tests should import from the facade (the public boundary), not the repo. Currently the dashboard service doesn't import the type at all (it infers from facade return), so this is mostly cosmetic — but the re-export is invitation for future drift. Pick one canonical location.

### SI-4 — No correlation ID in `admin.dashboard.accessed` audit log

`admin.controller.ts:23` logs `{ event: "admin.dashboard.accessed", userId }` without the request's correlation ID. The codebase pattern is mixed — `rides.service.ts:69-77` also omits it — so this matches precedent, but for an **audit** event (which the task spec explicitly calls out) operators will want to trace it back to a specific HTTP request.

The `CorrelationIdMiddleware` already exposes a `correlationId` on the request. Inject it via `@Req()` or `@Headers("x-request-id")` and include it in the log:

```typescript
this.logger.log(
  { event: "admin.dashboard.accessed", userId: user.userId, correlationId: req.correlationId },
  CONTEXT
);
```

---

## Nice to Have

- **NTH-1**: `aggregateDashboardStats` runs window + all-time as two sequential queries. They could run via `Promise.all`, or be folded into a single SQL `SELECT ... FILTER (...)`. Same cost story as SI-1 — fine for now.
- **NTH-2**: `placeholder.constants.ts` defines `DASHBOARD_WINDOW_MS` separately from `DASHBOARD_WINDOW_HOURS`. Redundant; derive one from the other.
- **NTH-3**: All-time `platformRevenueAllTimeVnd` is computed as a JS `number`. At the rate of ~1M VND / ride × millions of rides this would exceed `Number.MAX_SAFE_INTEGER (≈ 9 × 10^15)` only at billions of rides — not a thesis concern, but flag for future migration to `BigInt` if revenue ever needs cents-level precision over decades.
- **NTH-4**: Dashboard service has no caching. A future improvement is a 30-60s in-memory cache (the metric is operational, not transactional). Out of scope per spec, but a one-liner via `cache-manager`.

---

## Security Notes

- **Auth + RBAC**: `@Roles(Role.ADMIN)` is class-level, so all future endpoints under `AdminController` inherit it. Verified via reflector test `admin.controller.spec.ts:79-81`. Global `JwtAuthGuard` runs first (registered in `auth.module.ts`), so unauthenticated → 401 before role check.
- **PII**: response intentionally aggregate-only. No `user_id`, `ride_id`, `payment_id`, email, address, or coordinates leak. Verified by reading `DashboardSummaryDto` shape.
- **Client input**: endpoint takes no body, no query params, no path params. Zero attack surface for input tampering.
- **Audit log**: emitted via `StructuredLogger` (subject to SI-4 above re: correlation ID). Includes `userId` but **not** the requested resource ID (there is none).
- **Migration**: argon2id with `memoryCost: 19_456, timeCost: 2, parallelism: 1` — identical to `auth.service.ts:298-303`. Password is read from env, never logged. Email is logged in `console.warn` on skip (acceptable: email is not a secret).
- **Admin enumeration**: there is no `/admin/login` or admin-specific auth endpoint. Admin uses the standard `/auth/login`. Therefore no email-enumeration channel created by this task.
- **No reverse imports**: confirmed via `grep -rn "from.*admin/" src/ --include="*.ts"` — only `app.module.ts` references `./admin/`.

---

## Database Notes

- **No schema changes**: Task 010 ships only `1778951100000-SeedAdminUser.ts`. Verified.
- **Migration idempotency**: `INSERT ... ON CONFLICT ((LOWER("email"))) DO NOTHING` — safe on re-apply. ✅
- **Migration `down()`**: deletes by `LOWER(email)` match + `role = 'ADMIN'` guard. Will not delete non-admin user even if email happens to collide. ✅
- **Index reuse**:
  - `drivers.is_online` partial index `drivers_is_online_idx WHERE is_online = true` is used by `countOnline()` via `repository.count({ where: { isOnline: true } })`. TypeORM should generate `SELECT COUNT(*) FROM drivers WHERE is_online = true` which the partial index serves directly. Cheap. ✅
  - `payments.created_at` has **no index**. The `WHERE created_at >= $1 GROUP BY status` aggregation will seqscan `payments`. For thesis scope (small N) acceptable. If this endpoint moves to a high-traffic dashboard, add `CREATE INDEX payments_created_at_idx ON payments (created_at)` in a follow-up migration.
  - `rides.created_at` similarly unindexed. Same note.
- **Aggregate correctness**: `aggregateDashboardStats` returns `bigint` columns as strings (default TypeORM Postgres behavior). The mapping casts via `Number(row.count)` / `Number(row.revenue ?? "0")`. NaN risk if Postgres returns null on empty group — `COALESCE(SUM(...), 0)` in the SQL prevents that; verified in tests `aggregateDashboardStats returns zeros when nothing matches`.
- **Transaction**: dashboard reads are not transactional — point-in-time inconsistency between `rides`, `drivers`, `payments` is possible. Acceptable for operational metrics (not financial).
- **Concurrency**: read-only endpoint, no locks, no writes. Safe.

---

## Test Notes

- **Unit coverage solid**: 30+ new tests across controller, service, both facade extensions, repository aggregate, env validation, and service-level count queries.
- **Migration not unit-tested**: spec acceptance criteria say "Migration up (with env set) creates 1 ADMIN row idempotently" — not test-covered. Matches the pattern of earlier tasks (008/009 also didn't unit-test their migrations), so consistent with project conventions. Add 1-2 tests after MF-1 fix (so we can also test the new validation branch).
- **No e2e HTTP test**: endpoint behavior is verified only at controller-method level (calling `controller.getSummary({...})` directly). The full Nest pipeline (Jwt + Roles guards + DTO serialization) is not exercised. Same deferral pattern as MF-3 from Task 003. Acceptable.
- **RolesGuard test reuses pattern from `drivers.controller.spec.ts`** with ADMIN allowed + CUSTOMER/DRIVER/undefined-user denied. ✅
- **Repository test uses a structural mock** of `SelectQueryBuilder<Payment>` via `QueryBuilderMock` interface + `asTypeOrm` cast. A bit ceremonial but TypeScript-clean.
- **dashboard.service.spec verifies `since ≈ now - 24h`** within a 5ms tolerance window — should be robust on CI.
- **No test for the migration's `down()` path** — same precedent gap as above.

---

## Observability Notes

- `admin.dashboard.accessed` audit event added (SI-4 — should also carry correlationId).
- No metrics endpoint (Prometheus instrumentation deferred to Phase 9 per IMPLEMENTATION_PLAN.md).
- Dashboard fails noisily: if any facade call rejects (DB down, etc.), `Promise.all` propagates and the global `AllExceptionsFilter` returns a sanitized 500. No specific "dashboard failed" log added — `StructuredLogger` global error path covers it.
- No tracing.

---

## Extraction Readiness

Checked against `REVIEW_CHECKLIST.md` extraction section:

- ✅ `admin` module imports only `RidesFacade`, `DriversFacade`, `PaymentsFacade` (plus auth decorator + common services). No service/repository/entity import.
- ✅ Cross-module returns are typed interfaces / DTOs (`RideDashboardCounts`, `DriverPopulationStats`, `PaymentDashboardStats`), not entities.
- ✅ No cross-module SQL JOIN — admin reads via facades, each facade hits its own module's tables.
- ✅ No new FKs.
- ✅ No side effects emitted from admin module (it's purely read-side).
- ✅ No new tables (admin module owns no schema).
- ✅ Migration ownership: `SeedAdminUser` modifies `users` (owned by `auth`/`users`). Technically the migration is in the cross-cutting `database/migrations/` folder which is the project convention — acceptable.

---

## Unrelated Changes

Diff confined to:
- `apps/backend/src/admin/**` (new)
- `apps/backend/src/database/migrations/1778951100000-SeedAdminUser.ts` (new)
- `apps/backend/src/app.module.ts` (1 import + 1 entry in `imports` array)
- `apps/backend/src/config/env.validation.ts` + spec (+ admin keys validators)
- `apps/backend/src/rides/rides.facade.ts` + `rides.service.ts` + specs (additive)
- `apps/backend/src/drivers/drivers.facade.ts` + `drivers.service.ts` + specs (additive)
- `apps/backend/src/payments/payments.facade.ts` + `payment/payment.repository.ts` + specs (additive)
- `apps/backend/src/auth/auth.service.spec.ts` (fixture additions only — added 2 admin keys to the env literal)
- `ridex/.env.example` (2 new keys)
- `ridex/docs/tasks/010-admin-dashboard-basic.md` (spec rewrite)

No formatting churn, no unrelated refactors, no new dependencies (argon2 already in use from Task 002).

---

## Exact Instructions for Codex

Apply these in order, then rerun lint + build + test. Target: ≥+2 tests (covering MF-1 validation branches).

1. **Fix MF-1 — re-validate env in the migration.**
   In `apps/backend/src/database/migrations/1778951100000-SeedAdminUser.ts`:
   - After the skip-on-missing check, before `argon2Hash(...)`, add inline validation:
     - Email: must match `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` and length ≤ 254.
     - Password: length 12–128.
   - On invalid value, `throw new Error(...)` with a message that mentions the env var name and the rule it violated. **Do not** fall back to skip — the operator explicitly set the var; silently ignoring would hide misconfig.

2. **Add validation tests for the migration.**
   Create `apps/backend/src/database/migrations/1778951100000-SeedAdminUser.spec.ts`:
   - Test 1: `up()` with valid env vars calls `queryRunner.query` once with the INSERT.
   - Test 2: `up()` with `ADMIN_BOOTSTRAP_PASSWORD` of length 5 throws.
   - Test 3: `up()` with malformed `ADMIN_BOOTSTRAP_EMAIL` throws.
   - Test 4: `up()` without either env var (delete them in beforeEach) calls `console.warn` and does not call `queryRunner.query`.
   - Test 5: `down()` with env set issues the `DELETE` query.
   - Mock `QueryRunner` as `{ query: jest.fn().mockResolvedValue([]) } as unknown as QueryRunner`.
   - Use `beforeEach`/`afterEach` to snapshot + restore `process.env.ADMIN_BOOTSTRAP_EMAIL` and `process.env.ADMIN_BOOTSTRAP_PASSWORD` to avoid leaking state between tests.

3. **Fix SI-4 — include `correlationId` in the audit event.**
   In `apps/backend/src/admin/admin.controller.ts`:
   - Add `@Req() req: { correlationId?: string }` parameter to `getSummary`.
   - Update the `logger.log` call to include `correlationId: req.correlationId ?? null`.
   - Update `admin.controller.spec.ts` test "logs an admin.dashboard.accessed audit event with the userId" to pass a `correlationId` on the request mock and assert it's in the logged payload.

4. **Drop SI-2 dead branch** (small cleanup):
   In `apps/backend/src/rides/rides.service.ts`, remove the `if (statuses.length === 0) return 0;` short-circuit from `countByStatusSince`. Remove the test `countByStatusSince short-circuits to 0 when statuses is empty` from `rides.service.spec.ts`.

5. **Optional (SI-3)**: collapse the `PaymentDashboardStats` re-export. Keep the type declared in `payment.repository.ts`; remove the `export type { PaymentDashboardStats }` line from `payments.facade.ts`. Update any (currently zero) external callers to import from `payment/payment.repository`.

6. Rerun:
   ```bash
   pnpm -C apps/backend lint
   pnpm -C apps/backend build
   pnpm -C apps/backend test
   ```
   Target: clean lint, clean build, ≥441 tests passing (439 current + 2 net from migration spec, accounting for the 1 removed dead-branch test).

7. Finish with the standard summary: **Summary / Changed files / Tests run / Notes**.

Out of scope for this round: anything labeled NTH-* above, the missing index on `payments.created_at` / `rides.created_at` (separate optimization task), and the e2e HTTP test.
