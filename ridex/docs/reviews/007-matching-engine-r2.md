# Review: Task 007 — Matching Engine (Round 2 / Follow-up)

**Task file:** `docs/tasks/007-matching-engine.md`
**Implementer:** Claude (3 SI fixes applied directly; Codex on standby for Task 008)
**Reviewer:** Claude
**Date:** 2026-05-17

---

## Verdict: **PASS**

R1 đã PASS WITH FIXES với 3 should-improve (SI-1, SI-2, SI-3). R2 này dọn cả 3 trực tiếp trong code base. Lint + build + matching test suite vẫn xanh (43 tests trong scope `matching/`, không regression).

```
pnpm --filter backend lint:                clean
pnpm --filter backend build:               clean
pnpm test --testPathPattern=matching:      8 suites, 43 tests passed
```

---

## Fixes applied

### F1 — SI-1: Accept race ack semantics

**File:** `apps/backend/src/matching/offer/offer-orchestrator.service.ts:94-128` (`handleAccept`).

**Before:** Nếu `ridesFacade.assignDriver` throw (vì customer vừa cancel), orchestrator compensate offer sang `CANCELLED`, emit WS, rồi `return` bình thường. Gateway ACK `ok: true` cho driver vài ms trước khi driver socket nhận `ride.offer.cancelled`. Flash UX.

**After:** Sau khi compensate + emit cancel WS, throw `OfferNotOfferableError(offerId)`. Gateway ACK handler đã sẵn map error này thành `ok: false` → driver UI hiển thị error trực tiếp, không còn "Accepted!" rồi rút lại.

```ts
} catch (error: unknown) {
  await this.offerRepository.transitionOfferStatus(
    offer.id, OfferStatus.ACCEPTED, OfferStatus.CANCELLED
  );
  this.emitOfferCancelled(offer, "RIDE_CANCELLED");
  this.logger.warn({ event: "matching.offer.accept_ride_transition_failed", ... }, CONTEXT);
  throw new OfferNotOfferableError(offerId);  // ← new
}
```

**Test updated:** `"cancels an accepted offer if ride assignment fails"` đổi thành `"cancels an accepted offer and rejects the ack if ride assignment fails"`, dùng `rejects.toThrow(OfferNotOfferableError)` thay vì await và assert side-effects only. Compensation behavior (transition + WS) vẫn được assert đầy đủ.

### F2 — SI-2: Phân biệt `no_candidates` vs `timeout_scheduling_failed`

**File:** `apps/backend/src/matching/offer/offer-orchestrator.service.ts:166-269`.

**Before:** `offerCandidate` return `boolean`. Khi cả Redis insert lẫn BullMQ enqueue cùng fail, loop kết thúc → `noDriversFound(rideId, "no_candidates")`. Analytics conflate "không có tài xế" với "Redis/BullMQ down".

**After:**
- `offerCandidate` đổi signature → trả về union `"offered" | "insert_failed" | "enqueue_failed"`.
- `tryNextCandidate` track flag `anyEnqueueFailed`. Khi loop kết thúc mà không offer được, chọn reason:
  - `"timeout_scheduling_failed"` nếu có ít nhất 1 candidate fail ở bước enqueue (infra issue).
  - `"no_candidates"` nếu chỉ insert fail hoặc 0 candidate được chọn (business reason).
- Reason vẫn được truyền qua `ridesFacade.markNoDriversFound(rideId, reason)` và event `ride.matching.no-drivers` payload, nên downstream (Task 008 pricing, Task 010 admin) có signal để alert hạ tầng riêng nếu cần.

**Test thêm:** `"reports timeout_scheduling_failed when every candidate fails to enqueue"` — mock `timeoutQueue.enqueue` throw, assert `markNoDriversFound` được gọi với reason mới.

Lưu ý: chưa emit event riêng `ride.matching.infra_failed` — reason field đủ cho thesis scope. Nếu sau này muốn route alerting riêng, chỉ cần thêm event mới trong `noDriversFound`.

### F3 — SI-3: Dọn dead branch trong scoring

**File:** `apps/backend/src/matching/candidates/candidate-scoring.service.ts:17-32`.

Xóa branch `if (input.distanceMeters === 0 && input.durationSeconds === 0)`. Công thức chung `weights * 0/N + penalty` cho cùng kết quả. Test `"returns zero for zero distance and duration with high confidence"` vẫn pass (now relies on general formula).

```ts
score(input, weights): number {
  const normalizedDistance = input.distanceMeters / DISTANCE_NORMALIZATION_METERS;
  const normalizedEta = input.durationSeconds / ETA_NORMALIZATION_SECONDS;
  const confidencePenalty = input.confidence === "low" ? LOW_CONFIDENCE_SCORE_PENALTY : 0;
  return weights.distanceWeight * normalizedDistance
       + weights.etaWeight * normalizedEta
       + confidencePenalty;
}
```

---

## Carry-over for next tasks

NTH-1..4 từ R1 (shared default namespace, deep import Ack, repo spec mocks TypeORM, log detail khi assignDriver fail) **không fix** ở R2 này — vẫn là nice-to-have, không block Task 008. NTH-1 (shared namespace) đáng tách thành task vệ sinh riêng khi customer-WS xuất hiện.

Open items cho Task 008 (đã liệt kê trong R1, vẫn còn nguyên):

1. `RouteEstimator.estimate` chạy 2 lần cho cùng coords pickup→destination (matching + pricing). Cân nhắc memoize per-ride trong `RouteEstimator` hoặc persist vào ride record.
2. Domain event `ride.offer.accepted` thiếu `confidence`. Nếu pricing muốn refuse surge khi low-confidence, cần extend payload.
3. Reason taxonomy: bây giờ `markNoDriversFound` accept `"exhausted" | "no_candidates" | "timeout_scheduling_failed"`. Nên enum hóa khi Task 010 (admin) hiển thị reason.

---

## Status

✅ **PASS** — 3 SI từ R1 đã fix, lint + build + matching tests xanh, không phát sinh blocker mới. Sẵn sàng cho Task 008 (Pricing/Surge).
