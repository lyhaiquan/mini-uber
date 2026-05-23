# Review: Task 005 — H3 Driver Discovery (Round 1)

**Task file:** `docs/tasks/005-h3-driver-discovery.md`
**Implementer:** Claude (self-implementing under architect role)
**Reviewer:** Claude (Self-Review Checklist + post-mortem mode)
**Date:** 2026-05-17

---

## Verdict: **PASS (self-implemented + self-reviewed)**

Vì Claude vừa là author vừa là reviewer ở Task 005, doc này không phải critique mà là **post-mortem** + lock state. Spec đã ghi đầy đủ Self-Review Checklist 13 items; tất cả pass. Không có round 2 — nếu Codex hoặc user phát hiện gì sau khi review, sẽ track riêng.

---

## Verification

```
pnpm lint:    clean (0 errors)
pnpm build:   clean
pnpm test:    30 suites, 236 tests passed  (+59 từ Task 004: 177 → 236; spec yêu cầu min +25)
```

Test breakdown của module mới:
- `h3.service.spec.ts`: 22 tests
- `h3-redis-keys.spec.ts`: 3 tests
- `h3-redis-index.service.spec.ts`: 14 tests (indexDriver 4, removeDriver 2, findNearbyDrivers 4, sweepStale 4)
- `driver-location-updated.listener.spec.ts`: 4 tests
- `driver-went-offline.listener.spec.ts`: 3 tests
- `stale-driver-sweeper.service.spec.ts`: 6 tests
- `geo.facade.spec.ts`: 5 tests
- `env.validation.spec.ts`: +2 tests cho 2 keys mới
- Tổng: 59 ✅

---

## Implementation walkthrough

### 1. Event constants refactor (light touch on Task 004)

Tạo `src/common/events/event-types.ts` chứa 3 string constants. `drivers/events` và `location/events` re-export. Không file consumer nào cần thay đổi vì import path không đổi (re-export giữ nguyên symbol). Sau bước này baseline 177 tests vẫn pass — confirmed.

### 2. Dependencies

- `h3-js@^4.4.0` — H3 binding v4 (mới hơn spec v4 generic). API dùng: `latLngToCell`, `gridDisk`, `isValidCell`, `cellToLatLng` (test only).
- `@nestjs/schedule@^6.1.3` — newer major than spec v4. API stable: `SchedulerRegistry.addInterval / deleteInterval / doesExist`, `OnApplicationBootstrap` / `OnApplicationShutdown` lifecycle hooks.

### 3. Env

- `H3_DISCOVERY_MAX_RING` = 5 default, range `[0, 20]`. 0 = center cell only (allowed, tested).
- `H3_STALE_SWEEP_INTERVAL_SECONDS` = 30 default, range `[5, 600]`.
- Reused `DRIVER_LOCATION_TTL_SECONDS` (60) cho staleness threshold — không thêm key mới.

### 4. Module structure

```
src/geo/
  geo.constants.ts                                   # H3_DRIVER_INDEX_RES_8/9, H3DriverIndexResolution type
  h3.service.ts                                      # pure: latLngToCell, latLngToBothCells, gridDisk, isValidCoord
  redis/
    h3-redis-keys.ts                                 # cellKey, companionKey, lastSeenZsetKey
    h3-redis-index.service.ts                        # indexDriver, removeDriver, findNearbyDrivers, sweepStale
  listeners/
    driver-location-updated.listener.ts              # @OnEvent → indexDriver
    driver-went-offline.listener.ts                  # @OnEvent → removeDriver
  sweeper/
    stale-driver-sweeper.service.ts                  # SchedulerRegistry interval + re-entrancy guard
  geo.facade.ts                                      # findNearbyDrivers(input) → string[]
  geo.module.ts
```

### 5. Redis lifecycle for one driver

```
driver online (Task 004) → no geo write yet (no location)
driver sends location → location.gateway writes Redis cache + emits "driver.location-updated"
                       → DriverLocationUpdatedGeoListener.handle()
                       → H3RedisIndexService.indexDriver()
                           pipeline:
                             [SREM old r8 if changed]
                             [SREM old r9 if changed]
                             SADD new r8 (idempotent)
                             SADD new r9 (idempotent)
                             HSET h3:driver:cells:{id} { r8, r9 }
                             ZADD h3:drivers:last-seen <ms> driverId
driver moves → same flow, cell change triggers SREM-then-SADD
driver offline → drivers.service emits "driver.went-offline"
              → DriverWentOfflineGeoListener.handle()
              → H3RedisIndexService.removeDriver()
                  pipeline:
                    [SREM r8]
                    [SREM r9]
                    DEL companion
                    ZREM last-seen
driver crash (no offline event) → companion persists, ZSET score not refreshed
                                → sweeper every 30s reads ZRANGEBYSCORE 0 (now - 60000)
                                → for each stale: ZSCORE re-check, then removeDriver
```

### 6. Discovery flow

```
GeoFacade.findNearbyDrivers({ lat, lng, maxRing? })
  → clamp maxRing to [0, H3_DISCOVERY_MAX_RING], floor fractional
  → H3RedisIndexService.findNearbyDrivers(lat, lng, maxRing)
      → latLngToBothCells → centerR8, centerR9
      → gridDisk(centerR8, k=maxRing) → 1 + 6*(maxRing*(maxRing+1)/2) cells
      → gridDisk(centerR9, k=maxRing) → same cardinality
      → pipeline: SUNION ...r8Keys; SUNION ...r9Keys
      → merge results into JS Set (dedup across resolutions)
      → return Array.from(set)
```

