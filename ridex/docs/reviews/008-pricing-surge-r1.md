# Review: Task 008 — Pricing Surge (Round 1)

**Task file:** `docs/tasks/008-pricing-surge.md`
**Implementer:** Codex
**Reviewer:** Claude
**Date:** 2026-05-17

---

## Verdict: **PASS WITH FIXES**

Codex implement đủ scope, không drift. Pricing module độc lập (chỉ import `geo`, `routing`, `common`, `infra`, `config`) — không reverse import. RouteEstimator LRU + 2 env keys mới đúng spec, matching offer flow vẫn xanh. 1 must-fix về env range vs DB column (potential overflow), 3 should-improve về business logic.

```
pnpm --filter backend lint:    clean
pnpm --filter backend build:   clean
pnpm --filter backend test:    45 suites, 353 tests passed  (309 → 353 = +44; spec target ≥ +35)
```

---

## Summary

`pricing` module (15 files mới):

```
pricing/
  pricing.constants.ts           # CURRENCY_VND, SURGE_MILLI_SCALE, SURGE_DEMAND_KEY_PREFIX
  pricing.types.ts               # FareBreakdown, ComputeFareInput, SurgeContext, PricingEstimate
  pricing.module.ts              # imports GeoModule + RoutingModule + TypeOrm; exports PricingFacade
  pricing.facade.ts              # getSnapshotForRide + computeFareEstimate (preview)
  entities/pricing-snapshot.entity.ts
  errors/pricing-errors.ts
  fare/fare-calculator.service.{ts,spec.ts}
  surge/{surge-redis-keys.ts, surge.service.{ts,spec.ts}}
  snapshot/pricing-snapshot.repository.{ts,spec.ts}
  listeners/ride-requested.pricing-listener.{ts,spec.ts}
```

Plus:
- `database/migrations/1778950900000-CreatePricingSnapshotsTable.ts` — bảng + FK + 10 CHECK, reversible
- `routing/route-estimator.ts` — thêm in-memory LRU cache (Map-based, recency reorder) + 2 env keys
- `geo/geo.facade.ts` — thêm `cellsForLocation()` + `getOnlineDriverCount()` đúng spec
- `config/env.validation.ts` — 8 pricing + 2 routing env keys
- `.env.example` — 10 keys
- `app.module.ts` — `PricingModule` registered

---

## Compliance vs spec

| Spec requirement | Status | Note |
|---|---|---|
| Listener subscribe `ride.requested` post-commit | ✅ | `@OnEvent(RIDE_REQUESTED_EVENT)` |
| Trigger lock fare at request, no recompute | ✅ | Snapshot insert chỉ một lần (DB UNIQUE on ride_id) |
| Surge: ZSET demand + SCARD supply, ratio + threshold + coeff + cap | ✅ | Đúng công thức spec |
| Integer arithmetic, 1000-scale surge | ✅ | `surgeMilli = floor(mult * 1000 + 1e-9)`; `surgeAmountVnd = floor(subtotal*(surgeMilli-1000)/1000)` |
| MIN-fare clamp | ✅ | `Math.max(totalBeforeMinimum, minimumFareVnd)` |
| `RouteEstimator` LRU + 2 env keys | ✅ | Map-based recency reorder, TTL, không cache low-confidence, không cache failure |
| `geo.facade` 2 methods mới | ✅ | `cellsForLocation`, `getOnlineDriverCount` |
| `pricing_snapshots` chỉ pricing module ghi | ✅ | Grep xác nhận |
| No reverse import từ rides/matching/drivers/location/auth | ✅ | `pricing` chỉ import `geo`, `routing`, `common`, `infra`, `config` |
| 8 pricing + 2 routing env keys validated | ✅ | Với range check |
| Migration up/down clean | ✅ | DROP INDEX → DROP TABLE |
| Test target ≥ +35 | ✅ | +44 (309 → 353) |

---

## Strengths

