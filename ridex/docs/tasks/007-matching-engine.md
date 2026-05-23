# Task 007: Matching Engine

## Task Name

Implement the sequential ride-matching engine: discover candidate drivers, score them, offer one-at-a-time via WebSocket with BullMQ-backed timeout, retry the next candidate on reject/timeout, and finalize the ride either as `ACCEPTED` or `NO_DRIVERS_FOUND`.

## Goal

Compose the primitives built in Tasks 002–006 (auth, ride state machine, driver online state, realtime location cache, H3 discovery, OSRM route estimate) into the matching workflow. The single externally-visible contract is: a customer creates a ride (already implemented in Task 003), and within a bounded time the ride transitions to `ACCEPTED` with an assigned driver, or to `NO_DRIVERS_FOUND` when no candidate accepts. Driver-side UX is a WebSocket offer prompt with explicit accept/reject within an offer TTL.

## Context

- Task 003 already provides `RidesFacade.markMatching`, `assignDriver`, and `markNoDriversFound` SYSTEM transitions. Use them — do NOT bypass the state machine.
- Task 004 owns the location WebSocket gateway and driver online state. Reuse `DriverLocationCacheService.get(driverId)` for distance scoring fallback (when OSRM is also unavailable).
- Task 005 exposes `GeoFacade.findNearbyDrivers({ lat, lng, maxRing? })` returning driver IDs near a pickup.
- Task 006 exposes `RouteEstimator.estimate({ pickup, destination })` returning `{ distanceMeters, durationSeconds, confidence }`. Use it both for driver→pickup ETA (scoring) and pickup→destination (informational in the offer payload).
- ARCHITECTURE locks for `matching`:
  - May import from `rides` (read ride + system transitions), `geo` (discovery), `location` (cached driver positions), `routing` (OSRM), `drivers` (`isOnline` re-check on offer prep), `common/`, `infra/`.
  - Owns tables `ride_offers` and `ride_assignments`. **In Task 007 we add only `ride_offers`** — `ride_assignments` is deferred until a later cleanup task because `rides.driver_user_id` already records the assignment denormalized via the state machine. Document this deferral in PR summary.
  - Emits domain events `ride.matching.started`, `ride.matching.no-drivers`, `ride.offer.created`, `ride.offer.expired`, `ride.offer.rejected`, `ride.offer.accepted` (for downstream consumers like pricing/notifications/audit, not consumed inside `matching`).
- Decisions locked with user before this spec was written:
  - **Offer model:** sequential, one driver at a time. Score top-K candidates, offer #1, wait for accept/reject/timeout, then #2, …, until success or exhaustion.
  - **Timeout mechanism:** BullMQ delayed job. Add `bullmq` + `@nestjs/bullmq`. Per-offer delayed job; queue name `matching-offer-timeout`.
  - **Driver action channel:** WebSocket. Driver socket from Task 004 gets two new client→server events: `ride.offer.accept`, `ride.offer.reject`. Server→driver event: `ride.offer.received`. Server→driver lifecycle event: `ride.offer.cancelled` (when ride cancelled mid-flow or offer superseded).
  - **Matching trigger:** auto. On `ride.requested` domain event (emitted by `RidesService.createRide` — add the emission as part of this task), `matching` listener starts the workflow.

## Scope

### Infrastructure
- Add deps `bullmq@^5` and `@nestjs/bullmq@^11`. Wire `BullModule.forRoot({ connection: { url: REDIS_URL } })` in `AppModule` (or `BullModule.forRootAsync` if using ConfigService — preferred).
- Reuse the existing Redis instance from `infra/redis`. Do NOT spin up a second Redis client; let BullMQ use the same `REDIS_URL`.
- Add 5 env vars to `config/env.validation.ts`:
  - `MATCHING_MAX_CANDIDATES` — positive int, default `5`, range `[1, 50]`. Hard cap on drivers attempted per ride before falling back to `NO_DRIVERS_FOUND`.
  - `MATCHING_OFFER_TIMEOUT_SECONDS` — positive int, default `15`, range `[5, 120]`.
  - `MATCHING_DISCOVERY_MAX_RING` — positive int, default `3`, range `[0, 20]`. Passed to `GeoFacade.findNearbyDrivers({ maxRing })`. (Independent of `H3_DISCOVERY_MAX_RING` env cap; matching MAY use a lower ring than the geo cap.)
  - `MATCHING_SCORE_DISTANCE_WEIGHT` — positive number, default `0.6`, range `(0, 1]`. Weight of normalized distance in the score.
  - `MATCHING_SCORE_ETA_WEIGHT` — positive number, default `0.4`, range `(0, 1]`. Weight of normalized ETA. **Validation:** distance_weight + eta_weight MUST equal 1.0 (±0.001 tolerance). If not, env validation fails fast.

