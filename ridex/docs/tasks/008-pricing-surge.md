# Task 008: Pricing Surge

## Task Name

Server-side fare calculation with H3-based supply/demand surge, locked at ride creation.

## Goal

When a ride is created, compute and persist a `pricing_snapshots` row that contains the deterministic fare breakdown (base + distance + time + surge) keyed by `ride_id`. Payment (Task 009) reads this snapshot to charge. Customer fetches it via `GET /rides/:id` (extended in this task) to see the fare BEFORE matching completes.

## Context

- Task 003 emits `ride.requested` (added in Task 007 implementation). Task 008 subscribes alongside `matching` — both listeners run in parallel, no cross-dependency.
- Task 005 maintains `h3:drivers:r8:{cellId}` Redis SETs (online driver index). Task 008 reads `SCARD` of these SETs for **supply** signal.
- Task 006's `RouteEstimator.estimate` provides `{ distanceMeters, durationSeconds, confidence }`. Reused for pricing.
- ARCHITECTURE locks: `pricing` owns `pricing_snapshots`, imports from `geo` (H3 + supply count) and `routing` (OSRM) only. No reverse import from anyone.
- Decisions locked with user:
  - **Trigger**: lock at `ride.requested`. No recompute at completion. Surge is "at time of request".
  - **Surge signal**: Redis-backed. ZSET `surge:demand:{cellId}` tracks ride.requested with score=now_ms; SCARD `h3:drivers:r8:{cellId}` for supply. Ratio → multiplier with cap.
  - **Money**: VND, integer đồng, bigint columns in Postgres.
  - **OSRM dedup (new in R2)**: `RouteEstimator.estimate` adds an in-memory LRU cache keyed by rounded coords + profile. Matching offer creation và pricing listener đều hit cùng cache → 1 OSRM call per ride thay vì 2+. Cache scope: process-local (không Redis), TTL ngắn (≤ 60s), size ≤ 1024 entries.
  - **Surge & route confidence**: KHÔNG đặc biệt hóa `confidence='low'` trong pricing — surge công thức giữ nguyên cho mọi confidence. (Đã cân nhắc cap-at-1.0; quyết định: out of scope, log only nếu cần.)
  - **Reason enum**: `ride.matching.no-drivers` event payload chứa `reason` string (`exhausted` | `no_candidates` | `timeout_scheduling_failed`). Task 008 KHÔNG enum hóa — hoãn đến Task 010 (admin UI cần hiển thị thì mới hóa enum).

## Scope

### Infrastructure
- 8 new pricing env keys + 2 routing env keys (defaults reasonable for VN urban):
  - `PRICING_BASE_FARE_VND` = 12000 (range [0, 1_000_000])
  - `PRICING_PER_KM_VND` = 5000 (range [0, 1_000_000])
  - `PRICING_PER_MIN_VND` = 500 (range [0, 100_000])
  - `PRICING_MINIMUM_FARE_VND` = 15000 (range [0, 1_000_000])
  - `PRICING_SURGE_RATIO_THRESHOLD` = 1.0 (range (0, 10], surge starts when demand/supply > threshold)
  - `PRICING_SURGE_COEFFICIENT` = 0.5 (range (0, 5])
  - `PRICING_SURGE_CAP` = 3.0 (range [1, 10])
  - `PRICING_DEMAND_WINDOW_SECONDS` = 300 (range [10, 3600])
  - `ROUTING_ESTIMATE_CACHE_SIZE` = 1024 (range [16, 16384]) — for RouteEstimator LRU
  - `ROUTING_ESTIMATE_CACHE_TTL_SECONDS` = 60 (range [1, 600]) — for RouteEstimator LRU

### Module structure
```
apps/backend/src/pricing/
  pricing.constants.ts             # CURRENCY_VND, SURGE_PRECISION, redis key prefixes
  pricing.types.ts                 # FareBreakdown, ComputePricingInput, SurgeContext
  pricing.module.ts                # exports PricingFacade
  pricing.facade.ts                # getSnapshotForRide(rideId), computeFareEstimate(input) [admin/preview]
  entities/
    pricing-snapshot.entity.ts     # @Entity({ name: "pricing_snapshots" }) bigint columns
  errors/
    pricing-errors.ts              # PricingSnapshotNotFoundError, InvalidPricingInputError
  fare/
    fare-calculator.service.ts     # pure compute: integer arithmetic, surge multiply, min-fare clamp
  surge/
    surge-redis-keys.ts            # demandKey(cellId), DEMAND_ZSET_PREFIX
    surge.service.ts               # recordDemand, getMultiplier (ZSET prune + ZCARD + SCARD via geo)
  snapshot/
    pricing-snapshot.repository.ts
  listeners/
    ride-requested.pricing-listener.ts    # @OnEvent("ride.requested") → compute + record + persist
```