1. **OSRM dedup chứng minh hoạt động**: cache key dùng `${profile}:${pickupLat5}:${pickupLng5}:${destLat5}:${destLng5}` — pricing listener + matching `createOfferPayload` cùng coord chỉ tốn 1 OSRM call. Recency reorder LRU (delete+set on hit) đảm bảo eviction hợp lý.
2. **Cache chỉ store HIGH confidence**: low-confidence fallback không cache → lần sau OSRM được retry → đúng intent (đừng pin lỗi). Failure không cache → đúng.
3. **Idempotency của `recordDemand`**: ZADD với cùng `member=rideId` chỉ update score, không double-count → an toàn nếu event lặp.
4. **Surge graceful degrade 2 lớp**: `SurgeService.getMultiplier` tự catch Redis error → trả `multiplier=1`. Listener cũng wrap `getMultiplier` trong `getSurgeOrDefault` → catch lần nữa → defense in depth.
5. **`PricingFacade.computeFareEstimate` KHÔNG gọi `recordDemand`**: preview/admin không làm bẩn surge signal. ✅
6. **DB CHECK constraints đầy đủ**: currency='VND', distance/duration ≥0, surge_multiplier ≥1.0, các fee bigint ≥0 — guard rails ở DB level.
7. **`pexpire` 2x window**: ZSET tự dọn nếu cell không có activity trong 2*WINDOW → tránh Redis memory leak.

---

## Findings

### MF-1 (Must fix, **blocking nếu prod**): `PRICING_SURGE_CAP` env range vượt `surge_multiplier` DB column

**Location:**
- `config/env.validation.ts:309-317` — `PRICING_SURGE_CAP` range `[1, 10]`.
- `database/migrations/1778950900000-CreatePricingSnapshotsTable.ts:18` — `surge_multiplier numeric(4, 3)`.

**Issue:** `numeric(4,3)` = precision 4 tổng số chữ số, scale 3 → **max value = 9.999**. Nhưng env validation cho phép `PRICING_SURGE_CAP` lên đến 10 (inclusive, vì arg cuối của `readNumberWithDefault` là `true` = inclusive max).

Nếu admin set `PRICING_SURGE_CAP=10` và demand/supply ratio đủ cao, `SurgeService.getMultiplier` trả về `multiplier=10`, FareCalculator trả về `surgeMultiplier=10`, `repository.insert` thất bại với Postgres error `numeric field overflow` → listener log `pricing.snapshot.persist_failed` → ride không có snapshot → payment task (009) không thể charge.

Test hiện tại không cover vì spec test PRICING_SURGE_CAP=2.5 và 3.0, chưa chạm trần.

**Fix (chọn 1):**
- **A (đơn giản, recommend):** Hạ env max thành `< 10` (vd `(0, 9.999]`) trong `readNumberWithDefault`. Cập nhật error message.
- **B:** Mở rộng column thành `numeric(5,3)` (max 99.999). Cần migration mới.

Cá nhân thấy A hợp lý hơn — cap = 10x đã là siêu cực đoan, 9.999 là thực tế cho thesis.

### SI-1 (Should improve): Ride tự tính demand của chính nó vào surge

**Location:** `listeners/ride-requested.pricing-listener.ts:60-77`.

**Behavior:** Listener gọi `recordDemand(cellR8, rideId)` TRƯỚC khi gọi `getMultiplier(cellR8)`. Vì `getMultiplier` đọc `zcard` SAU ZADD, **mỗi ride mới luôn có demand ≥ 1 cho cell của chính nó**. Cell trống (0 ride trước, supply=0) với ride đầu tiên: demand=1, effectiveSupply=1, ratio=1.0 = threshold → multiplier=1 (chưa surge). Nhưng nếu THRESHOLD < 1 (env cho phép `(0, 10]`) → ride đầu đã bị surge ngay vì chính nó.

Đây là edge case design: "demand at request time" có nên include self? Khi user/SI confirm "vẫn áp surge bình thường" cho low-confidence, chưa rõ ý cho self-counting.

**Fix options:**
- **A (đổi order):** Đọc `getMultiplier` TRƯỚC `recordDemand`. Demand của ride hiện tại sẽ ảnh hưởng ride KẾ TIẾP, không phải bản thân nó.
- **B (giữ nguyên + doc):** Document rõ là demand bao gồm self → consistent với matching (mỗi ride đếm 1 đơn vị demand kể từ moment of request).