### Domain event emission from `rides` (light addition to Task 003)
- In `RidesService.createRide`, AFTER the transaction commits successfully, emit `ride.requested` via `EventEmitter2`. Event envelope follows ARCHITECTURE.md `Event envelope chuẩn`: `eventType: "ride.requested"`, `aggregateType: "ride"`, `aggregateId: <rideId>`, payload `{ customerId, pickup: {lat,lng}, destination: {lat,lng}, requestedAt }`.
- Add constant `RIDE_REQUESTED_EVENT = "ride.requested"` in `common/events/event-types.ts`; re-export from `rides/events/ride-events.ts`. Follow the same re-export pattern as Task 005.
- **Backward compat:** existing Task 003 tests must still pass. The emission is best-effort post-commit; if EventEmitter throws synchronously, log and continue — the customer ride was already saved.

### New `matching` module
```
apps/backend/src/matching/
  matching.constants.ts                    # event names, offer status enum keys, queue name
  matching.types.ts                        # internal DTOs / payload types
  matching.module.ts
  entities/
    ride-offer.entity.ts                   # @Entity({ name: "ride_offers" })
  enums/
    offer-status.enum.ts                   # OFFERED | ACCEPTED | REJECTED | TIMED_OUT | CANCELLED
  errors/
    matching-errors.ts                     # MatchingRideNotEligibleError, OfferNotFoundError, OfferNotOfferableError, OfferNotForDriverError
  events/
    matching-events.ts                     # re-exports + payload types for emitted events
  candidates/
    candidate-selection.service.ts         # GeoFacade → filter online → score → top-K
    candidate-scoring.service.ts           # pure: score(distance, eta, weights) → number; lower is better
  offer/
    ride-offer.repository.ts               # TypeORM-thin: insert, update status atomically, find for driver
    offer-orchestrator.service.ts          # the engine: nextOffer, handleAccept, handleReject, handleTimeout
    offer-timeout.queue.ts                 # BullModule queue registration: enqueue(offerId, delay)
    offer-timeout.processor.ts             # BullMQ Processor: on job → call orchestrator.handleTimeout(offerId)
  listeners/
    ride-requested.listener.ts             # @OnEvent("ride.requested") → orchestrator.startMatching(rideId)
  gateways/
    offer.gateway.ts                       # WebSocket: emit ride.offer.received/cancelled; receive ride.offer.accept/reject
  matching.facade.ts                       # exposes startMatching(rideId) and findOfferForDriver(driverId) for admin (admin not built this task; method exists for symmetry)
```

### Migration
- New migration: `2026-05-17_<timestamp>_create_ride_offers.ts` (use existing migration naming convention).
- Schema for `ride_offers`:
  ```sql
  CREATE TYPE matching_offer_status AS ENUM (
    'OFFERED', 'ACCEPTED', 'REJECTED', 'TIMED_OUT', 'CANCELLED'
  );

  CREATE TABLE ride_offers (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ride_id             uuid NOT NULL REFERENCES rides(id) ON DELETE RESTRICT,
    driver_user_id      uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status              matching_offer_status NOT NULL DEFAULT 'OFFERED',
    attempt_number      int  NOT NULL CHECK (attempt_number >= 1),
    score               numeric(10, 6) NOT NULL,
    distance_meters     int  NOT NULL CHECK (distance_meters >= 0),
    duration_seconds    int  NOT NULL CHECK (duration_seconds >= 0),
    route_confidence    text NOT NULL CHECK (route_confidence IN ('high','low')),
    offered_at          timestamptz NOT NULL DEFAULT now(),
    expires_at          timestamptz NOT NULL,
    responded_at        timestamptz NULL,
    finalized_at        timestamptz NULL,
    version             int  NOT NULL DEFAULT 0
  );

  CREATE INDEX ride_offers_ride_idx ON ride_offers (ride_id, attempt_number);
  CREATE INDEX ride_offers_driver_open_idx
    ON ride_offers (driver_user_id) WHERE status = 'OFFERED';

  -- At most ONE active offer per ride (partial unique). Prevents the
  -- duplicate-offer scenario in the spec.
  CREATE UNIQUE INDEX ride_offers_one_active_per_ride
    ON ride_offers (ride_id) WHERE status = 'OFFERED';

  -- At most ONE active offer per driver. Prevents double-offering a busy driver.
  CREATE UNIQUE INDEX ride_offers_one_active_per_driver
    ON ride_offers (driver_user_id) WHERE status = 'OFFERED';
  ```