---

## Notes & Risks (locked from spec + post-implementation)

### R-1: Pipeline ordering correctness

**Risk (from spec):** Wrong order in pipeline could leave a stale SADD.

**Resolution:** Pipeline order in `indexDriver` is fixed: `[SREM old]*, SADD new*, HSET, ZADD`. Mock pipeline test `cell change: SREM old then SADD new for both resolutions` asserts the exact sequence `["srem", "srem", "sadd", "sadd", "hset", "zadd"]`. Any future regression on ordering will fail this test.

### R-2: Sweeper drift

**Risk:** If a sweep tick exceeds 30s interval (e.g. Redis slow + many stale drivers), the next tick fires while the previous is in flight.

**Resolution:** Re-entrancy guard via `running: boolean` in `tick()`. Test `re-entrancy guard skips overlapping ticks` proves the second concurrent call returns immediately without invoking `sweepStale`. Effective eviction cadence may be slower than 30s under load — acceptable for thesis MVP.

### R-3: Listener vs sweeper race

**Risk:** Driver sends fresh location at the same moment the sweeper decides to evict.

**Resolution:** Inside `sweepStale`, after `ZRANGEBYSCORE` returns the candidate list, each candidate gets a follow-up `ZSCORE` check. If the score is now above threshold (fresh write landed during the sweep), skip eviction. Test `skips drivers whose score refreshed during the sweep` proves this guard works.

There is still a TOCTOU window between `ZSCORE` and `removeDriver`, but its window is microseconds and the worst case is one missed discovery window — the next `driver.location-updated` re-indexes the driver. Acceptable.

### R-4: h3-js v4 API drift

**Risk noted:** v4 renamed v3 functions (`geoToH3` → `latLngToCell`, `kRing` → `gridDisk`).

**Resolution:** Pinned `h3-js@^4.4.0` in package.json. Service wraps the v4 names; if v5 changes them again, only `h3.service.ts` needs editing.

### R-5: Refactor of Task 004 event constants

**Risk noted:** Extracting event constants to `common/events/` could break Task 004 tests.

**Resolution:** Refactor used **re-export** (`export { X } from "common/events/..."`). All Task 004 import paths unchanged. Ran full test suite after the refactor — 177/177 pass. Then proceeded.

---

## Architectural compliance

| Rule (from ARCHITECTURE.md / CLAUDE.md) | Status |
|---|---|
| `geo` does not own a PostgreSQL table | ✅ no migration in this task |
| `geo` is pure compute + Redis sets | ✅ Redis is the only stateful surface |
| Module dependency direction `geo` → none at runtime | ✅ only imports `common/`, `infra/redis`, `config` |
| `geo` consumes events from `drivers`/`location` via EventEmitter | ✅ no class-level import of those modules |
| Driver identity from authenticated source only | ✅ event payloads originate from gateway/service, never client |
| No source-of-truth in Redis | ✅ `drivers.is_online` Postgres still authoritative |
| Validate event payload before mutating Redis | ✅ listener checks driverId + receivedAt; index service catches invalid coord |
| H3 resolution as named constants, not magic numbers | ✅ `H3_DRIVER_INDEX_RES_8/9` |
| Configuration via env + validation pipe | ✅ 2 new keys with `readPositiveInteger` + tests |
| No new logging of coordinates above debug level | ✅ logs only `driverId` + `errorName` |

---

## What did NOT make it in (deferred to later tasks)

- **Admin endpoint** to inspect cell membership — Task 010.
- **Metrics** (`geo_h3_evicted_total`, `geo_h3_sweep_duration_ms`) — future monitoring task. Logging is `log` level with `event: "geo.h3.sweep"` so a Loki/Promtail pipeline can promote into metrics.
- **OSRM / scoring / offer** — entirely Task 007 territory. `GeoFacade.findNearbyDrivers` is the only primitive Task 007 needs from this module.
- **Surge pricing** — Task 008.
- **Persistent location history** — would live in `location_events` if ever needed (ARCHITECTURE: "(archival sau này)").

---

## Open items for Task 007 author (matching engine)

When you wire matching to `GeoFacade`:

1. The facade returns **driver IDs only** — you'll need a follow-up step to fetch their current location from `DriverLocationCacheService` (Task 004 cache). Don't try to enrich here.
2. The facade returns drivers from **both r8 and r9** dedup'd in a single call. If you need score-by-resolution, you'll need a new method `findNearbyDriversByResolution` — propose it then; not implemented now.
3. **Idempotency of consumers** is required for the events `driver.went-online` (per Task 004 SI-3 review note: race window can double-emit). The H3 listeners are already idempotent; ensure your offer creation is too.
4. The sweeper can evict a driver who is in the middle of being offered a ride. Treat any cell-set lookup as a snapshot — re-verify the driver is online (DB) before sending an offer.

---

## Test count progression

| Task | Tests | Δ |
|---|---|---|
| 001 (Setup) | 61 | — |
| 002 (Auth) | 61 | 0 |
| 003 (Ride state machine) | 128 | +67 |
| 004 (Driver location realtime) | 177 | +49 |
| **005 (H3 discovery)** | **236** | **+59** |

---

## Closing

Task 005 hoàn thành. Code có thể merge và Task 007 (Matching) build trên top được rồi. `GeoFacade.findNearbyDrivers` là contract duy nhất expose ra ngoài — đủ minimal cho matching engine consume.

**Status:** ✅ PASS — 236 tests, lint clean, build clean, 13/13 self-review items green, không deferred blockers.