Recommend A — semantics rõ ràng hơn cho ML/analytics sau này ("demand history at time of request" = ride đã có trước đó).

### SI-2 (Should improve): `bigintTransformer.from(null)` trả về 0 mask bug

**Location:** `pricing/entities/pricing-snapshot.entity.ts:8-18`.

```ts
const bigintTransformer = {
  to: (value: number): number => value,
  from: (value: string | number | null): number =>
    value === null ? 0 : typeof value === "number" ? value : Number(value)
};
```

Tất cả bigint columns đều `NOT NULL` ở DB. Nếu TypeORM trả về `null` thực sự, transformer biến nó thành `0` → fare hiển thị "0 đồng" thay vì error. Che mất bug.

**Fix:** Throw nếu `value === null` (NOT NULL column không bao giờ đúng nullable). Hoặc loại param type khỏi `| null`.

### SI-3 (Should improve): `persist_failed` không phân biệt unique violation vs DB error

**Location:** `listeners/ride-requested.pricing-listener.ts:127-136`.

Khi event `ride.requested` fires lần thứ 2 cho cùng `rideId` (event bus retry / replay), `repository.insert` throws `QueryFailedError` với unique constraint message. Listener log warn `pricing.snapshot.persist_failed` — nhìn vào log không phân biệt được "idempotency working as intended" với "DB thực sự lỗi".

**Fix nhẹ:** Check error code (Postgres `23505` = unique_violation). Nếu unique → log info "snapshot already exists, skipping" thay vì warn. Còn lại mới warn.

Test hiện tại `"logs and continues when snapshot persistence throws (idempotency violation)"` cũng đặt tên đúng nhưng KHÔNG assert ride duplicate vs DB error.

### NTH-1 (Nice to have): `pricing_snapshots_ride_idx` index redundant

**Location:** Migration `1778950900000:29-31`.

`ride_id UUID NOT NULL UNIQUE` đã tự tạo unique index. Thêm `CREATE INDEX pricing_snapshots_ride_idx` là **trùng lặp** — Postgres giữ cả 2 nhưng chỉ dùng 1. Tốn disk + write amplification.

**Fix:** Xóa `CREATE INDEX pricing_snapshots_ride_idx` ở `up()` và `DROP INDEX` ở `down()`. Entity decorator `@Index("pricing_snapshots_ride_idx", ["rideId"])` cũng nên xóa.

### NTH-2 (Nice to have): Test repository spec dùng mock thay vì DataSource fixture

`pricing-snapshot.repository.spec.ts` — chưa đọc nhưng theo project convention (Task 003, 007) đều dùng mock. Nếu spec yêu cầu `DataSource` fixture (integration test với Postgres docker-compose), defer đến test-infra task. Consistent với Task 007.

### NTH-3 (Nice to have): `PricingFacade.computeFareEstimate` exposed but no consumer

Facade method `computeFareEstimate` được implement nhưng chưa có controller hay caller nào dùng. Spec note là "for admin/preview" — đợi Task 010 wire vào REST endpoint. Hiện tại chỉ có `pricing.facade.spec.ts` cover. Acceptable, nhưng nhớ cleanup nếu Task 010 chọn approach khác.

### NTH-4 (Nice to have): RouteEstimator cache không track metrics

LRU cache không expose hit/miss counter. Khi cần tune `ROUTING_ESTIMATE_CACHE_SIZE` / TTL trong thực tế, không có visibility. Có thể thêm counter (`cacheHits`, `cacheMisses`) như getter + Prometheus task sau.

---

## Hard Review Rules recheck (CLAUDE.md)

