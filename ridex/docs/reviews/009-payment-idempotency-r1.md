# Review: Task 009 - Payment Idempotency (Round 1)

**Task file:** `docs/tasks/009-payment-idempotency.md`
**Implementer:** Codex
**Reviewer:** Codex
**Date:** 2026-05-18

---

## Verdict: PASS

Task 009 is implemented to the agreed event-driven shape: completed rides auto-charge the customer wallet, credit driver/platform wallets, write append-only ledger rows, and use payment idempotency to avoid double-charge. No HTTP or WebSocket payment endpoint was added.

Close-out fixes were applied before this review:

1. `WalletRepository.findOrCreateForUser` now uses `INSERT ... ON CONFLICT DO NOTHING` via TypeORM query builder instead of catching unique violations. This avoids aborting an active Postgres transaction during concurrent wallet creation.
2. `PaymentProcessorService` now handles a `payments.ride_id` unique conflict by re-reading the existing payment for the ride, covering the defense-in-depth path where a different idempotency key is accidentally used for the same ride.

Verification:

```text
pnpm -C apps/backend lint: clean
pnpm -C apps/backend build: clean
pnpm -C apps/backend run test -- --runInBand: 54 suites, 412 tests passed
```

---

## Summary

New payments module:

```text
payments/
  payments.constants.ts
  payments.types.ts
  payments.module.ts
  payments.facade.ts
  enums/
    wallet-kind.enum.ts
    payment-status.enum.ts
    ledger-entry-type.enum.ts
  errors/payment-errors.ts
  entities/
    wallet.entity.ts
    payment.entity.ts
    ledger-entry.entity.ts
  charge/
    fare-split.service.ts
    payment-processor.service.ts
  wallet/wallet.repository.ts
  payment/payment.repository.ts
  ledger/ledger.repository.ts
  listeners/
    ride-completed.payment-listener.ts
    user-created.wallet-seeder.ts
```

Cross-module wiring:

- `PaymentsModule` registered in `app.module.ts`.
- `RIDE_COMPLETED_EVENT`, `AUTH_USER_CREATED_EVENT`, `PAYMENT_SUCCEEDED_EVENT`, and `PAYMENT_FAILED_EVENT` added.
- `RideTransitionService` emits `ride.completed` after successful `COMPLETED` transition.
- `AuthService` emits `auth.user.created` after registration persists.
- `RidesFacade.getRideForPayment()` added for payment read-only ride lookup.
- `PricingFacade.getSnapshotForRide()` is reused as the canonical fare source.
- Migration `1778951000000-CreateWalletsAndPaymentsTables.ts` creates `wallets`, `payments`, and `ledger_entries`.

---

## Compliance vs Spec

| Requirement | Status | Note |
|---|---|---|
| Auto-charge on `ride.completed` | PASS | `RideCompletedPaymentListener` calls `PaymentProcessorService.processRideCompletion`. |
| Canonical amount from pricing snapshot | PASS | Processor reads `PricingFacade.getSnapshotForRide`; no client amount path exists. |
| Wallet auto-seed on user creation | PASS | `UserCreatedWalletSeeder` handles `auth.user.created`; replay-safe upsert now avoids transaction-aborting unique errors. |
| 80/20 split via BPS env | PASS | `FareSplitService` reads `PAYMENT_DRIVER_SHARE_BPS` and `PAYMENT_PLATFORM_SHARE_BPS`; env validates sum `10000`. |
| Customer debit, driver credit, platform credit in one DB tx | PASS | Payment row, wallet balance mutations, and ledger inserts run inside `DataSource.transaction`. |
| Idempotent replay by `auto:ride:{rideId}` | PASS | Pre-tx read, in-tx locked read, unique constraints, and unique-conflict recovery are all present. |
| Concurrent duplicate events | PASS | Unique violation recovery returns existing payment; tests cover duplicate insert. |
| Insufficient balance | PASS | Creates `FAILED_INSUFFICIENT_BALANCE`, no wallet save, no ledger rows. |
| Missing snapshot | PASS | Creates `FAILED_MISSING_SNAPSHOT`, no wallet locks, no ledger rows. |
| No payment HTTP/WS endpoint | PASS | No controller/gateway added under payments. |
| No reverse imports into payments dependencies | PASS | Payments imports `rides` and `pricing`; those modules do not import `payments`. |
| No idempotency key or balance logging | PASS | Logs avoid idempotency keys and user balances. |

---

## Strengths

1. **Idempotency is layered correctly.** Fast-path read avoids unnecessary tx work, in-tx locked read catches replays that race past the first check, and DB uniqueness on both `idempotency_key` and `ride_id` handles true concurrency.
2. **Failure states do not mutate money.** Insufficient-balance and missing-snapshot branches create terminal failed payment rows without ledger writes or wallet balance changes.
3. **Ledger remains append-only by API shape.** `LedgerRepository` only exposes append and read methods; no update/delete method exists.
4. **DB constraints backstop application logic.** Wallet balance non-negative checks, currency checks, payment status checks, idempotency uniqueness, one payment per ride, and ledger amount checks are in migration SQL.
5. **Zero-amount defensive behavior is explicit.** Processor can mark success without writing invalid `amount_vnd = 0` ledger rows, matching the migration's `amount_vnd > 0` constraint.
6. **Event payloads are not trusted for ownership or amount.** The listener passes ride id only; processor re-fetches ride and pricing snapshot from module facades.

