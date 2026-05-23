# Task 009: Payment Idempotency

## Task Name

Event-driven wallet payment với split fare (customer → driver + platform), idempotency, double-entry ledger.

## Goal

Khi ride chuyển sang `COMPLETED`, hệ thống tự động charge customer wallet, credit driver wallet (80%) và platform wallet (20%), ghi ledger entries append-only, tất cả trong **một** DB transaction. Repeated event/replay không double-charge. Insufficient balance → payment FAILED, không có ledger writes, không touch wallet balances.

## Context

- Task 003 đã có ride state machine với `IN_PROGRESS → COMPLETED` transition. `RideTransitionService` set `completed_at`. Hiện CHƯA emit event sau commit cho `COMPLETED` — Task 009 sẽ thêm (parallel với `ride.requested` pattern do Task 007 dựng).
- Task 008 ghi `pricing_snapshots` ngay sau `ride.requested`. Mỗi ride có **đúng một** snapshot với `total_vnd bigint` server-side. Payment đọc `total_vnd` làm canonical amount — KHÔNG bao giờ accept fare từ client.
- Task 007 emit `ride.matching.no-drivers` với reason taxonomy. Payment KHÔNG quan tâm matching outcome, chỉ subscribe `ride.completed`.
- ARCHITECTURE locks: `payments` module độc lập, import từ `rides` (event + getRideForPayment qua RidesFacade), `pricing` (PricingFacade.getSnapshotForRide), `auth` (guards cho endpoint nếu có), `common`, `infra`, `config`. Không reverse import từ ai.
- Decisions locked với user:
  - **Topup**: Auto-seed wallet khi customer/driver được tạo. Env `PAYMENT_WALLET_SEED_VND` (default 500_000). Không có faucet, không có admin topup endpoint.
  - **Trigger**: Auto-charge event-driven trên `ride.completed`. KHÔNG có customer-facing confirm endpoint. Server-generated idempotency key = `auto:ride:{rideId}`.
  - **Split**: 80% driver / 20% platform. Env `PAYMENT_DRIVER_SHARE_BPS=8000`, `PAYMENT_PLATFORM_SHARE_BPS=2000`, validate `sum == 10_000`. Platform wallet là singleton, seed via migration với balance=0, `user_id=NULL`, `kind='PLATFORM'`.
  - **Idempotency key delivery**: Server-generated cho event-driven path. Header `Idempotency-Key` reserved cho future admin retry endpoint (Task 010) — KHÔNG implement HTTP path trong Task 009.

## Scope

### Module structure
```
apps/backend/src/payments/
  payments.constants.ts                  # WALLET_KIND_*, PAYMENT_STATUS_*, LEDGER_ENTRY_TYPE_*, BPS_DENOMINATOR, idem key prefix
  payments.types.ts                      # PaymentSnapshot, ChargeOutcome, LedgerEntryDraft, WalletKind
  payments.module.ts                     # exports PaymentsFacade
  payments.facade.ts                     # getPaymentForRide(rideId), getWalletForUser(userId, kind)
  enums/
    payment-status.enum.ts               # PENDING|SUCCEEDED|FAILED_INSUFFICIENT_BALANCE|FAILED_MISSING_SNAPSHOT
    wallet-kind.enum.ts                  # CUSTOMER|DRIVER|PLATFORM
    ledger-entry-type.enum.ts            # DEBIT|CREDIT
  errors/
    payment-errors.ts                    # PaymentSnapshotMissingError, InsufficientBalanceError, WalletNotFoundError
  entities/
    wallet.entity.ts                     # user_id (nullable for PLATFORM), kind, balance_vnd bigint, version int
    payment.entity.ts                    # ride_id UNIQUE, idempotency_key UNIQUE, status, amount/split breakdown, snapshot_id FK
    ledger-entry.entity.ts               # payment_id FK, wallet_id FK, type, amount_vnd, balance_after_vnd, created_at
  charge/
    payment-processor.service.ts         # processRideCompletion(rideId, idempotencyKey) — transaction wrapper
    fare-split.service.ts                # pure: split(totalVnd, driverBps, platformBps) → { driverShareVnd, platformShareVnd }
  wallet/
    wallet.repository.ts                 # findOrCreateForUser(userId, kind), findPlatform(), lockAndDebit, lockAndCredit
  ledger/
    ledger.repository.ts                 # appendEntries(entries, manager)
  payment/
    payment.repository.ts                # findByIdempotencyKey, insertPending, transitionStatus
  listeners/
    ride-completed.payment-listener.ts   # @OnEvent("ride.completed") → PaymentProcessor.processRideCompletion
    user-created.wallet-seeder.ts        # @OnEvent("auth.user.created") → wallet.findOrCreateForUser + seed balance
```