| Rule | Status |
|---|---|
| Bypasses auth/RBAC/object-level authz | ✅ N/A — pricing listener only, no HTTP/WS surface added |
| Trusts payment amount / fare from client | ✅ Fare 100% server-computed từ config + OSRM + Redis surge |
| Allows invalid ride state transitions | ✅ N/A — pricing không touch ride status |
| Changes DB schema without migration | ✅ Migration `1778950900000` present |
| Adds WebSocket event without auth | ✅ No new WS events |
| Stores long-lived source-of-truth in Redis | ✅ Snapshot persist Postgres; Redis chỉ chứa surge signal (ephemeral) |
| Logs sensitive data | ✅ Logs chỉ rideId, cellR8, errorName |
| Broad refactors outside task | ✅ Chỉ thêm 2 method vào `geo.facade.ts` + cache layer vào `route-estimator.ts` đúng spec |
| Adds dependencies not approved | ✅ Không thêm npm dep nào (LRU dùng built-in Map) |

---

## Spec acceptance criteria recheck

- [x] Lint + build + tests xanh
- [x] Migration up + down clean (SQL inspected)
- [x] `pricing_snapshots` ghi chỉ từ pricing
- [x] 10 env keys validated
- [x] All `ride.requested` events → snapshot row (DB unique on ride_id)
- [x] No new imports `rides`/`matching`/`drivers`/`location`/`auth` → `pricing`
- [x] No reverse import từ `pricing` (chỉ `geo`, `routing`, `common`, `infra`, `config`)
- [x] RouteEstimator cache: hit 2nd identical call within TTL ✅; miss after TTL ✅; failure không cache ✅
- [x] Matching offer flow xanh (43 tests `matching/` pass, no regression)

---

## Open items cho Task 009 (Payment)

1. `pricing_snapshots` đã có `version int default 0` cột — payment có thể bump khi capture. Hoặc thêm `captured_at timestamptz null` để chống double-charge.
2. `total_vnd bigint` — payment sẽ đọc cột này làm canonical amount. Không bao giờ accept fare từ client request.
3. Event `pricing.snapshot.created` đã emit với payload `{ rideId, snapshotId, totalVnd, currency, surgeMultiplier }` → payment có thể subscribe để pre-authorize wallet.

## Open items cho Task 010 (Admin)

1. `PricingFacade.computeFareEstimate` sẵn sàng wire vào admin REST endpoint preview (input: pickup/dest → output: fare breakdown + surge context).
2. Snapshot có `surge_multiplier`, `pickup_h3_r8` → admin có thể plot surge heatmap by cell.

---

## Exact instructions for Codex

Required (MF-1):
- `apps/backend/src/config/env.validation.ts:309-317` — đổi range `PRICING_SURGE_CAP` thành `[1, 9.999]` (đổi arg cuối `readNumberWithDefault`). Update test `env.validation.spec.ts` để assert reject khi `PRICING_SURGE_CAP=10`. Update `.env.example` comment nếu có range note.

Recommended (SI-1, SI-2, SI-3, NTH-1):
- `apps/backend/src/pricing/listeners/ride-requested.pricing-listener.ts:60` — đổi order: gọi `getSurgeOrDefault(cellR8, rideId)` (đọc multiplier) TRƯỚC `recordDemand`. Thêm test case khẳng định self-ride không bump own surge.
- `apps/backend/src/pricing/entities/pricing-snapshot.entity.ts:8-18` — `bigintTransformer.from` và `numericTransformer.from` throw nếu `value === null` (loại bỏ branch `value === null ? 0`).
- `apps/backend/src/pricing/listeners/ride-requested.pricing-listener.ts:127-136` — phân biệt `QueryFailedError` với code `23505` (unique violation) → log info "snapshot already exists" thay vì warn. Update test name + assertion.
- `apps/backend/src/database/migrations/1778950900000-CreatePricingSnapshotsTable.ts` + `pricing-snapshot.entity.ts` — xóa explicit `pricing_snapshots_ride_idx` (đã có từ UNIQUE).

Sau khi fix, chạy lại `pnpm lint`, `pnpm build`, `pnpm test` — target vẫn ≥ 353 tests, có thể +2 tests (env range + self-surge).

---

## Status

✅ **PASS WITH FIXES** — 353 tests, lint + build clean, hard rules all green. 1 must-fix về env/DB mismatch (potential prod overflow), 3 SI + 4 NTH. Sẵn sàng cho Task 009 (Payment) sau khi Codex fix MF-1 và xem xét SI-1.