- Migration MUST be reversible (down() drops indexes, table, then enum).

### Tests (Codex writes alongside implementation)
- `candidate-scoring.service.spec.ts` — pure function, ~6 tests:
  - Lower distance → lower (better) score
  - Lower duration → lower (better) score
  - Weights respected (distance weight 1, eta weight 0 → score depends only on distance)
  - Normalization formula stable across cohort
  - Confidence "low" applies a fixed penalty (multiplier or addend — DECISION: addend `+0.1` after normalization)
  - Zero distance + zero duration → score 0
- `candidate-selection.service.spec.ts` — mocks GeoFacade, DriversFacade, RouteEstimator, LocationCache:
  - Returns up to MATCHING_MAX_CANDIDATES, sorted by score ascending
  - Filters out drivers whose `isOnline()` is false (re-check at scoring time)
  - Filters out drivers without a cached location (cannot estimate driver→pickup distance)
  - Filters out the requesting customer's own user-id if a driver shares the id (paranoid check)
  - Filters out drivers with an active OFFERED row (already-busy)
  - Handles empty discovery → returns []
  - Handles RouteEstimator throwing → logs warn and skips that driver (does NOT fail the whole flow)
- `ride-offer.repository.spec.ts` — DB integration with a single test DataSource fixture (we already have one for ride-transition tests); ~8 tests:
  - Insert offer with status OFFERED
  - Unique partial index blocks second active per ride
  - Unique partial index blocks second active per driver
  - `transitionOfferStatus(offerId, fromStatus, toStatus)` is atomic and conditional (uses optimistic version OR `WHERE status = fromStatus`)
  - Returns null on stale fromStatus
- `offer-orchestrator.service.spec.ts` — the core engine, mocked deps; ~14 tests:
  - `startMatching`: marks ride MATCHING, runs candidate selection, picks #1, persists OFFERED row, emits `ride.offer.created`, schedules BullMQ delayed job, emits gateway `ride.offer.received`
  - `startMatching` with zero candidates → marks NO_DRIVERS_FOUND, emits `ride.matching.no-drivers`, no offer row
  - `handleAccept`: verifies offer status is OFFERED, transitions ride to ACCEPTED (atomic), updates offer to ACCEPTED, cancels BullMQ job, emits `ride.offer.accepted`
  - `handleAccept` on already-finalized offer → throws `OfferNotOfferableError`, no state change
  - `handleAccept` by a driver who is NOT the offer's driver → throws `OfferNotForDriverError`
  - `handleReject`: updates offer to REJECTED, cancels BullMQ job, retries next candidate (re-runs selection from cached candidate list or re-discovers — see Design)
  - `handleReject` past offer expiry (timestamp guard) → still accept the reject if status still OFFERED; if the timeout job already finalized → no-op + log
  - `handleTimeout`: updates offer to TIMED_OUT (only if still OFFERED), retries next candidate
  - Retry exhaustion (candidate list empty after K attempts) → marks NO_DRIVERS_FOUND
  - Two drivers race to accept the SAME offer → only one update succeeds (mocked at repository level by `affected = 0` return); second call throws `OfferNotOfferableError`
  - Ride cancelled mid-matching (CUSTOMER cancels): when orchestrator next tries to advance, `RidesFacade.getRideForMatching` throws `RideNotMatchingEligibleError` → orchestrator cancels in-flight offer (`CANCELLED`), emits `ride.offer.cancelled` to driver, exits cleanly
  - Same driver appears twice in discovery results → dedup'd before scoring (defense, even though GeoFacade already dedups)
- `offer-timeout.processor.spec.ts` — ~2 tests:
  - On job → calls `orchestrator.handleTimeout(offerId)`
  - Handler exception is swallowed + logged + does NOT retry (BullMQ default would retry; we set `attempts: 1`)
- `offer.gateway.spec.ts` — mocked auth + socket:
  - `ride.offer.accept` event → routes to orchestrator with authenticated `driverUserId` and the event's `offerId`; driver cannot pass a different driverId
  - `ride.offer.reject` event → routes to orchestrator with reason field optionally
  - Unauthenticated socket → rejected (auth guard exists from Task 004; reuse it)
  - Driver A cannot accept an offer addressed to driver B (test the auth check that returns `OfferNotForDriverError`)
  - Emits `ride.offer.received` to the correct driver's socket room (room id = `driver:<driverId>`, scheme reused from Task 004 if existing; new room namespace if not)
