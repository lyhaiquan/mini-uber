# Task 005: H3 Driver Discovery

## Task Name

Implement H3-based online driver discovery using Redis SETs maintained by event listeners + a scheduled sweeper.

## Goal

Index every online driver into Redis SETs keyed by their H3 cell at resolutions 8 and 9, then expose a discovery primitive that returns unique driver IDs within K rings of a pickup point. This is the geospatial backbone for Task 007 matching.

## Context

- Task 004 emits three domain events: `driver.went-online`, `driver.went-offline`, `driver.location-updated`. Task 005 subscribes to two of them (`location-updated`, `went-offline`) to maintain the Redis indexes. `went-online` is a no-op for indexing because there is no location yet.
- ARCHITECTURE locks: `geo` is a pure compute + Redis-sets module; it does **not** own any PostgreSQL table; it imports nothing from `drivers` or `location` at runtime (event names will be moved to `common/events/` to avoid the inverse import direction).
- Decisions locked with user before this spec was finalized:
  - **Membership strategy** = plain Redis SET per cell + scheduled sweeper job (no ZSET, no companion-key TTL).
  - **Discovery API** = always query both r8 and r9, dedup; matching engine never has to pick a resolution.
  - **Implementer** = Claude (self-implementing — this spec doubles as a design review checklist).

## Scope

### Infrastructure
- Add `h3-js@^4` for H3 cell conversion / ring expansion.
- Add `@nestjs/schedule@^4` for the sweeper interval. Mount `ScheduleModule.forRoot()` in `AppModule`.
- Add 2 env vars: `H3_DISCOVERY_MAX_RING`, `H3_STALE_SWEEP_INTERVAL_SECONDS`. Reuse `DRIVER_LOCATION_TTL_SECONDS` for the staleness threshold (no new TTL env).

### Light refactor of Task 004 code (event constants)
- Create `apps/backend/src/common/events/event-types.ts` exporting the three driver-event name constants.
- Update `drivers/events/driver-events.ts` and `location/events/location-events.ts` to re-export from `common/events/event-types.ts`. **No payload-type changes.** No call-site changes outside the two files.

### `geo` module (NEW)
- `geo.constants.ts` — `H3_DRIVER_INDEX_RES_8 = 8`, `H3_DRIVER_INDEX_RES_9 = 9`, `H3_DISCOVERY_MAX_RING_DEFAULT = 5`.
- `h3.service.ts` — pure wrapper around `h3-js`: `latLngToCell(lat, lng, res)`, `gridDisk(cellId, k)`, `isValidCoord(lat, lng)`. No I/O.
- `redis/h3-redis-keys.ts` — pure key builders: `cellKey(res, cellId)`, `companionKey(driverId)`, `lastSeenZsetKey()`.
- `redis/h3-redis-index.service.ts` — Redis operations:
  - `indexDriver(driverId, lat, lng, lastSeenAt)` — convert + diff against companion hash + SREM old + SADD new + HSET companion + ZADD last-seen.
  - `removeDriver(driverId)` — read companion → SREM both cells → DEL companion → ZREM last-seen.
  - `findNearbyDrivers(lat, lng, maxRing)` — convert pickup, gridDisk both res, build key list, SUNION each res, merge + dedup.
  - `sweepStale(now)` — ZRANGEBYSCORE for stale drivers, evict each via `removeDriver` semantics, return eviction count.
- `listeners/driver-location-updated.listener.ts` — `@OnEvent("driver.location-updated")` → `indexDriver(...)`.
- `listeners/driver-went-offline.listener.ts` — `@OnEvent("driver.went-offline")` → `removeDriver(...)`.
- `sweeper/stale-driver-sweeper.service.ts` — `onApplicationBootstrap` registers an interval via `SchedulerRegistry` with name `geo.h3.stale-sweep`. Each tick calls `sweepStale(Date.now())`, logs eviction count. Unregister on `onApplicationShutdown`.
- `geo.facade.ts` — exposes only `findNearbyDrivers(...)` for matching. Indexing/sweep are internal.
- `geo.module.ts` — providers + exports facade.

### Tests (Claude writes alongside implementation, no separate task)
- `h3.service.spec.ts` — known fixtures: lat/lng → cell at r8 + r9; gridDisk(cell, 0) returns [cell]; gridDisk(cell, k) cardinality `1 + 6*sum(i, 1..k)`; invalid coords throw.
- `h3-redis-index.service.spec.ts` — mocked Redis client:
  - `indexDriver` first call: SADD on both cells, HSET companion, ZADD last-seen
  - `indexDriver` same-cell update: no SREM/SADD diff, but ZADD timestamp refresh
  - `indexDriver` cell change: SREM old + SADD new
  - `removeDriver` with companion: SREM both + DEL + ZREM
  - `removeDriver` without companion: no-op (or guard error)
  - `findNearbyDrivers` SUNIONs both resolutions and dedups
  - `sweepStale` evicts only members with score < now - TTL