Plus:
- `database/migrations/1778951000000-CreateWalletsAndPaymentsTables.ts` — 3 tables + indexes + CHECK constraints + platform wallet seed row
- `rides/rides.service.ts` — extend: post-commit emit `ride.completed` qua `RideTransitionService` hook (parallel với `ride.requested`)
- `rides/rides.facade.ts` — thêm `getRideForPayment(rideId)` trả về `{ id, customerId, driverUserId, status }` (read-only, không lock)
- `auth/auth.service.ts` (hoặc registration listener) — emit `auth.user.created` event sau khi user persist thành công (post-commit). Payload `{ userId, role }`.
- `common/events/event-types.ts` — thêm `RIDE_COMPLETED_EVENT`, `AUTH_USER_CREATED_EVENT`, `PAYMENT_SUCCEEDED_EVENT`, `PAYMENT_FAILED_EVENT`
- `config/env.validation.ts` — 4 keys mới
- `.env.example` — 4 keys
- `app.module.ts` — `PaymentsModule` registered

### Infrastructure (env keys mới)

- `PAYMENT_WALLET_SEED_VND` = 500000 (range [0, 10_000_000])
- `PAYMENT_DRIVER_SHARE_BPS` = 8000 (range [1, 9999])
- `PAYMENT_PLATFORM_SHARE_BPS` = 2000 (range [1, 9999])
- `PAYMENT_BPS_SUM_VALIDATION` — không phải env, mà là cross-key validation trong `env.validation.ts`: `DRIVER_SHARE_BPS + PLATFORM_SHARE_BPS === 10000`, throw nếu sai.

### Migration

```sql
-- wallets
CREATE TABLE wallets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NULL REFERENCES users(id) ON DELETE RESTRICT,
  kind        text NOT NULL CHECK (kind IN ('CUSTOMER','DRIVER','PLATFORM')),
  currency    text NOT NULL DEFAULT 'VND' CHECK (currency = 'VND'),
  balance_vnd bigint NOT NULL DEFAULT 0 CHECK (balance_vnd >= 0),
  version     int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
-- one wallet per (user_id, kind); PLATFORM wallet has user_id IS NULL → partial unique
CREATE UNIQUE INDEX wallets_user_kind_unique ON wallets (user_id, kind) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX wallets_platform_unique ON wallets (kind) WHERE kind = 'PLATFORM';

-- payments (1 per ride; idempotency key globally unique)
CREATE TABLE payments (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id                  uuid NOT NULL UNIQUE REFERENCES rides(id) ON DELETE RESTRICT,
  pricing_snapshot_id      uuid NOT NULL REFERENCES pricing_snapshots(id) ON DELETE RESTRICT,
  idempotency_key          text NOT NULL UNIQUE CHECK (char_length(idempotency_key) BETWEEN 1 AND 128),
  status                   text NOT NULL CHECK (status IN
                              ('PENDING','SUCCEEDED','FAILED_INSUFFICIENT_BALANCE','FAILED_MISSING_SNAPSHOT')),
  customer_user_id         uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  driver_user_id           uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  currency                 text NOT NULL DEFAULT 'VND' CHECK (currency = 'VND'),
  total_vnd                bigint NOT NULL CHECK (total_vnd >= 0),
  driver_share_vnd         bigint NOT NULL CHECK (driver_share_vnd >= 0),
  platform_share_vnd       bigint NOT NULL CHECK (platform_share_vnd >= 0),
  driver_share_bps         int    NOT NULL CHECK (driver_share_bps BETWEEN 0 AND 10000),
  platform_share_bps       int    NOT NULL CHECK (platform_share_bps BETWEEN 0 AND 10000),
  failure_reason           text NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  completed_at             timestamptz NULL,
  CHECK (driver_share_vnd + platform_share_vnd <= total_vnd)
);
CREATE INDEX payments_customer_idx ON payments (customer_user_id, created_at DESC);
CREATE INDEX payments_driver_idx ON payments (driver_user_id, created_at DESC);

-- ledger entries (append-only double-entry)
CREATE TABLE ledger_entries (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id         uuid NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  wallet_id          uuid NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
  entry_type         text NOT NULL CHECK (entry_type IN ('DEBIT','CREDIT')),
  amount_vnd         bigint NOT NULL CHECK (amount_vnd > 0),
  balance_after_vnd  bigint NOT NULL CHECK (balance_after_vnd >= 0),
  memo               text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ledger_entries_payment_idx ON ledger_entries (payment_id);
CREATE INDEX ledger_entries_wallet_idx ON ledger_entries (wallet_id, created_at DESC);

-- seed platform wallet
INSERT INTO wallets (kind, balance_vnd) VALUES ('PLATFORM', 0);
```