- `ride-requested.listener.spec.ts` — ~2 tests:
  - On event → calls `orchestrator.startMatching(rideId)`
  - Throwing orchestrator logs error but does NOT bubble up to event emitter
- `env.validation.spec.ts` — +6 tests for the 5 new keys + weight-sum validation
- `rides.service.spec.ts` — +1 test asserting `ride.requested` event emitted after createRide commits (with correct envelope shape)

## Out of Scope

- **Customer-facing WebSocket updates** (`ride.status.updated`, `ride.matching.started` push to customer) — defer to Task 010 (admin dashboard) or a dedicated Task 011. Customer polls `GET /rides/:id` for status in this task.
- **Pricing computation** — Task 008. Matching does NOT attach a fare to the offer; OSRM route is informational only.
- **`ride_assignments` table** — deferred. `rides.driver_user_id` is the assignment source of truth via the state machine.
- **OSRM Table API** (1-to-N matrix) — defer. Use `RouteEstimator.estimate` per candidate, N calls. Acceptable for K ≤ 5 candidates.
- **Surge pricing / driver tier preferences** — Task 008+.
- **Driver rating / reliability score** — future task; current score uses only distance + ETA.
- **Outbox pattern persistence** — defer to Task 008 or 009 when first cross-module transactional write needs it. `ride.requested` and offer events use in-process `EventEmitter2` only.
- **Push notifications / SMS / email** to drivers — Task 008+ (notifications module).
- **Audit log persistence** — Task 010 (audit module).
- **Admin endpoints to inspect offers** — Task 010.
- **Rate limiting on accept/reject** — Task 010 or a dedicated security task. Reuse Task 004 socket auth.
- **Multi-instance / horizontal scaling** of matching workers — `matching` is a singleton; BullMQ allows future scale-out but we won't test it here.
- **Driver-side cancellation after accept** — already covered by ride state machine (`ACCEPTED → CANCELLED` allowed for driver); no new matching-specific logic.
- **Replanning if customer changes pickup/destination during matching** — out of scope; ride creation is immutable in Task 003.

## Functional Requirements

### Startup
- On `ride.requested` event, matching listener invokes `OrchestratorService.startMatching(rideId)`.
- `startMatching` MUST verify ride is in `REQUESTED` state via `RidesFacade.getRideForMatching`. If not eligible → log and return without side effects.
- `startMatching` MUST transition ride `REQUESTED → MATCHING` via `RidesFacade.markMatching` BEFORE doing any candidate work.

### Candidate discovery + scoring
- Use `GeoFacade.findNearbyDrivers({ lat: pickup.lat, lng: pickup.lng, maxRing: MATCHING_DISCOVERY_MAX_RING })`.
- For each candidate driverId:
  1. `DriversFacade.isOnline(driverId)` → false → skip
  2. `DriverLocationCacheService.get(driverId)` → null → skip
  3. `RouteEstimator.estimate({ pickup: driverLoc, destination: ridePickup })` → catch throw, log warn, skip
  4. Skip driver if there is already an active OFFERED row for them (`ride_offers_one_active_per_driver` index also enforces at write-time; this is an early filter to avoid wasted scoring)
- Compute score (lower = better):
  ```
  normalizedDistance = distanceMeters / 10_000   // soft normalize: 10km → 1.0
  normalizedEta      = durationSeconds / 600     // 10min → 1.0
  baseScore          = w_dist * normalizedDistance + w_eta * normalizedEta
  confidencePenalty  = confidence === "low" ? 0.1 : 0
  score              = baseScore + confidencePenalty
  ```
- Sort ascending. Take top `MATCHING_MAX_CANDIDATES`. This is the ranked list for this matching session.

### Sequential offering
- For each candidate in order:
  1. INSERT into `ride_offers` with status `OFFERED`, `expires_at = now + MATCHING_OFFER_TIMEOUT_SECONDS`. If the partial unique index blocks (driver already has an active offer), skip to next candidate and log.
  2. Emit `ride.offer.created` domain event (event envelope).
  3. WebSocket: emit `ride.offer.received` to room `driver:{driverId}` with payload `{ offerId, rideId, pickup, destination, distanceMeters, durationSeconds, expiresAt, routeConfidence }`.
  4. Schedule BullMQ job in queue `matching-offer-timeout`: `{ offerId }`, delay = `MATCHING_OFFER_TIMEOUT_SECONDS * 1000`, jobId = `offer-timeout:{offerId}` (deterministic for cancellation), `attempts: 1` (no retries — timeout is single-shot).
  5. RETURN. Wait for one of: `handleAccept`, `handleReject`, `handleTimeout`.