### Routing module extension (small)

Add to `RouteEstimator`:
- In-memory LRU cache wrapping `estimate(input)`. Key = `${profile}:${round(pickup.lat,5)}:${round(pickup.lng,5)}:${round(dest.lat,5)}:${round(dest.lng,5)}` (round → ~1.1m precision tại VN, đủ để 2 ride cùng pickup/dest share cache).
- Cache size cap (default 1024 entries), TTL (default 60s). 2 env keys:
  - `ROUTING_ESTIMATE_CACHE_SIZE` = 1024 (range [16, 16384])
  - `ROUTING_ESTIMATE_CACHE_TTL_SECONDS` = 60 (range [1, 600])
- Cache MISS → call OSRM, ghi cache. Cache HIT → trả entry, log `routing.estimate.cache_hit` ở debug level.
- Failure không cache (chỉ cache success). Không cache khi `confidence='low'` (để retry sẽ chạy lại OSRM lần sau).
- Test: cache hit returns same object, cache miss triggers OSRM, TTL expiry triggers re-fetch, failure not cached, eviction at capacity.

Không cần migration. Không thay đổi public API của `RouteEstimator.estimate`.

### Geo module extension (small)
Add to `GeoFacade`:
- `cellsForLocation(lat, lng): Promise<{ r8: string; r9: string }>` — wraps `H3Service.latLngToBothCells`
- `getOnlineDriverCount(cellId: string, resolution: 8 | 9): Promise<number>` — wraps `redis.scard(cellKey(resolution, cellId))`

These are pure additions; `geo` exports widen but no breaking changes. Migration not needed.

### Migration
- `1778950900000-CreatePricingSnapshotsTable.ts`:
  ```sql
  CREATE TABLE pricing_snapshots (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id               uuid NOT NULL UNIQUE REFERENCES rides(id) ON DELETE RESTRICT,
    currency              text NOT NULL DEFAULT 'VND' CHECK (currency = 'VND'),
    pickup_h3_r8          text NOT NULL,
    distance_meters       int NOT NULL CHECK (distance_meters >= 0),
    duration_seconds      int NOT NULL CHECK (duration_seconds >= 0),
    route_confidence      text NOT NULL CHECK (route_confidence IN ('high','low')),
    base_fare_vnd         bigint NOT NULL CHECK (base_fare_vnd >= 0),
    distance_fee_vnd      bigint NOT NULL CHECK (distance_fee_vnd >= 0),
    duration_fee_vnd      bigint NOT NULL CHECK (duration_fee_vnd >= 0),
    subtotal_vnd          bigint NOT NULL CHECK (subtotal_vnd >= 0),
    surge_multiplier      numeric(4,3) NOT NULL CHECK (surge_multiplier >= 1.0),
    surge_amount_vnd      bigint NOT NULL CHECK (surge_amount_vnd >= 0),
    minimum_fare_vnd      bigint NOT NULL CHECK (minimum_fare_vnd >= 0),
    total_vnd             bigint NOT NULL CHECK (total_vnd >= 0),
    computed_at           timestamptz NOT NULL DEFAULT now(),
    version               int NOT NULL DEFAULT 0
  );
  CREATE INDEX pricing_snapshots_ride_idx ON pricing_snapshots (ride_id);
  ```

### Pricing flow
1. `ride.requested` fires.
2. Pricing listener:
   - Compute pickup H3 r8 via `GeoFacade.cellsForLocation(pickup.lat, pickup.lng)`.
   - Record demand: `SurgeService.recordDemand(r8)` — ZADD `surge:demand:r8:{cellId}` with score=now_ms, member=rideId.
   - Get route: `RouteEstimator.estimate({ pickup, destination })`.
   - Get surge multiplier: `SurgeService.getMultiplier(r8)` — prune old ZSET entries, ZCARD = demand, SCARD = supply, compute multiplier, clamp to [1, cap].
   - Compute fare: `FareCalculator.compute({ distance, duration, surgeMultiplier, config })`.
   - Persist snapshot.
   - Emit `pricing.snapshot.created` event.