---

## Fixes Applied In This Pass

### FIX-1: Wallet upsert no longer aborts a transaction on concurrent creation

**Files:**
- `apps/backend/src/payments/wallet/wallet.repository.ts`
- `apps/backend/src/payments/wallet/wallet.repository.spec.ts`

Previous behavior used `save()` and caught Postgres `23505`. That pattern is unsafe inside an active transaction because Postgres marks the transaction failed after the unique violation. The repository now performs insert-or-ignore, then re-reads the wallet.

Added coverage:

- Existing wallet returns without upsert.
- Missing wallet creates seeded row.
- Concurrent upsert no-op returns the row created by the other worker.
- Impossible post-upsert missing row throws `WalletNotFoundError`.

### FIX-2: Ride-level unique conflict returns the existing payment

**Files:**
- `apps/backend/src/payments/charge/payment-processor.service.ts`
- `apps/backend/src/payments/charge/payment-processor.service.spec.ts`
- `apps/backend/src/payments/payment/payment.repository.ts`

If a duplicate payment attempt uses a different idempotency key for the same ride, the `payments.ride_id` unique constraint may fire instead of `payments.idempotency_key`. The processor now re-reads by `ride_id` after failing to find the idempotency key, returning the existing payment instead of surfacing a raw DB error.

---

## Findings

No blocking findings remain.

## Non-Issues Checked

- Customer wallet can be created with the configured seed balance during payment if the wallet seeder did not run or failed earlier. This is intentional per the auto-seed spec, not a payment bypass.
- Payment re-fetches ride data through `RidesFacade.getRideForPayment()` instead of trusting the `ride.completed` event payload. This matches the security requirement.
- `RideTransitionService.emitRideCompleted()` runs after the transition transaction commits, and `AuthService.emitUserCreated()` runs after user persistence succeeds. Both match the intended post-commit event pattern.
- `@VersionColumn` plus `pessimistic_write` wallet locking is defense in depth. The row lock is the primary lost-update protection; the version column is not a conflicting concurrency model.

### SI-1: No integration test executes the payment migration against Postgres

Unit coverage is strong, and SQL was inspected, but this pass did not run `migration:run` / `migration:revert` against a live database. Docker Desktop was not available in this workspace, so no local Postgres container was started. A later test-infra task should add a Postgres-backed migration smoke test.

### SI-2: Async event dispatch is best-effort

`EventEmitter2.emit()` is used consistently with earlier tasks. This is acceptable for the current in-process thesis backend, but async listener failures are logged and not retried by a durable queue. If payment execution must become guaranteed delivery, move `ride.completed` payment handling to BullMQ or an outbox pattern.

### NTH-1: Driver wallet seed depends on how driver users are created

`auth.register` creates customer users by default, so `auth.user.created` mostly seeds customer wallets in the current API. The payment processor still creates a missing driver wallet with balance `0` inside the charge transaction, so payment is not blocked. If a future driver onboarding endpoint creates `Role.DRIVER` users, make sure it emits the same event or calls a shared wallet seed path.

### NTH-2: `completedAt` type in listener payload can match ride event exactly

`RideCompletedPaymentPayload.completedAt` is typed as `string`, while the ride event payload allows `string | null`. The listener does not use this field, so behavior is unaffected. Tightening the type would reduce friction for future consumers.

---

## Hard Rules Recheck

| Rule | Status |
|---|---|
| Do not trust amount from client | PASS |
| Do not trust ride owner/driver from event payload | PASS |
| No new payment HTTP/WS mutating surface | PASS |
| No real payment gateway, refund, topup, retry endpoint | PASS |
| No reverse import from rides/pricing/auth into payments | PASS |
| Money stored as integer `bigint` VND | PASS |
| Wallet balances cannot go negative | PASS |
| Failed payments do not write ledger rows | PASS |
| Idempotency prevents double charge | PASS |
| No full idempotency key or balance in logs | PASS |

---

## Acceptance Criteria Recheck

- [x] `pnpm -C apps/backend lint` clean
- [x] `pnpm -C apps/backend build` clean
- [x] `pnpm -C apps/backend run test -- --runInBand` clean
- [x] Test count above target: 412 tests, target was at least 397
- [x] Payment module registered
- [x] Migration file present for wallets/payments/ledger
- [x] Env keys validated with BPS sum cross-validation
- [x] `ride.completed` post-commit event wired
- [x] `auth.user.created` event wired
- [x] `RidesFacade.getRideForPayment` present
- [x] `PricingFacade.getSnapshotForRide` reused
- [x] One payment per ride enforced by DB unique constraint
- [x] One idempotency key per payment enforced by DB unique constraint
- [x] Wallet lock order sorted by id
- [x] Ledger append-only repository API

---

## Notes / Risks

The task is ready to commit. Remaining risks are operational rather than implementation blockers: migrations were not run against a live Postgres instance during this review because the Docker engine was unavailable, and payment events are still in-process best-effort events instead of durable outbox jobs.