### Handling responses
- `handleAccept(offerId, driverUserId)`:
  1. Repository-level conditional update: `UPDATE ride_offers SET status='ACCEPTED', responded_at=now(), finalized_at=now(), version=version+1 WHERE id=? AND status='OFFERED'`. If `affected=0` → throw `OfferNotOfferableError`.
  2. Verify `offer.driver_user_id === driverUserId`. If mismatch → revert the optimistic accept? **Better:** read offer FIRST, check driver match, THEN attempt conditional update. Order: SELECT → check → conditional UPDATE.
  3. Call `RidesFacade.assignDriver(rideId, driverUserId)`. This runs INSIDE its own transaction (`RideTransitionService.transition` already uses `dataSource.transaction` + `pessimistic_write`). It will atomically check ride is still MATCHING. If it throws (e.g., customer cancelled in the meantime) → revert offer to `CANCELLED`, emit `ride.offer.cancelled` to driver, exit.
  4. Cancel the pending BullMQ timeout job (`queue.remove(jobId)`).
  5. Emit `ride.offer.accepted` domain event.
- `handleReject(offerId, driverUserId, reason?)`:
  1. SELECT offer, verify driver match, conditional UPDATE `OFFERED → REJECTED` (same pattern as accept).
  2. Cancel BullMQ job.
  3. Emit `ride.offer.rejected` event.
  4. Invoke `tryNextCandidate(rideId)` — see below.
- `handleTimeout(offerId)` (called by BullMQ processor):
  1. Conditional UPDATE `OFFERED → TIMED_OUT` (no version check needed; the conditional WHERE handles it).
  2. If `affected=0`, offer was already finalized (accepted/rejected/cancelled) — exit silently. **No emit.**
  3. Emit `ride.offer.expired` event.
  4. WebSocket: emit `ride.offer.cancelled` to driver (UX feedback that the prompt is gone).
  5. Invoke `tryNextCandidate(rideId)`.

### Retry / exhaustion
- `tryNextCandidate(rideId)`:
  1. Re-verify ride is still MATCHING. If not (cancelled or already accepted via race) → exit.
  2. Read the ranked candidate list. **Design choice:** the orchestrator MUST persist the ranked candidate list and an "attempt cursor" for this ride somewhere, OR re-run candidate discovery+scoring every time. DECISION: **re-run discovery+scoring** each retry. Reasoning: drivers move; cached candidate list goes stale; cost is small (K ≤ 5 OSRM calls per retry). Filter out drivers we've already offered to (look up `ride_offers` for this `ride_id` with status in (OFFERED, REJECTED, TIMED_OUT)).
  3. If no remaining unattempted candidates after a fresh discovery → call `RidesFacade.markNoDriversFound(rideId, "exhausted")` and emit `ride.matching.no-drivers`.
  4. Else: pick the next best driver and repeat the "Sequential offering" loop.
- Cap: number of total attempted offers per ride MUST NOT exceed `MATCHING_MAX_CANDIDATES`. Track via `attempt_number` in the offer row + COUNT query on retry.

### Cancellation race
- Customer cancels ride mid-flow → ride transitions to `CANCELLED`. The orchestrator detects this on the next `tryNextCandidate` cycle and exits. Any in-flight OFFERED row is cancelled by the next event arriving (accept/reject/timeout), via the eligibility check.
- Driver going offline after receiving offer but before responding → offer continues to count down; timeout will retry next candidate.

## Security Requirements

- WebSocket events `ride.offer.accept` / `ride.offer.reject`:
  - MUST require an authenticated driver socket (reuse Task 004 socket auth guard).
  - The `driverUserId` used in orchestrator calls MUST come from `socket.data.user.id` — NEVER from the event payload. Even if the client sends `{ offerId, driverId: "..." }`, the server ignores the client-supplied driverId.