`down()` drops trong thứ tự ngược: ledger_entries → payments → wallets (cascade indexes), không drop users/rides/pricing_snapshots.

### Charge flow (PaymentProcessor.processRideCompletion)

```
async processRideCompletion(rideId, idempotencyKey = `auto:ride:${rideId}`):
  // OUTSIDE transaction: fast path idempotency check
  existing = paymentRepo.findByIdempotencyKey(idempotencyKey)
  if existing: return existing  // idempotent, no work

  // OUTSIDE transaction: gather inputs (read-only)
  ride = ridesFacade.getRideForPayment(rideId)
  if ride.status !== COMPLETED: log skip, return
  if !ride.driverUserId: log error, return  // ride completed without driver = data bug
  snapshot = pricingFacade.getSnapshotForRide(rideId)
  if !snapshot:
    insertPending(...status=FAILED_MISSING_SNAPSHOT, no ledger)
    emit payment.failed
    return

  split = fareSplit.split(snapshot.totalVnd, driverShareBps, platformShareBps)
  // split returns: { driverShareVnd: floor(total * driverBps / 10000),
  //                  platformShareVnd: total - driverShareVnd }
  // (rounding goes to platform — keeps driver_share exact at config rate)

  // INSIDE transaction (SERIALIZABLE or REPEATABLE READ, with row locks):
  dataSource.transaction(manager => {
    // Re-check idempotency inside tx to handle concurrent duplicates
    if manager.payment.findByIdempotencyKey(key, lock="FOR_NO_KEY_UPDATE"): return existing

    customerWallet = wallet.findForUser(customer, CUSTOMER, lock=PESSIMISTIC_WRITE)
    driverWallet   = wallet.findForUser(driver, DRIVER, lock=PESSIMISTIC_WRITE)
    platformWallet = wallet.findPlatform(lock=PESSIMISTIC_WRITE)
    // Lock order: by wallet.id ASC to avoid deadlock across concurrent payments

    payment = manager.insert(Payment, {status: PENDING, ...split, snapshot_id, key})

    if customerWallet.balance_vnd < snapshot.totalVnd:
      manager.update(payment.id, {status: FAILED_INSUFFICIENT_BALANCE, failure_reason})
      emit payment.failed
      return  // no ledger, no balance changes; tx commits with just the FAILED payment row

    customerWallet.balance_vnd -= snapshot.totalVnd
    driverWallet.balance_vnd   += split.driverShareVnd
    platformWallet.balance_vnd += split.platformShareVnd
    manager.save(all three wallets)  // version bumped via @VersionColumn

    manager.insert(LedgerEntry, [
      { payment, customerWallet,  DEBIT,  total_vnd,            balance_after, memo: "Ride payment" },
      { payment, driverWallet,    CREDIT, driver_share_vnd,     balance_after, memo: "Ride earning" },
      { payment, platformWallet,  CREDIT, platform_share_vnd,   balance_after, memo: "Platform fee" }
    ])
    manager.update(payment.id, {status: SUCCEEDED, completed_at: now})
    emit payment.succeeded
  })
```

**Idempotency story:**
- Layer 1: `payments.idempotency_key UNIQUE` — concurrent INSERT của 2 listener cùng key sẽ throw unique violation trên runner #2; catch → re-read existing → trả idempotent result.
- Layer 2: `payments.ride_id UNIQUE` — defense in depth nếu key sinh sai.
- Layer 3: Inner `findByIdempotencyKey` SELECT FOR UPDATE trong tx → block trước khi INSERT.

### Wallet seeding flow (UserCreatedWalletSeeder)

```
@OnEvent("auth.user.created")
async handle(event):
  kind = event.payload.role === DRIVER ? DRIVER : CUSTOMER
  await walletRepo.findOrCreateForUser(event.payload.userId, kind, initialBalance = WALLET_SEED_VND)
  // findOrCreate is upsert via INSERT ... ON CONFLICT DO NOTHING to be safe against replay
```

