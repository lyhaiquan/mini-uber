# Review: Task 007 — Matching Engine (Round 1)

**Task file:** `docs/tasks/007-matching-engine.md`
**Implementer:** Codex
**Reviewer:** Claude
**Date:** 2026-05-17

---

## Verdict: **PASS WITH FIXES**

Codex implement đủ scope, không drift, mọi hard rule trong spec đều thỏa mãn ở mức tối thiểu. Test count vượt target (309 vs ≥ 299). Có 1 vấn đề UX subtle về ACK semantics khi accept race với customer cancel + 2 should-improve khác. Không có blocker — Task 008 có thể bắt đầu song song với fix-up nếu muốn.

```
pnpm lint:    clean (0 errors)
pnpm build:   clean
pnpm test:    40 suites, 309 tests passed  (+48 từ Task 006: 261 → 309; spec yêu cầu ≥ +38)
```

---

## Summary

`matching` module 25 files mới:

```
matching/
  matching.constants.ts                  # event names, queue name, score consts, room prefix
  matching.types.ts                      # MatchingRide, MatchingCandidate, OfferReceivedPayload, ...
  matching.module.ts                     # exports MatchingFacade only
  matching.facade.ts                     # startMatching + findOfferForDriver
  enums/offer-status.enum.ts             # OFFERED|ACCEPTED|REJECTED|TIMED_OUT|CANCELLED
  errors/matching-errors.ts              # OfferNotFoundError, OfferNotForDriverError, OfferNotOfferableError, MatchingRideNotEligibleError
  events/matching-events.ts              # re-exports + payload types
  entities/ride-offer.entity.ts          # @Entity với 4 indexes (2 partial unique)
  candidates/
    candidate-scoring.service.ts         # pure score(distance, duration, confidence, weights)
    candidate-selection.service.ts       # GeoFacade → filter (online + cache + customer + busy + attempted) → score → top-K
  offer/
    ride-offer.repository.ts             # insert/find/count/transition (conditional UPDATE)
    offer-orchestrator.service.ts        # startMatching, handleAccept, handleReject, handleTimeout, tryNextCandidate
    offer-timeout.queue.ts               # BullMQ enqueue/cancel với deterministic jobId
    offer-timeout.processor.ts           # @Processor → handleTimeout
  listeners/ride-requested.listener.ts   # @OnEvent("ride.requested") → orchestrator.startMatching
  gateways/
    offer.gateway.ts                     # WebSocket, JWT auth, room driver:{id}, accept/reject events
    offer-action.dto.ts                  # @IsUUID offerId, @IsOptional reason
```

Plus:
- `database/migrations/1778950800000-CreateRideOffersTable.ts` — table + enum + 4 indexes, reversible
- `rides/rides.service.ts` — `EventEmitter2.emit("ride.requested", domainEvent)` post-commit; new test
- `rides/events/ride-events.ts` — re-export `RIDE_REQUESTED_EVENT`
- `common/events/event-types.ts` — 7 event constants thêm cho matching
- `config/env.validation.ts` — 5 keys + weight-sum validation
- `app.module.ts` — `BullModule.forRootAsync` reusing `REDIS_URL`; `MatchingModule` registered
- `.env.example` — 5 keys
- `package.json` — `bullmq@^5`, `@nestjs/bullmq@^11`

---

## Compliance vs spec