- The orchestrator MUST verify `offer.driver_user_id === socket.data.user.id`. If mismatch → emit a private error event back to the driver socket (`ride.offer.error` with code) and log. Do NOT mutate offer state. Throw `OfferNotForDriverError` for tests.
- A customer MUST NOT be able to subscribe to driver offer events. Offer room is `driver:{driverId}` and join is restricted to socket whose `user.id === driverId` and `user.role === DRIVER`.
- `ride.offer.received` payload MUST NOT contain the customer's user id, name, or phone. Only `{ offerId, rideId, pickup, destination, distance/duration, expiresAt, routeConfidence }`. Customer PII is exposed only after ACCEPT (and via a separate ride-detail endpoint, not in this task).
- Driver actions are idempotent: replaying `ride.offer.accept` for an already-finalized offer returns an error event, never double-assigns.
- Coordinates passed to OSRM go through `RouteEstimator` validation (Task 006 already covers).
- DB writes happen in transactions; ride assignment uses the existing `pessimistic_write` lock from Task 003.

## Database Requirements

- Migration `create_ride_offers` as specified in Scope.
- `ride_offers` is owned by `matching` module — only `matching` writes. `rides` and other modules MUST NOT touch this table directly.
- Indexes:
  - `(ride_id, attempt_number)` for retry queries.
  - Partial unique on `(ride_id) WHERE status='OFFERED'` — enforces at-most-one active offer per ride. **This is the duplicate-offer-prevention guarantee.**
  - Partial unique on `(driver_user_id) WHERE status='OFFERED'` — enforces at-most-one active offer per driver.
  - Partial index `(driver_user_id) WHERE status='OFFERED'` for driver-side lookup.
- Foreign keys with `ON DELETE RESTRICT` — we never delete drivers or rides; orphans must surface as errors not silent loss.
- Atomic accept: rely on Task 003's `RideTransitionService.transition` (`pessimistic_write` + version check) to win the race. The offer-level conditional UPDATE (`WHERE status='OFFERED'`) wins the offer race.
- Redis usage: BullMQ queue `matching-offer-timeout` only. No matching-specific cache. The active-offer index lookup is via Postgres partial unique index, not Redis — Redis is NOT the source of truth.

## API/WebSocket Changes

### WebSocket (driver namespace, reuse Task 004 gateway namespace OR new namespace)

**DECISION: new gateway** at `matching/gateways/offer.gateway.ts`. Reasoning: keep location-update concerns separate from offer concerns; both gateways auth via the same JWT.

Server → driver:
- `ride.offer.received`
  ```typescript
  {
    offerId: string;
    rideId: string;
    pickup: { lat: number; lng: number; address?: string };
    destination: { lat: number; lng: number; address?: string };
    distanceMeters: number;            // driver → pickup
    durationSeconds: number;
    expiresAt: string;                 // ISO 8601
    routeConfidence: "high" | "low";
  }
  ```
- `ride.offer.cancelled`
  ```typescript
  { offerId: string; reason: "TIMED_OUT" | "RIDE_CANCELLED" | "SUPERSEDED" }
  ```
- `ride.offer.error` (per-socket validation/auth errors)
  ```typescript
  { code: "NOT_FOR_DRIVER" | "ALREADY_FINALIZED" | "OFFER_NOT_FOUND"; offerId?: string }
  ```

Driver → server:
- `ride.offer.accept` payload `{ offerId: string }`. ACK / error event back.
- `ride.offer.reject` payload `{ offerId: string; reason?: string }`. ACK / error event back.

### REST
- None added in this task. Existing `GET /rides/:id` already returns the ride row including `status` and (eventually after accept) `driver_user_id`.

### Domain events (in-process)
| Event | Emitted by | Consumed by (this task) |
|---|---|---|
| `ride.requested` | `RidesService.createRide` | `matching/listeners/ride-requested.listener` |
| `ride.matching.started` | orchestrator (post markMatching) | none yet |
| `ride.matching.no-drivers` | orchestrator | none yet |
| `ride.offer.created` | orchestrator | none yet |
| `ride.offer.accepted` | orchestrator | none yet |
| `ride.offer.rejected` | orchestrator | none yet |
| `ride.offer.expired` | orchestrator (or timeout processor) | none yet |
| `ride.offer.cancelled` | orchestrator | none yet |

All event constants live in `common/events/event-types.ts` re-exported from `matching/events/matching-events.ts` and `rides/events/ride-events.ts`.

## Business Rules