- `driver-location-updated.listener.spec.ts` — calls `indexDriver` with event payload fields
- `driver-went-offline.listener.spec.ts` — calls `removeDriver` with event aggregateId
- `stale-driver-sweeper.service.spec.ts` — bootstraps interval, tick triggers `sweepStale`, shutdown unregisters
- `geo.facade.spec.ts` — delegates to index service `findNearbyDrivers`
- `env.validation.spec.ts` — +2 tests for `H3_DISCOVERY_MAX_RING` and `H3_STALE_SWEEP_INTERVAL_SECONDS`

## Out of Scope

- Matching score / OSRM / ride offers (Task 007).
- Customer subscription (Task 007+).
- Surge pricing (Task 008).
- Persistent geospatial history.
- Frontend map.
- BullMQ — defer to Task 007 (offer timeout job).
- ZSET-based membership (rejected in design Q&A).
- Auto-fallback r9→r8 inside `geo` (rejected in design Q&A — matching engine policy belongs to Task 007 if needed).
- Admin REST endpoint for cell inspection (defer to Task 010).

## Functional Requirements

### Indexing
- On `driver.location-updated`: driver MUST appear in `h3:drivers:r8:{r8Cell}` AND `h3:drivers:r9:{r9Cell}`.
- On cell change: driver MUST be removed from the previous cells before being added to the new ones (or atomically swap; ordering within a single Redis call is fine).
- On `driver.went-offline`: driver MUST be removed from all H3 sets they belong to. Companion record MUST be deleted.
- Indexing MUST be idempotent for repeated `location-updated` events with the same cell (no SREM/SADD churn; only ZADD last-seen refresh).

### Discovery
- `findNearbyDrivers(lat, lng, maxRing)` MUST return an array of unique driver IDs.
- `maxRing` MUST be clamped to `[0, H3_DISCOVERY_MAX_RING]` (env upper bound). If caller passes a larger ring, the service clamps; if negative, throws `InvalidDiscoveryRingError` (HTTP-agnostic; this is an internal service).
- `findNearbyDrivers` MUST query both r8 and r9 keys in a single `SUNION` per resolution (Redis pipeline OK), then merge results in JavaScript and dedup with a `Set`.
- Returned IDs MUST come from the **current** indexes only — sweeper handles staleness; discovery does NOT do its own filtering.
- Empty discovery returns `[]`, not error.

### Sweeper
- Interval = `H3_STALE_SWEEP_INTERVAL_SECONDS * 1000` ms.
- On each tick: read `ZRANGEBYSCORE h3:drivers:last-seen 0 (now - DRIVER_LOCATION_TTL_SECONDS * 1000)`. For each stale driverId, call `removeDriver(driverId)`.
- Log per-tick summary: `{ event: "geo.h3.sweep", evicted: N, durationMs }` at `log` level.
- If sweep throws, log `error` and continue — sweeper MUST self-recover on next tick.

## Security Requirements

- Index ONLY drivers that arrive via authenticated `driver.location-updated` (the gateway already enforces this; geo trusts the event).
- Never read `driverId` from any untrusted source — driver ID always comes from `event.aggregateId` or `event.payload.driverId`, both of which originate from `socket.data.user.id` server-side (see Task 004 hard rule).
- No REST endpoint is exposed by `geo`. No WebSocket event. No public surface area in this task.
- `findNearbyDrivers` is an internal facade method, only callable by other modules. Future REST consumers (admin) MUST add their own auth.

## Database Requirements

- No PostgreSQL migration.
- Redis usage:
  - `h3:drivers:r8:{cellId}` — SET of driver IDs (cell at resolution 8)
  - `h3:drivers:r9:{cellId}` — SET of driver IDs (cell at resolution 9)
  - `h3:driver:cells:{driverId}` — HASH `{ r8: cellId, r9: cellId }` (companion for fast cell lookup)
  - `h3:drivers:last-seen` — ZSET, member = driverId, score = unix ms (for sweeper)

- All four key families have NO TTL (membership is managed actively by listeners + sweeper). This is intentional: TTL on a SET would expire the entire set, evicting unrelated drivers.