| Spec requirement | Status | Note |
|---|---|---|
| `ride.requested` emitted post-commit | ✅ | After transaction, try/catch — best-effort, doesn't fail ride creation |
| Sequential offer model | ✅ | Loop in `tryNextCandidate`, returns after first successful enqueue |
| BullMQ delayed job per offer | ✅ | `attempts: 1`, `removeOnComplete/Fail`, deterministic `jobId` |
| New `OfferGateway`, not nested in LocationGateway | ✅ | Separate file, separate auth |
| Driver-id từ `socket.data.user.id` only | ✅ | `stripSpoofedDriverId()` deletes `driverId`/`driverUserId` từ payload trước validation |
| Room `driver:{driverId}` | ✅ | `DRIVER_OFFER_ROOM_PREFIX = "driver:"` |
| Conditional UPDATE OFFERED→X via WHERE | ✅ | `andWhere("status = :fromStatus")`, returns null on `affected !== 1` |
| Atomic ride assignment via `RidesFacade.assignDriver` | ✅ | Reuses Task 003 pessimistic_write transition |
| BullMQ Redis-down compensation | ✅ | `transitionOfferStatus` to CANCELLED, loop continues to next candidate |
| 2 partial unique indexes (per-ride + per-driver) | ✅ | Migration SQL has both `WHERE "status" = 'OFFERED'` |
| Weight-sum env validation (= 1.0 ± 0.001) | ✅ | `MATCHING_WEIGHT_SUM_TOLERANCE` check |
| `matching` imports `rides`/`drivers`/`location`/`geo`/`routing`, NOT reverse | ✅ | Verified via grep; `rides`/`drivers`/etc don't import from `matching` |
| Score formula: w_d * dist/10k + w_e * eta/600 + 0.1 if low | ✅ | Constants `DISTANCE_NORMALIZATION_METERS = 10_000`, `ETA_NORMALIZATION_SECONDS = 600`, `LOW_CONFIDENCE_SCORE_PENALTY = 0.1` |
| `maxCandidates` retry cap | ✅ | `countAttempts` + loop guard |
| Re-run discovery per retry (not cached list) | ✅ | `tryNextCandidate` calls `selectCandidates` each time; `findAttemptedDriverIds` filters out already-tried |
| `findOfferForDriver` on facade for future admin | ✅ | Symmetric placeholder |

---

## Strengths

1. **Defense-in-depth payload sanitization**: `stripSpoofedDriverId()` deletes `driverId`/`driverUserId` from client payload BEFORE validation — even if a future change to `OfferActionDto` adds a `driverId` field, server-side identity from socket auth is non-bypassable.
2. **`forwardRef` between gateway and orchestrator** handled correctly. Build resolves, DI tests pass.
3. **CHECK constraints in migration**: `attempt_number >= 1`, `distance_meters >= 0`, `duration_seconds >= 0`, `route_confidence IN ('high','low')` — DB-level guard rails beyond what spec required.
4. **Migration fully reversible**: `down()` drops indexes → table → enum in correct order.
5. **`OfferTimeoutQueue.cancel`** silently no-ops if job doesn't exist (already consumed/removed). Idempotent — safe for double-cancel after accept race.
6. **BullMQ uses the existing `REDIS_URL`** via `BullModule.forRootAsync` — no second Redis client, no new env.
7. **Deterministic BullMQ `jobId` = `offer-timeout:{offerId}`** — allows `cancel()` by ID without scanning queue.
8. **`tryNextCandidate` re-checks ride eligibility every retry** — handles customer-cancel mid-flow gracefully via `cancelActiveOffer`.
9. **`emitOfferCancelled` fires WS to driver** when ride becomes ineligible — driver UI gets a definitive "offer gone" signal.

---

## Findings

### SI-1 (Should improve, **non-blocking**): Accept race with customer-cancel returns misleading ACK

**Location:** `offer-orchestrator.service.ts:94-128` (`handleAccept`).

**Behavior:** Driver sends `ride.offer.accept`. The conditional UPDATE OFFERED → ACCEPTED succeeds. Then `ridesFacade.assignDriver(rideId, driverUserId)` throws because the customer cancelled the ride in the same millisecond (`MATCHING → CANCELLED` already happened, so `MATCHING → ACCEPTED` is invalid).

Orchestrator's compensation:
```ts
catch (error) {
  await this.offerRepository.transitionOfferStatus(offer.id, ACCEPTED, CANCELLED);
  this.emitOfferCancelled(offer, "RIDE_CANCELLED");   // WS notify
  return;   // ← returns successfully, no throw
}
```

The gateway then sends `ack({ ok: true })` to the driver — implying "you got the ride" — milliseconds before the same socket receives `ride.offer.cancelled` with reason `RIDE_CANCELLED`. Frontend has to handle this UX:
1. Show "Accepted!" briefly (from ack)
2. Immediately undo and show "Passenger cancelled" (from WS event)

Eventual consistency works, but it's a guaranteed visual flash. Cleaner semantics:

```ts
catch (error) {
  await this.offerRepository.transitionOfferStatus(offer.id, ACCEPTED, CANCELLED);
  this.emitOfferCancelled(offer, "RIDE_CANCELLED");
  throw new OfferNotOfferableError(offerId);   // ← gateway maps to ack({ ok: false, code: "ALREADY_FINALIZED" })
}
```

Driver UI now shows the error directly, no flash.

**Test gap:** `"cancels an accepted offer if ride assignment fails"` checks the compensation but NOT that the gateway's ack semantically reflects the failure. Add an orchestrator-throws-on-compensation case + gateway test that ack is `{ ok: false }` in that path.

**Why non-blocking:** The WS cancel event arrives within a frame; driver UX is degraded but not broken.

### SI-2 (Should improve): Misleading reason on "all candidates Redis-enqueue failed"

**Location:** `offer-orchestrator.service.ts:178-211` (`tryNextCandidate`).

If BullMQ Redis is completely down, EVERY `offerCandidate` returns `false` (enqueue throws). After looping through all candidates, the final call is `noDriversFound(rideId, "no_candidates")` — but the actual situation is "infra unavailable". Pricing / analytics consumers of `ride.matching.no-drivers` event will conflate two very different states.

**Fix (~5 lines):** Track whether any candidate failed due to enqueue vs whether candidates were filtered out before insert. Pass a richer reason like `"timeout_scheduling_failed"` vs `"no_candidates"`. Or emit a separate `ride.matching.infra_failed` event for ops alerting.

**Why non-blocking:** Redis-down across an entire matching cycle is a rare ops event; logs still capture the underlying cause via `matching.offer.timeout_enqueue_failed`. No incorrect state.

### SI-3 (Should improve): Scoring short-circuit branch is inconsistent

**Location:** `candidate-scoring.service.ts:17-32`.

```ts
if (input.distanceMeters === 0 && input.durationSeconds === 0) {
  return input.confidence === "low" ? LOW_CONFIDENCE_SCORE_PENALTY : 0;
}
// Otherwise: normalize + weight + add penalty
```

The short-circuit isn't necessary — `0/N = 0`, so the general formula also returns `0` (or `0.1` if low). The two branches always produce identical output. Removing the if-block simplifies the function and removes a code path that doesn't need testing.

**Why non-blocking:** Pure stylistic; behavior is correct.

### NTH-1 (Nice to have): Both gateways share default Socket.IO namespace

`LocationGateway` (Task 004) and `OfferGateway` (Task 007) both decorate with bare `@WebSocketGateway()` — same namespace `/`. Every connecting socket runs `handleConnection` on BOTH gateways, meaning JWT verification fires twice on every connect. Not incorrect, but wasted CPU on each new connection.

**Possible fix:** Move `OfferGateway` to `@WebSocketGateway({ namespace: "/offers" })`. Driver client opens two sockets (one for location, one for offers). Or centralize auth in a shared adapter.

**Why non-blocking:** Authentication cost per socket connect is negligible vs the bigger cost of one Redis check per location update (location gateway hits Redis on every message).

### NTH-2 (Nice to have): Deep import `@nestjs/websockets/decorators/ack.decorator`

```ts
import { Ack } from "@nestjs/websockets/decorators/ack.decorator";
```

`@nestjs/websockets@10.4.22`'s top-level `decorators/index.d.ts` does NOT re-export `Ack`, so the deep import is the only way to access it. This is technically a Nest packaging oversight (Ack is marked `@publicApi` in JSDoc but not re-exported). Future minor versions may fix the re-export or move the file — at which point this import breaks.

**Why non-blocking:** Works today; not Codex's fault. Worth a comment explaining the deep path so future maintainers know.

### NTH-3 (Nice to have): Repository spec mocks TypeORM, doesn't exercise partial unique constraint

`ride-offer.repository.spec.ts` is fully mocked — the partial unique indexes (`ride_offers_one_active_per_ride` and `_per_driver`) that are the DB-level duplicate-prevention guarantee are not tested. Spec asked for a DataSource fixture, but project convention (verified against Task 003 `ride-transition.service.spec.ts`) is fully-mocked TypeORM. **Codex followed project convention**, so this is consistent; flagging as future work, not Codex's fault.