`auth/auth.service.ts` (hoặc registration handler) emit `auth.user.created` post-commit sau `register()`. Payload `{ userId, role }`. Best-effort (try/catch + log warn), không fail registration nếu emit lỗi.

### Rides extension

`RidesService.completeRideIfPossible` (hoặc hook trong transition service post-commit): sau khi `RideTransitionService.transition(rideId, COMPLETED, ...)` thành công, emit `ride.completed` domain event với payload `{ rideId, customerId, driverUserId, completedAt }`. Pattern y hệt `ride.requested` trong Task 007.

`RidesFacade.getRideForPayment(rideId)`: thêm method read-only, không lock, trả về `{ id, customerId, driverUserId, status }`.

## Out of Scope

- Real external payment gateway (Stripe, MoMo, VNPay)
- Refund / reversal workflow (defer to Task 010 admin)
- Wallet topup endpoint (auto-seed only)
- Customer-facing payment status REST endpoint (Task 010 admin sẽ wire `GET /me/payments` nếu cần)
- Manual retry endpoint với `Idempotency-Key` header (reserved cho Task 010)
- Promotions / vouchers / discounts
- Multi-currency
- Wallet statement / transaction history endpoint
- Payment state machine với explicit transition guard (status thay đổi chỉ qua PaymentProcessor)
- Payout schedule / settlement / withdrawal
- Tipping / driver bonus
- Audit log table (dùng app logger là đủ cho thesis)

## Expected Files/Modules

Xem section "Module structure" ở trên. Tổng ước tính: ~22 files mới (entities + repos + services + listeners + tests + migration + module/facade/constants/types/errors).

## Functional Requirements

- Khi `ride.completed` fires, PaymentProcessor charge customer + credit driver + credit platform trong 1 transaction.
- Wallet auto-seed khi user registration thành công (event-driven, không synchronous với auth flow).
- Idempotency: replay event cùng `rideId` → cùng `auto:ride:{rideId}` key → không double-charge, trả idempotent kết quả.
- Insufficient balance → payment status `FAILED_INSUFFICIENT_BALANCE`, wallets không thay đổi, không ghi ledger.
- Missing snapshot → payment status `FAILED_MISSING_SNAPSHOT`, không ghi ledger.
- Concurrent duplicate events → chỉ 1 SUCCEEDED hoặc 1 FAILED, không có race tạo 2 row.
- Driver share + platform share đúng tỷ lệ env (BPS). Rounding remainder dồn vào platform để driver_share_vnd luôn floor exact.

## Security Requirements

- Payment amount đọc duy nhất từ `pricing_snapshots.total_vnd` (server-computed Task 008). KHÔNG có path nào nhận amount từ HTTP/WS.
- `ride.customer_id` và `ride.driver_user_id` đọc từ DB qua `RidesFacade`, không từ event payload (event payload có nhưng listener vẫn re-fetch để chống forge).
- Không log idempotency_key full (mask hoặc chỉ log prefix) — coi như sensitive identifier.
- Không log balance_vnd của user (chỉ log payment.id, ride.id, status).
- Wallet update qua pessimistic write lock + @VersionColumn (optimistic concurrency layer 2) — chống lost update.
- Ledger entries append-only: không có method `update` hay `delete` trong `LedgerRepository`.

## Database Requirements

- Migration `1778951000000-CreateWalletsAndPaymentsTables.ts` — 3 tables + 6 indexes + ~10 CHECK constraints + seed platform wallet.
- Money: integer `bigint` cho mọi VND column, không float.
- Unique constraints:
  - `wallets (user_id, kind) WHERE user_id IS NOT NULL` — 1 customer wallet + 1 driver wallet per user max.
  - `wallets (kind) WHERE kind = 'PLATFORM'` — singleton platform wallet.
  - `payments.ride_id` UNIQUE — 1 payment per ride.
  - `payments.idempotency_key` UNIQUE — defense in depth.