- Only drivers with `is_online = true` AND a cached location can be offered. Re-checked at offer time, not just at discovery time.
- One active offer per ride at any moment (DB partial unique).
- One active offer per driver at any moment (DB partial unique).
- A driver cannot accept an offer not addressed to them.
- A driver cannot accept/reject after `expires_at` — the BullMQ timeout will finalize the offer to `TIMED_OUT` first; subsequent driver actions hit the conditional UPDATE and fail. Edge case: action lands within microseconds of timeout — first-write-wins via conditional UPDATE.
- An accepted offer wins; the ride transitions to ACCEPTED with `driver_user_id` set; remaining workflow is owned by Task 003 (driver arrives → in progress → completed).
- If the ride is cancelled by the customer during matching, any in-flight offer is cancelled with reason `RIDE_CANCELLED` and the driver receives a WebSocket notification.
- The score function is deterministic given the same inputs. Weights are env-driven; changing weights does NOT require code change.

## Edge Cases

- **No drivers anywhere**: discovery returns []. Mark `NO_DRIVERS_FOUND` immediately after `MATCHING` transition.
- **All discovered drivers are busy** (have active offers): selection filters them out → empty candidate list → `NO_DRIVERS_FOUND` (treated identically to "no drivers anywhere").
- **All candidates reject in sequence**: after `MATCHING_MAX_CANDIDATES` attempts, mark `NO_DRIVERS_FOUND`.
- **OSRM completely down for a candidate**: `RouteEstimator` returns fallback. Score uses fallback distance with `confidence: "low"` penalty. Driver still offered.
- **OSRM down + no cached driver location**: driver is skipped (cannot estimate driver→pickup at all).
- **Driver goes offline after offer sent**: offer continues. If driver doesn't accept within timeout, normal timeout flow fires.
- **Driver disconnects, then their WebSocket reconnects**: the orchestrator does NOT re-send the offer. The active offer row exists; driver client can call `GET /rides/me/active-offer` — **out of scope for Task 007**, defer to Task 010.
- **Customer cancels during MATCHING**: handled in `tryNextCandidate` eligibility check.
- **Two drivers race to accept the same offer**: impossible by design (one offer is sent at a time, sequentially). The partial-unique index would catch any bug that broke this invariant.
- **Same driver receives offers for two rides simultaneously**: prevented by `ride_offers_one_active_per_driver` partial unique. The second INSERT fails with a unique-violation error; the orchestrator catches, logs, and skips that driver in the current ride's candidate list.
- **BullMQ Redis temporarily down at offer time**: enqueue throws → orchestrator MUST NOT leak an OFFERED row without a timeout fallback. **DECISION:** wrap `INSERT offer → emit → enqueue timeout job` in this order; if enqueue throws, run a compensating UPDATE: `OFFERED → CANCELLED` with reason "TIMEOUT_SCHEDULING_FAILED", then `tryNextCandidate`.
- **Process restart with offers in flight**: BullMQ jobs persist in Redis, so timeout fires normally on next process. Any in-memory cursor state is lost — but we explicitly designed retries to re-run discovery, so no in-memory state to lose.
- **Driver accepts AFTER customer already cancelled**: orchestrator catches `RideNotMatchingEligibleError` from `assignDriver` → reverts offer to CANCELLED + emits cancellation to driver. Driver's UI shows ride was already cancelled.

## Tests Required

See Scope > Tests. **Test count target: +38 to +46 new tests.** Final count: 261 → **~300-307**.