If thesis needs higher confidence, add a single integration test that spins up Postgres via docker-compose and asserts the unique constraint blocks a second active row. Defer until a dedicated test-infra task.

### NTH-4 (Nice to have): Logging detail when assignDriver fails

`offer-orchestrator.service.ts:114` logs `errorName` but not the rejected ride status. Useful for debugging the accept-vs-cancel race: did the ride go to CANCELLED (customer cancel) or NO_DRIVERS_FOUND (another race)? Adding `errorName` is fine; adding `rideId` is already there; adding `error.message` would help triage. Trade-off: more chatty logs.

---

## Hard Review Rules recheck (from CLAUDE.md)

| Rule | Status |
|---|---|
| Bypasses authentication, RBAC, or object-level authorization | ✅ JWT verification per socket; role check `=== DRIVER` |
| Trusts ride status, ownership, driver assignment from client | ✅ Driver-id from `socket.data.user.id`; offer.driverUserId verified server-side |
| Allows invalid ride state transitions | ✅ Reuses `RideTransitionService` — state machine intact |
| Changes database schema without a migration | ✅ Migration `CreateRideOffersTable1778950800000` present |
| Adds a WebSocket event without authentication and room-level authorization | ✅ Auth in `handleConnection`; room `driver:{id}` enforced server-side |
| Stores long-lived source-of-truth data only in Redis | ✅ Offer persisted in Postgres; BullMQ queue is transient timeout state |
| Logs passwords, access tokens, refresh tokens, or unmasked sensitive data | ✅ Logs only `event`, `offerId`, `rideId`, `driverUserId`, `errorName` |
| Introduces broad refactors outside the task | ✅ Only `rides.service.ts` and `common/events/event-types.ts` touched outside `matching/` and `database/migrations/` |
| Adds dependencies or technologies not approved by the task | ✅ Only `bullmq` + `@nestjs/bullmq` per spec |

---

## Spec acceptance criteria recheck

- [x] `pnpm lint` 0 errors
- [x] `pnpm build` succeeds
- [x] Test count ≥ 299 (got **309**, +48)
- [x] Migration runs forward + reverses (SQL inspected; ordering correct)
- [x] Env validation rejects misconfigured weights (test in `env.validation.spec.ts`)
- [x] No direct writes to `rides` outside `RidesFacade`/`RideTransitionService`
- [x] No reverse imports from `rides`/`drivers`/`location`/`geo`/`routing` to `matching`
- [x] `ride_offers` table written only by `matching`
- [x] Driver socket auth required for accept/reject
- [x] Customer can't join `driver:{id}` room (role check rejects)
- [x] BullMQ uses same Redis URL as app
- [x] `.env.example` updated with 5 new keys

---

## Open items for Task 008 author (pricing)

1. The `RouteEstimator.estimate` call inside `createOfferPayload` runs the OSRM trip estimate (pickup→destination) once per offer — **same input every retry**. Pricing will likely call OSRM again for the same coords. Consider a shared per-ride memoized estimate, or pass `tripDistanceMeters`/`tripDurationSeconds` from offer payload through to ride record.
2. Domain event `ride.offer.accepted` carries `{ offerId, rideId, driverUserId, status }`. Pricing can subscribe to compute fare at accept time. Add `confidence` to payload if pricing wants to differ surge by route confidence.
3. `confidence: "low"` adds `+0.1` penalty in matching score. Pricing might want a similar policy — refuse surge for low-confidence routes? Document the decision next task.

## Open items for Task 010 author (admin)

1. `MatchingFacade.findOfferForDriver` already exists — admin can use it to inspect a driver's current offer. Add a GET endpoint.
2. The driver client cannot re-fetch an active offer on reconnect today (out of scope for Task 007). When customer-facing WS lands, add a "get my active offer" REST endpoint for driver reconnect recovery.

---

## Closing

Task 007 hoàn thành đủ chất lượng để move sang Task 008 (Pricing/Surge). SI-1 (accept race ack semantics) đáng fix trước khi có frontend, nhưng không block thesis architecture. SI-2 và SI-3 là pure code quality.

**Status:** ✅ PASS WITH FIXES — 309 tests, lint clean, build clean, 0 blockers, 3 SI + 4 NTH, hard rules all green.