- Foreign keys: `ON DELETE RESTRICT` everywhere (không cascade delete ledger từ user).
- Transaction isolation: `READ COMMITTED` (default Postgres) + `SELECT ... FOR UPDATE` trên wallets là đủ. Không cần SERIALIZABLE.
- Lock order: wallets sorted by `id ASC` trong tx để tránh deadlock giữa 2 transaction concurrent (vd driver A + driver B đều complete ride với cùng customer).
- Indexes:
  - `payments_customer_idx (customer_user_id, created_at DESC)` — cho future "my payments" query
  - `payments_driver_idx (driver_user_id, created_at DESC)` — cho future "driver earnings"
  - `ledger_entries_payment_idx (payment_id)` — fetch all entries for one payment
  - `ledger_entries_wallet_idx (wallet_id, created_at DESC)` — wallet statement

## API/WebSocket Changes

KHÔNG có HTTP/WS endpoint mới trong Task 009. Toàn bộ flow event-driven. Task 010 sẽ wire admin/customer REST endpoint sau.

## Business Rules

- 1 ride → 0 hoặc 1 SUCCEEDED payment. Có thể có 1 FAILED payment trước nếu thiếu snapshot / insufficient balance, nhưng `payments.ride_id UNIQUE` chỉ cho phép 1 row total → FAILED state là terminal cho ride đó. Customer/driver phải hoàn cảnh khác để được thử lại (Task 010 reserved cho retry).
- Driver share + platform share <= total_vnd luôn (CHECK constraint). Không có scenario amount âm hay > total.
- Ledger entries chỉ tạo khi payment SUCCEEDED. FAILED payment có row trong `payments` nhưng KHÔNG có ledger.
- Ledger entries cho 1 payment SUCCEEDED phải có đúng 3 row: 1 DEBIT customer + 1 CREDIT driver + 1 CREDIT platform. Tổng amount_vnd của 3 row = 2 * total_vnd (vì double-entry).
- Wallet balance KHÔNG bao giờ âm (CHECK constraint).

## Edge Cases

- **Replay event**: cùng rideId fires 2 lần → idempotency key cùng → layer 1 (pre-tx read) hoặc layer 2 (unique violation in tx) catches → no-op return existing.
- **Concurrent listeners**: 2 listener pickup cùng event (BullMQ at-least-once style) → cả 2 enter tx → 1 thắng INSERT, 1 throw unique violation → catch → trả existing.
- **Insufficient balance**: customer wallet < total → payment FAILED_INSUFFICIENT_BALANCE, no ledger, no balance change, emit `payment.failed`.
- **Missing snapshot**: `ride.completed` fires nhưng `pricing_snapshots.ride_id` không tồn tại (Task 008 fail) → payment FAILED_MISSING_SNAPSHOT, emit `payment.failed`. Không retry tự động.
- **Driver wallet không tồn tại**: ride có driver_user_id nhưng wallet seed listener chưa fire / fail → PaymentProcessor `findOrCreateForUser` upsert → wallet được tạo với balance=0 ngay trong tx → credit thành công.
- **Platform wallet không tồn tại**: shouldn't happen (migration seeds). Nếu missing → PaymentProcessor throw `WalletNotFoundError` → tx rollback → payment KHÔNG được tạo → có thể retry sau khi ops fix.
- **`ride.completed` fires nhưng `ride.driver_user_id` null**: data bug. Log error + skip, không tạo payment.
- **Snapshot total_vnd = 0**: theoretically (very short trip below minimum) — Task 008 minimum-fare clamp guarantee total >= MIN > 0. Defensive: nếu total=0, vẫn process bình thường, customer debit 0, driver credit 0, platform credit 0, ledger entries với amount > 0 thì CHECK fail → skip ledger, payment SUCCEEDED với amount=0. Edge case rare, không block.
- **`ride.completed` fires trước `ride.requested` pricing snapshot save**: race between Task 008 listener và Task 009 listener. Nếu pricing chưa kịp persist → snapshot missing → FAILED_MISSING_SNAPSHOT. Defer fix qua retry mechanism Task 010, hoặc thêm exponential backoff trong payment listener nếu cần (out of scope cho Task 009).
- **User deleted sau khi ride completed**: FK `ON DELETE RESTRICT` → user không thể bị delete khi còn ride/payment. Safe.

## Tests Required

- `fare-split.service.spec.ts` (~5 tests):
  - 80/20 split đúng integer arithmetic
  - Rounding remainder dồn vào platform (vd total=99, driver=79, platform=20)
  - driver_share_vnd + platform_share_vnd === total_vnd
  - Edge: total=0 → cả 2 = 0
  - Edge: total=1 → driver=0, platform=1 (floor(1*8000/10000)=0)

- `wallet.repository.spec.ts` (~5 tests): findOrCreate idempotent, findPlatform, debit happy + insufficient throw, credit, lock acquired