### Fare formula (integer arithmetic)
```
distanceFee = floor(distance_m * PER_KM_VND / 1000)
durationFee = floor(duration_s * PER_MIN_VND / 60)
subtotal    = BASE + distanceFee + durationFee
// surge multiplier is at 3-decimal precision; multiply via 1000-scale int math:
surgeMillis = floor(surgeMultiplier * 1000)        // 1.500 → 1500
surgeAmount = floor(subtotal * (surgeMillis - 1000) / 1000)
total       = subtotal + surgeAmount
final       = max(total, MINIMUM_FARE)
```

Round-to-đồng is automatic (all integer arithmetic). Floats only exist in the surge multiplier scalar, scaled by 1000 immediately.

### Surge formula
```
demand = ZCARD surge:demand:r8:{cellId}  (after ZREMRANGEBYSCORE 0 (now - WINDOW_MS))
supply = SCARD h3:drivers:r8:{cellId}     (Task 005 set)
effectiveSupply = max(supply, 1)
ratio  = demand / effectiveSupply
multiplier = ratio > THRESHOLD ? (1 + (ratio - THRESHOLD) * COEFFICIENT) : 1
multiplier = min(multiplier, CAP)
```

### Tests target
- `fare-calculator.service.spec.ts` (~10 tests): zero distance/duration, minimum-fare clamp, surge cap, base-only, integer rounding, large distance, surge=1, surge=cap, exact 1.0 vs 1.001
- `surge.service.spec.ts` (~6 tests): demand=0 → multiplier=1; high demand → capped; supply=0 → uses 1; ZREMRANGEBYSCORE called with right cutoff; record adds ZADD; pruning respects WINDOW
- `pricing-snapshot.repository.spec.ts` (~4 tests): insert, findByRideId returns null/result
- `ride-requested.pricing-listener.spec.ts` (~5 tests): happy path persists snapshot; OSRM throws → log + abort snapshot (no partial row); SurgeService throws → use default 1.0; idempotent on duplicate event (DB unique constraint catches)
- `pricing.facade.spec.ts` (~2 tests)
- `env.validation.spec.ts` (+10 tests for 8 pricing + 2 routing keys)
- `geo.facade.spec.ts` (+2 tests for new methods)
- `route-estimator.spec.ts` (+5 tests for LRU cache: hit, miss, TTL expiry, failure not cached, eviction)

Total target: ≥+35 tests. 309 → ≥ 344.

## Out of Scope

- Payment capture / wallet charging (Task 009)
- Promotions / vouchers (future)
- Real payment gateway (Task 009)
- ML pricing
- Admin pricing UI (Task 010)
- Recompute on completion (decision: lock at request)
- Multi-currency (VND only)
- Customer-facing fare estimate REST endpoint (`GET /rides/:id` is enough)
- Pricing change events into matching offer payload (matching doesn't need pricing)

## Security / Compliance

- Fare comes only from server-computed snapshot; client cannot supply.
- Surge multiplier validated `>= 1.0` at DB level.
- Currency hardcoded `VND`; CHECK constraint blocks future drift.
- No PII in pricing snapshot.

## Acceptance Criteria

- [x] Lint, build, tests all green
- [x] Migration up + down clean
- [x] `pricing_snapshots` written only by pricing module
- [x] 8 new env keys validated
- [x] All ride.requested events produce a snapshot row (DB unique on `ride_id`)
- [x] No new imports from `rides`/`matching`/`drivers`/`location`/`auth` to `pricing`
- [x] No reverse import from `pricing` either except `geo`, `routing`, `common`, `infra`, `config`
- [x] `RouteEstimator` LRU cache: hit on 2nd identical call within TTL, miss after TTL, failure không cache
- [x] Matching offer flow vẫn xanh (43 tests trong scope `matching/` không regression)

## Implementation note

Implemented by Codex, reviewed by Claude. Workflow giữ nguyên như Task 007.