- No "source of truth" lives in Redis — `drivers.is_online` in Postgres remains authoritative. The H3 indexes are temporary discovery indexes per ARCHITECTURE.

## API/WebSocket Changes

None public. Internal facade method only:

```typescript
class GeoFacade {
  findNearbyDrivers(input: {
    lat: number;
    lng: number;
    maxRing?: number; // defaults to H3_DISCOVERY_MAX_RING; clamped
  }): Promise<string[]>;
}
```

## Business Rules

- Only **online** drivers should appear in discovery results. Enforced indirectly: the location gateway only writes location updates for online drivers, and the offline listener removes from indexes. The sweeper provides a safety net for drivers that go offline without a clean disconnect.
- A driver appears at MOST once in any single SET (Redis SET semantics).
- A driver appears at MOST once in `findNearbyDrivers` output (JavaScript `Set` dedup across resolutions).
- Discovery radius is bounded by `H3_DISCOVERY_MAX_RING`. Defaults to 5 (≈750m at r9; ≈3.5km at r8).

## Edge Cases

- Invalid lat/lng arrives in event payload → `h3.service` rejects via `isValidCoord`; listener logs `warn` and does NOT index. Sweeper will not be affected.
- H3 library throws on edge coords (poles, dateline) → listener logs `warn`, skips. Should be impossible if gateway validated, but defensive.
- Driver moves across cells rapidly → each event triggers SREM+SADD atomically (single MULTI/EXEC or single pipeline).
- Driver goes offline → listener removes; sweeper also removes if listener missed.
- Driver disconnects without offline event (Task 004 does NOT auto-offline on disconnect) → driver stays in indexes until sweeper TTL expires. Acceptable. Documented behavior.
- Redis unavailable → listener logs `error` and propagates `nothing` (does not crash the event emitter). Sweeper retries on next tick.
- Sweeper tick takes longer than interval → `SchedulerRegistry` queues; we will not let two ticks overlap. Use a re-entrancy guard (boolean flag) inside the sweeper.
- Empty `ZRANGEBYSCORE` result → sweeper completes with `evicted: 0`.
- `findNearbyDrivers(maxRing: 0)` → only the center cell at each resolution. Allowed.
- `findNearbyDrivers(maxRing: > H3_DISCOVERY_MAX_RING)` → clamp silently (or throw — DECISION: clamp silently, log debug).
- Driver has companion record but is no longer in either set (corruption) → `removeDriver` is robust: SREM no-ops, DEL/ZREM work.

## Configuration

Add to `.env.example`:
```
H3_DISCOVERY_MAX_RING=5
H3_STALE_SWEEP_INTERVAL_SECONDS=30
```

Validation in `env.validation.ts`:
- `H3_DISCOVERY_MAX_RING` — positive integer between 0 and 20 inclusive (r9 ring 20 is ~30km, plenty for any urban use).
- `H3_STALE_SWEEP_INTERVAL_SECONDS` — positive integer between 5 and 600 (5s aggressive, 10min loose).

Docker Compose: no change (Redis already present from Task 004).

## Tests Required

See list in **Scope → Tests** above. Minimum +25 tests targeting:
- H3 conversion correctness (3 tests)
- Redis index lifecycle: index, same-cell-update, cell-change, remove (4 tests)
- Discovery: empty, single cell, multi-ring, dedup across resolutions (4 tests)
- Sweep: evicts stale, leaves fresh, handles empty (3 tests)
- Listeners: route event to index/remove (2 tests)
- Sweeper service: bootstrap, tick, shutdown, re-entrancy guard (3 tests)
- Facade: delegates with clamped maxRing (2 tests)
- Env validation: new keys + range edges (2 tests)
- Key builders: pure (2 tests)

## Acceptance Criteria

- [ ] `h3-js` and `@nestjs/schedule` added to `apps/backend/package.json`.
- [ ] `common/events/event-types.ts` extracted; `drivers/events` and `location/events` re-export from there.
- [ ] All Task 004 tests still pass after the event-constants refactor.
- [ ] `geo` module created with all files listed under Scope.
- [ ] `GeoModule` wired into `AppModule`, `ScheduleModule.forRoot()` mounted once.
- [ ] On `driver.location-updated`: driver appears in `h3:drivers:r8:{cell}` AND `h3:drivers:r9:{cell}`, companion HASH set, ZSET score updated.
- [ ] On `driver.went-offline`: driver removed from both SETs, companion DELed, ZSET member removed.
- [ ] `findNearbyDrivers(lat, lng, maxRing)` returns unique driver IDs across both resolutions.
- [ ] Sweeper interval registered via `SchedulerRegistry`, evicts stale drivers each tick.
- [ ] `pnpm lint` clean, `pnpm build` clean.
- [ ] `pnpm test` passes with +25 tests minimum. Report delta from Task 004's 177.
- [ ] Self-review checklist (below) all green.

