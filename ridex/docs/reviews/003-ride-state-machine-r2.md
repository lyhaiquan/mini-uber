# Review: Task 003 — Ride State Machine (Round 2)

**Task file:** `docs/tasks/003-ride-state-machine.md`
**Round 1 review:** `docs/reviews/003-ride-state-machine-r1.md`
**Codex feedback:** received 2026-05-15 (3 findings — all functional/contract misses)
**Implementer:** Claude (applying Codex's fixes)
**Date:** 2026-05-15

---

## Verdict: **PASS** (all 3 Codex findings addressed)

Cả 3 finding của Codex đều đúng — đó là contract misses thật, không phải false positive. Sau khi sửa, tests tăng từ 122 → 128, lint clean, build clean.

---

## Codex Findings & Resolution

### Finding #1 — `RidesFacade.getRideForMatching()` không enforce matching-eligible state contract

**Codex's call:** Spec said "throws if not in a matching-eligible state", implementation chỉ check existence. Cũng thiếu `findActiveRideForCustomer()`.

**Confirmed:** Đúng. Đây là contract miss. Implementation gốc:

```typescript
async getRideForMatching(rideId: string): Promise<RideSummaryDto> {
  const ride = await this.ridesService.findById(rideId);
  if (ride === null) throw new RideNotFoundError();
  return rideToSummaryDto(ride);  // <-- no state guard
}
```

→ Matching engine có thể consume terminal/assigned ride mà không có guard.

**Fix applied:**

1. Thêm `MATCHING_ELIGIBLE_STATUSES = [REQUESTED, MATCHING]` constant + `isMatchingEligible()` helper trong `enums/ride-status.enum.ts`.
2. Thêm `RideNotMatchingEligibleError` (`code: "RIDE_NOT_MATCHING_ELIGIBLE"`, HTTP 409) trong `errors/ride-errors.ts`.
3. `RidesFacade.getRideForMatching()` giờ check state sau khi check existence:

```typescript
async getRideForMatching(rideId: string): Promise<RideSummaryDto> {
  const ride = await this.ridesService.findById(rideId);
  if (ride === null) throw new RideNotFoundError();
  if (!isMatchingEligible(ride.status)) {
    throw new RideNotMatchingEligibleError(ride.status);
  }
  return rideToSummaryDto(ride);
}
```

4. Thêm `RidesService.findActiveByCustomer(customerId)` — query với `ACTIVE_RIDE_STATUSES = [REQUESTED, MATCHING, ACCEPTED, DRIVER_ARRIVED, IN_PROGRESS]`, order by `created_at DESC` (lấy most recent active).
5. Thêm `RidesFacade.findActiveRideForCustomer(customerId): Promise<RideSummaryDto | null>` — wrapper trả DTO.

**Files changed:**
- `src/rides/enums/ride-status.enum.ts` — add `ACTIVE_RIDE_STATUSES`, `MATCHING_ELIGIBLE_STATUSES`, `isMatchingEligible()`
- `src/rides/errors/ride-errors.ts` — add `RideNotMatchingEligibleError`
- `src/rides/rides.service.ts` — add `findActiveByCustomer()`
- `src/rides/rides.facade.ts` — refactor `getRideForMatching` + add `findActiveRideForCustomer`

---

### Finding #2 — Controller `toStatus=REQUESTED` raise 400 BadRequest thay vì để state machine raise 409 `RIDE_INVALID_STATE`

**Codex's call:** Wrong HTTP status. Spec lock taxonomy `409 RIDE_INVALID_STATE` cho mọi transition không có trong map. Controller không nên short-circuit.

**Confirmed:** Đúng. Implementation gốc có short-circuit này:

```typescript
if (dto.toStatus === RideStatus.REQUESTED) {
  throw new BadRequestException({ code: "RIDE_INVALID_STATE", ... });
}
```

→ Client nhận 400 thay vì 409 đúng theo spec. Code field đúng nhưng HTTP status sai — phá vỡ taxonomy lock.

**Fix applied:** Bỏ hoàn toàn check này khỏi `RidesController.transitionRide`. State machine tự xử lý: `findTransitionRule(X, REQUESTED)` luôn return `undefined` (vì không rule nào có `to: REQUESTED`) → `RideInvalidTransitionError` (HTTP 409). Thêm comment giải thích quyết định KHÔNG special-case:

```typescript
// Note: REQUESTED is intentionally NOT pre-rejected here. The transition
// map has no rule whose target is REQUESTED, so the state machine itself
// will raise RIDE_INVALID_STATE (HTTP 409) — letting the spec-locked error
// taxonomy and HTTP status flow through unchanged.
```

**Files changed:**
- `src/rides/rides.controller.ts` — remove REQUESTED short-circuit, add explanatory comment

---

### Finding #3 — Optimistic version check chỉ ở app code, không có trong DB UPDATE

**Codex's call:** Spec lock defense-in-depth: `SELECT ... FOR UPDATE` **plus** `UPDATE ... WHERE id = $1 AND version = $expected` that fails với `RIDE_VERSION_CONFLICT` nếu zero rows affected. Implementation chỉ có FOR UPDATE + JS pre-check + `manager.save()` (no version filter trong WHERE).

**Confirmed:** Đúng. Đây là concurrency-contract mismatch. Implementation gốc:

```typescript
// JS pre-check
if (options.expectedVersion !== undefined && ride.version !== options.expectedVersion) {
  throw new RideVersionConflictError();
}
// ... mutate ride object ...
ride.version = ride.version + 1;
await manager.save(Ride, ride);   // <-- no WHERE clause, just save by id
```

Trong thực tế, FOR UPDATE đã serialise concurrent transactions nên không có race. Nhưng spec lock defense in depth: nếu lock missing trên một future code path, UPDATE-with-version-filter sẽ catch.

**Fix applied:** Thay `manager.save(Ride, ride)` bằng `manager.update(Ride, { id, version }, patch)` + check `affected === 1`:

```typescript
// Early fail-fast for clear client errors (UX).
if (options.expectedVersion !== undefined && ride.version !== options.expectedVersion) {
  throw new RideVersionConflictError();
}

// ... validate rule + actor ...

const fromStatus = ride.status;
const newVersion = ride.version + 1;
const patch = this.buildUpdatePatch(toStatus, actor, options);
patch.version = newVersion;

// Defense-in-depth: include `version` in the WHERE clause so the UPDATE
// itself becomes a conditional. FOR UPDATE already serialises concurrent
// transactions; this is a belt-and-suspenders check.
const updateResult = await manager.update(
  Ride,
  { id: ride.id, version: ride.version },
  patch
);

if (updateResult.affected !== 1) {
  throw new RideVersionConflictError();
}

// Reflect persisted state on in-memory ride for response/audit.
Object.assign(ride, patch);
```

**Architectural shift:** `buildUpdatePatch()` giờ trả `Partial<Ride>` thay vì mutate `ride` in place. Cleaner separation: build → atomic UPDATE → reflect on in-memory copy. Audit row được tạo SAU khi UPDATE succeed.

**3 layers of concurrency control (defense in depth):**
1. **Row lock** (FOR UPDATE) — serialise concurrent transactions tại DB layer.
2. **JS pre-check** (`expectedVersion !== ride.version`) — fail-fast UX cho client stale read.
3. **SQL UPDATE WHERE version** — catch nếu lock somehow missing OR cho operations bypass lock.

**Files changed:**
- `src/rides/ride-transition.service.ts` — refactor `transition()` body, replace `save(Ride)` với `update(Ride, {id, version}, patch)`, extract `buildUpdatePatch()` helper

---

## Test Changes

**Test mock cho `ride-transition.service.spec.ts`:**

Trước:
```typescript
save: jest.fn(async (entityClass, entity) => {
  if (entityClass === Ride) { ridesMap.set(entity.id, entity); ... }
});
```

Sau:
```typescript
update: jest.fn(async (entityClass, where, patch) => {
  if (entityClass === Ride) {
    const stored = ridesMap.get(where.id);
    if (stored === undefined) return { affected: 0, raw: [], generatedMaps: [] };
    if (stored.version !== where.version) return { affected: 0, raw: [], generatedMaps: [] };
    Object.assign(stored, patch);
    return { affected: 1, raw: [], generatedMaps: [] };
  }
  ...
}),
save: jest.fn(async (entityClass, entity) => {
  if (entityClass === RideEvent) { ... }  // only RideEvent uses save now
})
```

→ Mock giờ accurately simulate `UPDATE ... WHERE id AND version` semantics.

**Tests added/changed:**

| File | Change |
|---|---|
| `rides.facade.spec.ts` | Add 6 tests: `getRideForMatching` returns summary cho REQUESTED + MATCHING; rejects ACCEPTED + 3 terminal states; `findActiveRideForCustomer` returns summary / null |
| `rides.controller.spec.ts` | Replace "rejects REQUESTED 400" test với "passes REQUESTED through to service" |
| `ride-transition.service.spec.ts` | Update mock: `update()` thay `save(Ride)`; existing tests pass unchanged (positive matrix, version conflict, concurrent, etc.) |

---

## Verification

```
pnpm test:    16 suites, 128 tests passed  (+6 từ round 1: 122 → 128)
pnpm lint:    clean (0 errors)
pnpm build:   clean
```

Tests breakdown của rides module:
- `ride-transition.service.spec.ts`: ~46 tests (full positive matrix + negative + terminal + concurrency + version conflict)
- `rides.service.spec.ts`: 3 tests
- `rides.facade.spec.ts`: 11 tests (4 cũ + 6 mới + 1 cũ unchanged)
- `rides.controller.spec.ts`: 7 tests

---

## Note for Codex

Tất cả 3 finding của bạn đều đúng — cảm ơn catch kỹ. Đặc biệt finding #3 (version-in-UPDATE) tôi đã miss spirit của "defense in depth" trong spec — FOR UPDATE đủ ngăn race trong implementation hiện tại, nhưng spec rõ ràng lock cả 2 layer để chống regression future.

Một note nhỏ: ở finding #1, ngoài state guard cho `getRideForMatching`, tôi cũng thêm `findActiveRideForCustomer` như bạn flag. Nhưng cần lưu ý: "one active ride per customer" CONSTRAINT (DB-level partial unique index) vẫn defer cho Matching task (007) per spec section "Out of Scope". `findActiveRideForCustomer` chỉ là READ API; ENFORCEMENT khi tạo ride mới chưa có.

Pending items giữ nguyên (theo round 1):
- **MF-1:** PG enum + `enumName` chưa verify với real Postgres → cần chạy migration thật.
- **MF-2:** Audit `audit_logs` cross-cutting defer cho future audit module.
- **MF-3:** E2E HTTP tests defer.

Move on Task 004 được rồi.

---

**Reviewer signature:** Claude (architect, sửa theo Codex review)
**Status:** ✅ PASS — 3 Codex findings resolved, 128 tests passing, lint + build clean