- `payment.repository.spec.ts` (~4 tests): findByIdempotencyKey, insertPending, transitionStatus

- `ledger.repository.spec.ts` (~3 tests): appendEntries inserts N rows, no update method exposed, no delete method exposed

- `payment-processor.service.spec.ts` (~12 tests):
  - happy path: SUCCEEDED + 3 ledger entries + 3 wallet balance updates
  - idempotent replay: 2nd call same key returns same payment, no second tx
  - concurrent duplicate: simulate 2 parallel calls → only 1 succeeds, other returns existing
  - insufficient balance: FAILED_INSUFFICIENT_BALANCE, no ledger, no balance change
  - missing snapshot: FAILED_MISSING_SNAPSHOT
  - ride not COMPLETED: skip
  - ride.driver_user_id null: log error + skip
  - split rounding goes to platform
  - emits payment.succeeded with right payload
  - emits payment.failed for each failure path
  - wallet lock order by id ASC
  - tx rollback on unexpected error

- `ride-completed.payment-listener.spec.ts` (~3 tests): handler calls processRideCompletion, error swallowed + logged, event payload extracted correctly

- `user-created.wallet-seeder.spec.ts` (~3 tests): customer role → CUSTOMER wallet seeded; driver role → DRIVER wallet seeded; idempotent on replay

- `rides.service.spec.ts` (+1 test): emits `ride.completed` post-commit after COMPLETED transition

- `auth.service.spec.ts` (+1 test): emits `auth.user.created` post-commit after register

- `env.validation.spec.ts` (+5 tests): each new key + BPS sum cross-validation

- `payments.facade.spec.ts` (~2 tests)

Total target: ≥+40 tests. 357 → ≥ 397.

## Acceptance Criteria

- [x] `pnpm lint`, `pnpm build`, `pnpm test` xanh
- [x] Migration up + down clean (forward apply, reverse restores empty state)
- [x] 4 env keys validated + BPS sum cross-validation
- [x] `wallets`, `payments`, `ledger_entries` chỉ ghi từ `payments` module
- [x] `pricing_snapshots` chỉ đọc từ payments qua `PricingFacade.getSnapshotForRide` (không direct DB access)
- [x] `rides` chỉ đọc từ payments qua `RidesFacade.getRideForPayment`
- [x] Không reverse import từ `rides`/`pricing`/`auth` vào `payments` (1 chiều)
- [x] Không có HTTP endpoint mới trong Task 009
- [x] Idempotent: gọi `processRideCompletion(rideId)` 2 lần trả về cùng payment, chỉ 1 tx commit
- [x] Concurrent: 2 lần gọi parallel với cùng key → chỉ 1 row trong `payments`, chỉ 3 row ledger
- [x] Wallet balance không bao giờ âm (CHECK guard + insufficient-balance branch)
- [x] FAILED payments không ghi ledger
- [x] Driver share + platform share = total (rounding to platform)
- [x] Test count ≥ 397 (≥+40 từ 357)
- [x] Không log idempotency_key full, không log balance_vnd, không log sensitive identifier

## Prompt for Codex

Implement Task 009 đúng spec này. Tạo `payments` module với event-driven auto-charge trên `ride.completed`, split fare 80/20 driver/platform (BPS configurable), wallet auto-seed trên `auth.user.created`, double-entry ledger append-only, idempotency 3-layer (pre-tx check + unique constraint + in-tx FOR UPDATE).

Không tạo HTTP endpoint, không tạo retry endpoint, không tạo refund flow. Wallet topup chỉ qua auto-seed.

Extend `RidesService` để emit `ride.completed` post-commit (pattern song song với `ride.requested` đã có). Extend `AuthService` để emit `auth.user.created` post-commit sau register. Thêm `RidesFacade.getRideForPayment`. Reuse `PricingFacade.getSnapshotForRide`.

Migration `1778951000000` tạo 3 table + indexes + CHECK + seed PLATFORM wallet. Money: bigint VND, không float. Transaction isolation: READ COMMITTED + SELECT FOR UPDATE trên wallets, lock order by wallet.id ASC.

Test target ≥ +40 (357 → 397). Bao gồm idempotent replay, concurrent duplicate, insufficient balance, missing snapshot, split rounding, lock order.

Hard rules: không trust amount/owner từ client, không log idempotency_key full, không log balance, không reverse import. Finish với Summary, Changed files, Tests run, Notes/Risks.