- Use existing test patterns (mocked Redis, mocked TypeORM repository, real h3-js, jest fake timers for BullMQ where applicable).
- For BullMQ: mock `Queue` and `Processor` constructors. Do NOT spin up a real Redis in unit tests.
- For DB repository tests: reuse existing test DB setup from Task 003 (`ride-transition.service.spec.ts`'s pattern).
- All MUST-fix items in this spec MUST have at least one test asserting the behavior.

## Acceptance Criteria

- [ ] `pnpm --filter backend lint` returns 0 errors.
- [ ] `pnpm --filter backend build` succeeds.
- [ ] `pnpm --filter backend test` count ≥ 299 (261 baseline + ≥ 38 new).
- [ ] New migration runs cleanly forward and reverses cleanly (verify both directions in CI or document manually).
- [ ] Env validation rejects misconfigured weights (sum ≠ 1.0 ± 0.001).
- [ ] No new direct DB writes to `rides` outside `RidesFacade` / `RideTransitionService`.
- [ ] No imports from `rides`/`drivers`/`location`/`geo`/`routing` to `matching` (one-way). Verified via grep.
- [ ] `ride_offers` table only written by `matching` module.
- [ ] Driver socket auth required for `ride.offer.accept` / `ride.offer.reject`. Verified by spec test.
- [ ] Customer cannot join `driver:{driverId}` room. Verified by spec test.
- [ ] BullMQ queue uses the same Redis URL as the app; no second Redis instance.
- [ ] PR summary documents: (a) the `ride_assignments` table deferral, (b) the candidate list re-discovery design choice, (c) score normalization constants (`10_000m`, `600s`) rationale, (d) why retries cap at `MATCHING_MAX_CANDIDATES`.
- [ ] `.env.example` updated with 5 new keys.

## Prompt for Codex

Implement Task 007 only. Build a NestJS `matching` module that orchestrates sequential ride-driver matching using H3 discovery (Task 005 `GeoFacade`), OSRM ETA (Task 006 `RouteEstimator`), driver online state (Task 004 `DriversFacade`), and the ride state machine (Task 003 `RidesFacade`).

**Flow:**
1. On `ride.requested` domain event (emitted by `RidesService.createRide` post-commit — add this emission), the orchestrator transitions ride to `MATCHING`, discovers nearby drivers, scores them by weighted distance + ETA + low-confidence penalty, takes top-K, and sequentially offers to each.
2. Each offer is persisted in a NEW `ride_offers` table (migration required), emitted via WebSocket `ride.offer.received` to room `driver:{driverId}`, and scheduled for timeout via a BullMQ delayed job (`matching-offer-timeout` queue).
3. Driver responds via WebSocket events `ride.offer.accept` / `ride.offer.reject` (new gateway `OfferGateway`, JWT-authed, driver-id from `socket.data.user.id` only — never from payload).
4. Accept → atomic ride state transition `MATCHING → ACCEPTED` with `driverUserId` (use existing `RidesFacade.assignDriver`), offer status → ACCEPTED, BullMQ job cancelled.
5. Reject or timeout → offer status → REJECTED/TIMED_OUT, re-run discovery (filter out already-attempted drivers), offer next candidate.
6. Exhaustion (no candidates after K attempts) → `RidesFacade.markNoDriversFound`.

**Add deps:** `bullmq@^5`, `@nestjs/bullmq@^11`. Wire `BullModule.forRootAsync` reusing `REDIS_URL`.

**Add env keys** (with validation + tests):
- `MATCHING_MAX_CANDIDATES` (int 1-50, default 5)
- `MATCHING_OFFER_TIMEOUT_SECONDS` (int 5-120, default 15)
- `MATCHING_DISCOVERY_MAX_RING` (int 0-20, default 3)
- `MATCHING_SCORE_DISTANCE_WEIGHT` (number (0, 1], default 0.6)
- `MATCHING_SCORE_ETA_WEIGHT` (number (0, 1], default 0.4)
- Validation: distance_weight + eta_weight must equal 1.0 ± 0.001.

**Add migration** for `ride_offers` (id, ride_id, driver_user_id, status enum, attempt_number, score, distance_meters, duration_seconds, route_confidence, offered_at, expires_at, responded_at, finalized_at, version) with TWO partial unique indexes: `(ride_id) WHERE status='OFFERED'` and `(driver_user_id) WHERE status='OFFERED'`. These are the duplicate-prevention guarantees.

**Hard rules:**
- Driver-id used in any state-mutating call MUST come from `socket.data.user.id` server-side. Reject mismatches with `ride.offer.error`.
- All ride state changes go through `RideTransitionService`. Do NOT write to `rides.status` directly.
- `matching` imports allowed: `rides`, `drivers`, `location`, `geo`, `routing`, `common/`, `infra/`. NOT allowed in reverse.
- BullMQ Redis-unavailable at enqueue → compensate by setting offer to CANCELLED and retrying next candidate (do NOT leak a timeout-less offer).
- Score: `score = w_dist * (distance/10_000) + w_eta * (duration/600) + (confidence === 'low' ? 0.1 : 0)`. Lower is better.

**Tests** per the "Tests Required" section. Target: 261 → ≥ 299. Lint clean, build clean.

**Out of scope (do NOT implement):** customer-facing WS updates, `ride_assignments` table, OSRM Table API, pricing, push notifications, audit log, admin endpoints, driver rating, surge, rate limiting beyond Task 004's auth, replan-on-customer-update.

Finish with **Summary**, **Changed files** (categorized: new module / modified existing / migrations / docs), **Tests run** (count delta), **Notes/Risks** (call out: `ride_assignments` deferral, candidate list re-discovery rationale, BullMQ Redis dependency, any spec deviations).