## Self-Review Checklist (Claude as architect → Claude as implementer)

- [ ] Module dependency direction: `geo` does NOT import `drivers` or `location` at runtime. Event constants come from `common/events/`. Payload types via `import type` only.
- [ ] Identity always from `event.aggregateId` or `event.payload.driverId`. Never from any client-controlled source.
- [ ] Redis ops idempotent: replaying the same `driver.location-updated` event produces the same final Redis state.
- [ ] Cell-change path uses a Redis pipeline/MULTI so SREM + SADD + HSET + ZADD are batched (no partial-state windows visible to readers).
- [ ] Sweeper re-entrancy guard prevents overlapping ticks if one tick exceeds interval.
- [ ] No coordinates logged at `log` or higher level. `debug` only.
- [ ] `removeDriver(driverId)` is safe to call on a driver who is not in any index (no throws, no errors).
- [ ] Empty SUNION returns empty array, not undefined / null.
- [ ] `maxRing` clamp behavior documented in JSDoc on facade.
- [ ] Event payloads validated minimally before indexing (lat/lng range; non-empty driverId). Bad payload → warn log, skip indexing, do NOT crash.
- [ ] Tests cover Redis pipeline ordering by asserting on the exact command sequence (using a mock ioredis pipeline).
- [ ] No timing-sensitive tests (use Jest fake timers for sweeper tests).
- [ ] No dependency on Task 007 contracts — facade signature is forward-compatible for matching consumer.

## Implementation Plan (Claude's execution order)

1. **Refactor event constants** — create `common/events/event-types.ts`; update 2 module event files. Run tests to confirm Task 004 still passes (baseline 177).
2. **Add deps** — `pnpm add h3-js @nestjs/schedule` under `apps/backend`. Lock versions in package.json.
3. **Env validation** — add 2 new keys with tests. Update `.env.example` and docker-compose env.
4. **Pure helpers** — `geo.constants.ts`, `h3.service.ts`, `redis/h3-redis-keys.ts` with tests.
5. **Redis index service** — `h3-redis-index.service.ts` with pipeline-based indexDriver/removeDriver/findNearby/sweepStale, plus spec.
6. **Listeners** — `driver-location-updated.listener.ts`, `driver-went-offline.listener.ts`, plus specs.
7. **Sweeper** — `stale-driver-sweeper.service.ts` with SchedulerRegistry bootstrap/shutdown + re-entrancy guard, plus spec.
8. **Facade + module** — `geo.facade.ts`, `geo.module.ts`. Wire into `AppModule`.
9. **Run full verification** — `pnpm lint`, `pnpm build`, `pnpm test`. Confirm 177 + Δ tests pass.
10. **Self-review** — walk the Self-Review Checklist. Fix anything that fails.
11. **Write a brief notes-and-risks doc** at `docs/reviews/005-h3-driver-discovery-r1.md` (since Claude is both author + reviewer, this doc is the post-mortem rather than a critique).

## Notes & Risks

- **Risk:** Pipelined Redis ops in `indexDriver` need careful ordering. A driver who moves cells mid-pipeline could leave a stale SADD if pipeline ordering is wrong. Mitigation: write SREM-then-SADD ordering, document, test with a pipeline mock that asserts call order.
- **Risk:** Sweeper interval drift if a tick exceeds the configured interval. Re-entrancy guard prevents pile-up but the *effective* eviction cadence becomes slower. Acceptable for thesis.
- **Risk:** Race between listener and sweeper — driver location update arrives the same millisecond the sweeper decides to evict. Since both use companion HASH as the source of truth for "which cells", the order of operations may cause a transient phantom membership. Mitigation: re-check companion HASH inside `removeDriver` so sweeper does not remove a driver who has just been re-indexed.
- **Risk:** `h3-js@4` API differs from v3 (different function names: `latLngToCell` vs `geoToH3`, `gridDisk` vs `kRing`). I will pin v4 explicitly.
- **Risk:** Task 004 refactor of event constants could break tests. Mitigation: run tests after step 1 before any new code.
- **Open future work:** Add admin endpoint to inspect cell membership (Task 010). Add metric `geo_h3_evicted_total` (future monitoring task).
