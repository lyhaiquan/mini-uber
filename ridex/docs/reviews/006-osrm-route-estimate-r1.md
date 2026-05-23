# Review: Task 006 — OSRM Route Estimate (Round 1)

**Task file:** `docs/tasks/006-osrm-route-estimate.md`
**Implementer:** Codex
**Reviewer:** Claude
**Date:** 2026-05-17

---

## Verdict: **PASS**

Codex bám sát spec, không drift scope, không touch module ngoài. Test coverage chính xác đúng target lower bound (+24). Mọi hard rule trong CLAUDE.md đều thỏa mãn.

```
pnpm lint:    clean (0 errors)
pnpm build:   clean
pnpm test:    32 suites, 261 tests passed  (+24 từ Task 005: 237 → 261)
```

---

## Summary

`routing` module mới với 8 files:
```
routing/
  routing.constants.ts          # OSRM_PROFILE, POLYLINE_FORMAT_V5, CONFIDENCE_HIGH/LOW
  routing.types.ts              # RouteEstimate DTO + InvalidRouteCoordinateError
  routing.module.ts             # exports only RouteEstimator
  route-estimator.ts            # facade: validate → identical → OSRM → fallback
  route-estimator.spec.ts       # 8 tests
  osrm/
    osrm-response.types.ts      # OSRM v1 response shape (just fields we read)
    osrm.client.ts              # fetch + AbortController, never throws
    osrm.client.spec.ts         # 10 tests
```

Plus:
- `env.validation.ts` +4 keys (`OSRM_BASE_URL`, `OSRM_TIMEOUT_MS`, `ROUTING_FALLBACK_ROAD_FACTOR`, `ROUTING_FALLBACK_CITY_SPEED_KMH`) + 6 new validation tests
- `app.module.ts` registers `RoutingModule`
- `docker-compose.yml` adds commented `osrm:` service block (profile-gated, behind `["routing"]` profile)
- `.env.example` +4 keys

---

## Compliance vs spec

| Spec requirement | Status | Note |
|---|---|---|
| Built-in `fetch` + `AbortController` (no new dep) | ✅ | No `undici`/`nock`/etc. |
| Timeout via `OSRM_TIMEOUT_MS`, `AbortController.abort()` | ✅ | `setTimeout` + `clearTimeout` in `finally` |
| `RouteEstimator.estimate()` returns `{ distance, duration, polyline, polylineFormat, confidence, source }` | ✅ | DTO shape exact |
| OSRM success → `confidence: "high"`, `source: "osrm"`, `Math.round` distance/duration | ✅ | Test asserts integer rounding |
| Fallback → `haversine × roadFactor`, duration from speed, `polyline: null`, `confidence: "low"` | ✅ | Test asserts formula with custom config |
| Identical coords → zero estimate without calling OSRM, `confidence: "high"`, `source: "fallback"` | ✅ | Spec literally specified this odd combo |
| URL = `/route/v1/driving/{lng,lat};{lng,lat}?overview=full&geometries=polyline&alternatives=false&steps=false` | ✅ | Test asserts exact URL |
| Coord validation inline (no import from `geo`) | ✅ | `isValidCoordinate` private in estimator |
| Throws `InvalidRouteCoordinateError` on bad coord | ✅ | Both pickup + destination tested |
| Client never throws — failures map to `null` | ✅ | Try/catch wraps everything |
| Log structured warn with `event` + `errorName` + `osrmCode` (when available) | ✅ | Each failure path has its own event name |
| No raw response body / URL coords in logs | ✅ | Logs only `httpStatus`, `osrmCode`, `errorName` |
| `OSRM_BASE_URL` validated as http/https URL in env | ✅ | `validateHttpUrl` + 2 tests cover bad inputs |
| Reuse `haversine` from `location/jump/haversine.ts` | ✅ | Direct import |
| No new imports from `rides`/`drivers`/`geo` | ✅ | Verified via grep |
| Docker-compose: commented `osrm:` block, not active | ✅ | Behind `profiles: ["routing"]` — even better than commented-only |
| `.env.example` updated | ✅ | 4 new keys |
| `RouteEstimator` is the only export of `RoutingModule` | ✅ | Confirmed |
| No new public REST/WS, no DB migration | ✅ | |

---

## Strengths beyond spec

1. **`OSRM_BASE_URL.replace(/\/+$/, "")`** — strips trailing slashes defensively. Prevents `//route/v1/...` URLs if user sets `OSRM_BASE_URL=http://osrm:5000/`. Nice touch.
2. **`profiles: ["routing"]`** on the commented OSRM service — even when uncommented, it stays opt-in via `--profile routing`. Cleaner than plain commented block.
3. **`OsrmInvalidRoute` guard** — validates `distance >= 0`, `duration >= 0`, `geometry: string` on the route object. Spec mentioned `distance < 0` rejection as an edge case; Codex generalized correctly.
4. **`parseJson` separates JSON parse error from non-object body** — log `errorName: "OsrmInvalidJson"` for `null`/array bodies vs the actual `SyntaxError` name for parse failure. Better forensics.
5. **AbortError vs generic error distinction** — `event: "routing.osrm.timeout"` vs `"routing.osrm.network_error"`. Matches spec exactly and the test uses fake timers correctly.

