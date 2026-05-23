# Review: Task 010 - Admin Operational Dashboard (Round 2)

**Task file:** `docs/tasks/010-admin-dashboard-basic.md`
**Previous review:** `docs/reviews/010-admin-dashboard-basic-r1.md`
**Reviewer:** Codex
**Date:** 2026-05-18

---

## Verdict: PASS

Round 1's actionable issues have been fixed, and one additional migration wiring issue was found and fixed during the pass.

Verification:

```text
pnpm -C apps/backend lint: clean
pnpm -C apps/backend build: clean
pnpm -C apps/backend run test -- --runInBand: 57 suites, 444 tests passed
```

---

## Fixes Applied

### MF-1 fixed: admin seed migration validates its own env input

`1778951100000-SeedAdminUser.ts` now validates `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` before hashing/inserting:

- email must be syntactically valid and at most 254 chars
- password must be 12-128 chars
- missing env vars still warn + skip, preserving CI/test migration behavior
- invalid env vars throw, because operator intent is explicit but unsafe

Added `1778951100000-SeedAdminUser.spec.ts` covering:

- valid env inserts admin and hashes with the expected argon2 settings
- short password throws
- malformed email throws
- missing env warns and skips
- `down()` deletes only the matching admin email

### SI-4 fixed: dashboard audit log includes correlation ID

`AdminController.getSummary()` now receives `RequestWithCorrelationId` and logs:

```ts
{ event: "admin.dashboard.accessed", userId, correlationId }
```

The controller spec asserts this.

### Additional fix: TypeORM runtime/CLI now knows Task 008-010 entities and migrations

`database.module.ts` and `data-source.ts` previously only registered entities/migrations through Task 007. That meant runtime repository metadata and `migration:run` could miss pricing, payments, and admin seed migrations.

Registered now:

- `PricingSnapshot`
- `Wallet`
- `Payment`
- `LedgerEntry`
- `CreatePricingSnapshotsTable1778950900000`
- `CreateWalletsAndPaymentsTables1778951000000`
- `SeedAdminUser1778951100000`

---

## Remaining Notes

No blocking findings remain.

The only residual items are performance/future-work level:

- Dashboard ride/payment aggregation can be collapsed into fewer SQL scans later.
- `payments.created_at` and `rides.created_at` remain unindexed, acceptable for thesis-scale data.
- No e2e HTTP test currently exercises the full guard pipeline.