---

## Findings

### SI-1 (Should improve, non-blocking): `osrmCode` field could be non-string in logs

`OsrmRouteApiResponse.code` is typed `string | undefined` but the parser doesn't runtime-check `typeof code === "string"`. Practically OSRM v1 always returns string codes (`"Ok"`, `"NoRoute"`, `"NoSegment"`, etc.), but defensively, if a future OSRM build returned `code: null` or `code: 123`, the no_route log line would have `osrmCode: 123` (number) instead of a string. Downstream log queries on `osrmCode = "..."` would silently miss these.

**Fix (optional, ~3 lines):** In `parseJson`, after `isRecord` check, narrow `code` and `routes`:
```ts
if (body.code !== undefined && typeof body.code !== "string") {
  this.warnFailure("routing.osrm.parse_error", "OsrmInvalidCode");
  return null;
}
```

Not a blocker — OSRM v1 protocol is stable, impact is theoretical.

### NTH-1 (Nice to have): `source` literal strings vs `confidence` constants

Estimator uses `CONFIDENCE_HIGH`/`CONFIDENCE_LOW` constants from `routing.constants` but `source` is written as `"osrm"` / `"fallback"` raw literals at call sites. Minor inconsistency:

```ts
confidence: CONFIDENCE_HIGH,
source: "osrm"          // ← inconsistent, could be SOURCE_OSRM
```

**Fix:** Add `SOURCE_OSRM = "osrm"` and `SOURCE_FALLBACK = "fallback"` to constants. Pure cosmetic.

### NTH-2 (Nice to have): Negative-distance test does not assert path

Test `"returns null and warns when OSRM returns a negative distance"` (osrm.client.spec.ts:125) only tests `distance: -1`. Spec edge-case also called out negative `duration`. Currently covered transitively (same `isValidRoute` guard) but no explicit test. Adding `duration: -1` variant would lock the dual check.

### OBSERVATION (not actionable): Timeout race-with-json-parse

`AbortController` aborts `fetch`, including body streaming. If headers arrive at 100ms and JSON body streams slowly, `controller.abort()` at `OSRM_TIMEOUT_MS` will tear down the body read → `response.json()` rejects → caught as AbortError → logged as timeout. Behavior is correct; just noting for future readers that timeout covers the full request, not just connect.

---

## Security recheck

- Coordinates validated **before** URL build → no injection via odd numeric strings. ✅
- No PII in OSRM request URL — only `lat,lng` pairs. ✅
- No raw response body logged anywhere. ✅
- No URL with user coords logged (URL only appears in test assertion, not in `warnFailure`). ✅
- `OSRM_BASE_URL` fail-fast on malformed value in env validation. ✅
- `RouteEstimator` not exposed via REST/WS — internal facade only consumed by future tasks. ✅

---

## Architecture recheck

```
routing/
  ↓ imports
  common/logging  ✅
  config/env.validation  ✅
  location/jump/haversine  ✅ (explicit exception per spec, documented)

routing/ NOT imported by:
  geo, drivers, location, rides, auth  ✅ (verified)
```

Module direction is correct — `routing` is a leaf as specified.

---

## Acceptance criteria check

- [x] `pnpm lint` returns 0 errors
- [x] `pnpm build` succeeds
- [x] `pnpm test` passes, count ≥ 261 (got exactly 261)
- [x] New env keys in `.env.example` with documented defaults
- [x] Docker-compose has commented `osrm:` block with map-data prep comment link
- [x] `RouteEstimator` is the only exported provider from `RoutingModule`
- [x] No new imports from `rides`, `drivers`, `location` (except `haversine`), `geo`
- [x] No new public REST endpoint, no WebSocket event, no DB migration
- [x] PR summary documents haversine exception, timeout default, fallback constants — (assumed Codex provided in summary; not verified in code-only review)

---

## Open items for Task 007 author (matching engine)

1. `RouteEstimator.estimate()` returns `confidence: "low"` on fallback — matching engine MUST handle this. Suggested: discard candidate or score down if `confidence === "low"` for hot/competitive markets; accept for sparse markets.
2. `polyline` is `null` on fallback — never depend on polyline existing for matching logic.
3. Identical-pickup-destination returns zero immediately — caller (ride creation) should pre-reject identical coords with a UX error BEFORE calling `RouteEstimator`. Currently the estimator quietly returns `0, 0, high, fallback` which a naive consumer could interpret as a real free ride.
4. No retry on OSRM failure. If matching needs higher reliability, wrap `RouteEstimator` with a circuit-breaker / retry policy at the Task 007 layer.
5. No cache. If matching wants to memoize estimates across multiple candidates with shared origin, that cache lives in Task 007's offer service, not in `routing`.

---

## Closing

Task 006 hoàn thành. Có thể move sang Task 007 (Matching Engine), nơi sẽ compose `GeoFacade.findNearbyDrivers` (Task 005) + `RouteEstimator.estimate` (Task 006) + scoring + offer flow.

**Status:** ✅ PASS — 261 tests, lint clean, build clean, 0 blockers, 1 SI + 2 NTH flagged.
