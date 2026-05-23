# Task 006: OSRM Route Estimate

## Task Name

Implement an OSRM-backed route estimation service with haversine fallback when OSRM is unavailable.

## Goal

Add a `routing` module exposing a single internal facade — `RouteEstimator.estimate({ pickup, destination })` — that returns distance (m), duration (s), encoded polyline, and a confidence flag. Use OSRM `/route/v1` as primary source; fall back to a haversine-based estimate marked `confidence: "low"` when OSRM is unreachable, times out, or returns no route. This is the routing primitive Task 007 (matching) and Task 008 (pricing) consume — neither task should call OSRM directly.

## Context

- Task 004 added a haversine helper at `location/jump/haversine.ts` — reuse it; do **not** duplicate.
- Task 005 introduced the `geo` module (pure H3 + Redis). `routing` is a separate module: `geo` is "where are drivers", `routing` is "how far/long between two points". They will be composed by Task 007 matching, not by each other.
- ARCHITECTURE locks:
  - `routing` is a leaf module — imports nothing from `rides`, `drivers`, `location`, or `geo` at runtime. Other modules consume it via `RouteEstimator` facade only.
  - No PostgreSQL ownership. No Redis ownership in this task. No cache layer (deferred — see Out of Scope).
  - All outbound HTTP must go through a single `OsrmHttpClient` so retries/timeouts/logging are one place to read.
- Decisions locked with user before this spec was written:
  - **OSRM hosting** = configurable URL. Env `OSRM_BASE_URL` defaults to `http://osrm:5000`. Docker-compose gains an **optional** `osrm` service (commented or behind a profile) — the backend MUST NOT crash if OSRM is unreachable on boot.
  - **Fallback** = haversine + road-factor + city speed constant, returned with `confidence: "low"`. Never throw on OSRM failure; the failure path is the fallback path.
  - **Polyline** = encoded polyline string (`polyline5`, OSRM default). DTO exposes `polyline: string | null` + `polylineFormat: "polyline5" | null`. Fallback path returns `null` for both — straight-line polyline is misleading.
  - **Cache** = none in this task. Defer to Task 008 (pricing cache) or Task 007 (matching offer cache) where caching policy lives closer to the consumer.

## Scope

### Infrastructure
- Add dependency `undici` (already transitively present via Node 20+, but pin explicitly in `package.json` for the OSRM client) **OR** use the built-in `globalThis.fetch` with `AbortController`. **DECISION: built-in `fetch` + `AbortController`** — Node 20 stable, no new dep.
- Add 4 env vars to `config/env.validation.ts`:
  - `OSRM_BASE_URL` — string, default `http://osrm:5000`. Must be a valid http(s) URL.
  - `OSRM_TIMEOUT_MS` — positive int, default `1500`, range `[100, 30000]`.
  - `ROUTING_FALLBACK_ROAD_FACTOR` — positive number, default `1.3` (multiplier on straight-line distance), range `(1.0, 3.0]`.
  - `ROUTING_FALLBACK_CITY_SPEED_KMH` — positive int, default `30`, range `[5, 120]`. Used to derive fallback duration: `duration_s = (distance_m / 1000) / speed_kmh * 3600`.

### Light reuse (no refactor)
- Import `haversine` and `EARTH_RADIUS_METERS` from `location/jump/haversine.ts`. **Do NOT move it.** If the layering feels wrong (haversine belongs to `common/`), that refactor is a separate task — flag in PR summary, do not do it here.
- Import `isValidCoord` semantics from `geo/h3.service.ts` is **not allowed** (cross-module import direction wrong). Inline coordinate validation in `routing` instead — it's 6 lines.

### `routing` module (NEW)
- `routing.constants.ts` — `OSRM_PROFILE = "driving"`, `POLYLINE_FORMAT_V5 = "polyline5"`, `CONFIDENCE_HIGH = "high"`, `CONFIDENCE_LOW = "low"`.
- `routing.types.ts` — DTOs:
  ```typescript
  export type RouteConfidence = "high" | "low";
  export type PolylineFormat = "polyline5";
  export interface RouteCoordinate { lat: number; lng: number; }
  export interface RouteEstimate {
    distanceMeters: number;          // always positive integer
    durationSeconds: number;         // always positive integer
    polyline: string | null;         // null on fallback
    polylineFormat: PolylineFormat | null;
    confidence: RouteConfidence;
    source: "osrm" | "fallback";
  }
  export class InvalidRouteCoordinateError extends Error {}
  ```
- `osrm/osrm.client.ts` — Thin HTTP client. **Single method**:
  ```typescript
  fetchRoute(pickup: RouteCoordinate, destination: RouteCoordinate): Promise<OsrmRouteResponse | null>
  ```
  - Build URL: `${baseUrl}/route/v1/driving/${pickup.lng},${pickup.lat};${destination.lng},${destination.lat}?overview=full&geometries=polyline&alternatives=false&steps=false`
  - Apply timeout via `AbortController` with `signal` passed to `fetch`.
  - Return `null` on **any** failure path: network error, non-2xx response, JSON parse error, `code !== "Ok"`, empty `routes[]`. Log structured warn with `{ event, errorName }`. **Never throw** to caller.
  - Return parsed `{ distance, duration, geometry }` (matching OSRM fields) on success.
- `osrm/osrm-response.types.ts` — Type-only file mirroring the OSRM v1 response shape (just the fields we read).
- `route-estimator.ts` — The facade. Contains the orchestration:
  1. Validate both coordinates via inline `isValidCoord`. Throw `InvalidRouteCoordinateError` on bad input (this IS a programmer error — coords reach `routing` after Task 005 listener validation).
  2. Reject identical pickup == destination (same lat AND same lng) by returning a zero-distance estimate with `confidence: "high"`, `source: "osrm"` is wrong here — use `source: "fallback"`. **DECISION: return a zero estimate directly without calling OSRM.** `{ distanceMeters: 0, durationSeconds: 0, polyline: null, polylineFormat: null, confidence: "high", source: "fallback" }`. Mark `confidence: "high"` because zero is exact.
  3. Call `osrmClient.fetchRoute(pickup, destination)`. If non-null → map to `RouteEstimate` with `confidence: "high"`, `source: "osrm"`, round distance/duration to integers.
  4. If null → compute fallback via `haversineFallback(pickup, destination, roadFactor, citySpeedKmh)` returning `confidence: "low"`, `source: "fallback"`, `polyline: null`.
- `routing.module.ts` — Providers: `OsrmClient`, `RouteEstimator`. Export `RouteEstimator` only.

### Tests (Codex writes alongside implementation)
- `osrm/osrm.client.spec.ts` — mock `global.fetch`:
  - Successful 200 + `code: "Ok"` + `routes[0]` → returns parsed
  - 200 + `code: "NoRoute"` → returns null + warns
  - 200 + `routes: []` → returns null
  - 4xx response → returns null
  - 5xx response → returns null
  - Network error (fetch throws) → returns null
  - Timeout (AbortError after `OSRM_TIMEOUT_MS`) → returns null + warns with `event: "routing.osrm.timeout"`
  - URL build: lng before lat in path, semicolon separator (assert exact path)
- `route-estimator.spec.ts`:
  - Happy path: OSRM returns route → `RouteEstimate { source: "osrm", confidence: "high", polylineFormat: "polyline5" }`
  - Fallback: OSRM client returns null → haversine math applied with config road-factor + speed → assert distance ≈ haversine*1.3, duration matches speed formula, `polyline: null`, `confidence: "low"`
  - Identical coords → zero estimate without calling OSRM (assert `osrmClient.fetchRoute` not called)
  - Invalid pickup coord → throws `InvalidRouteCoordinateError`
  - Invalid destination coord → throws `InvalidRouteCoordinateError`
  - Rounding: distance/duration always integers in output
- `env.validation.spec.ts` — +4 tests for the new env keys (range + type)

## Out of Scope

- **OSRM Table API** (multi-driver distance matrix) — Task 007 may add this; do not pre-build.
- **Caching** (Redis or in-memory) — explicit deferral, see Context.
- **Matching score / driver ranking** — Task 007.
- **Pricing formula / surge** — Task 008.
- **Route persistence** (saving estimates to a `ride_routes` table or similar) — no DB writes in this task.
- **Public REST endpoint** exposing route estimation — `routing` is internal-only. Frontend/Admin endpoint is Task 010 if needed.
- **WebSocket events** — none.
- **Polyline decoding to GeoJSON** — leave the encoded string opaque; frontend (Task ≥010) decodes.
- **Frontend map rendering** — not a backend concern.
- **Docker-compose OSRM image map-data preparation** — document the optional service with a comment block; do not bake the map. Concretely: add `# osrm: ...` commented service in `docker-compose.yml` with a comment block pointing to OSRM docs. Backend reads `OSRM_BASE_URL` and degrades to fallback if unreachable, so dev can run without OSRM.
- **Retries** on OSRM failure — single attempt + fallback. Retry policy belongs to the consuming service if needed.
- **Refactor of `haversine.ts` location** — flagged for future, not in this task.

## Expected Files/Modules

```
apps/backend/src/
  routing/
    routing.constants.ts
    routing.types.ts
    osrm/
      osrm.client.ts
      osrm.client.spec.ts
      osrm-response.types.ts
    route-estimator.ts
    route-estimator.spec.ts
    routing.module.ts
  config/
    env.validation.ts                 # +4 keys
    env.validation.spec.ts            # +4 tests
  app.module.ts                       # import RoutingModule
docker-compose.yml                    # commented osrm service block
.env.example                          # +4 keys with defaults
```

## Functional Requirements

### Estimation
- `RouteEstimator.estimate({ pickup, destination })` MUST return a `RouteEstimate` for any valid coordinate pair.
- On OSRM success: `source: "osrm"`, `confidence: "high"`, `polyline: <encoded>`, `polylineFormat: "polyline5"`, distance and duration from OSRM rounded to integers.
- On OSRM failure (timeout, non-2xx, network error, no-route, parse error): `source: "fallback"`, `confidence: "low"`, `polyline: null`, `polylineFormat: null`, distance = `round(haversine * ROUTING_FALLBACK_ROAD_FACTOR)`, duration = `round(distance_km / city_speed_kmh * 3600)`.
- Identical pickup and destination (lat AND lng exactly equal) returns zero estimate without calling OSRM.

### Client behavior
- The OSRM client MUST apply `OSRM_TIMEOUT_MS` via `AbortController`.
- The OSRM client MUST log structured warn on every failure path with `event` + `errorName` + `osrmCode` (when available). No raw response bodies in logs.
- The OSRM client MUST NOT throw — failures map to `null` return.

### Validation
- Coordinate validation: `Number.isFinite(lat) && lat ∈ [-90, 90] && Number.isFinite(lng) && lng ∈ [-180, 180]`. Reject otherwise with `InvalidRouteCoordinateError`.
- Identical-point detection uses strict equality on both lat and lng. Sub-meter-precision noise is not normalized — caller's responsibility.

## Security Requirements

- `OSRM_BASE_URL` MUST come from validated env, never from request payload or DB. Validate it's a parsable `URL` whose protocol is `http:` or `https:` in env validation.
- Do NOT include any user identifier, ride ID, or device info in the OSRM request. The OSRM URL contains only coordinates.
- Do NOT expose raw OSRM response bodies, error messages, or stack traces to upstream callers. The `RouteEstimate` DTO is the only outward surface.
- Log fields ARE allowed: `osrmCode`, HTTP status, `errorName`. Log fields NOT allowed: full URL with coords (lat/lng are sensitive at user precision), response body, request id from OSRM.
- Coordinate validation runs BEFORE building the URL — prevents URL-injection via odd numeric strings if upstream ever fails type-checking.
- If `OSRM_BASE_URL` is malformed at startup, env validation MUST fail fast (do not boot with a broken default).

## Database Requirements

- No PostgreSQL migration.
- No Redis usage in this task.
- No persistence of estimates. Each call is fresh.

## API/WebSocket Changes

None public. Internal facade only:

```typescript
class RouteEstimator {
  estimate(input: { pickup: RouteCoordinate; destination: RouteCoordinate }): Promise<RouteEstimate>;
}
```

Consumers (later tasks) inject `RouteEstimator` directly. No HTTP, no WebSocket, no event emission.

## Business Rules

- Server is the sole source of distance/duration estimates. Client-provided distance or duration MUST NOT be trusted for pricing or matching (this is a Task 008/007 enforcement; Task 006 enforces by being internal-only).
- Fallback estimates MUST be marked `confidence: "low"` so pricing (Task 008) can apply a fallback policy (e.g. wider tolerance band, refuse surge multiplier).
- Zero-distance estimates (same pickup == destination) MUST NOT be charged distance fare downstream — but that is pricing's job. Routing returns `0, 0, high`.
- Polyline is decorative for clients; routing decisions must work even with `polyline: null`.

## Edge Cases

- Pickup `(0, 0)` → valid coords (in the ocean, but coord-valid) → OSRM will return NoRoute → fallback.
- Pickup at pole (lat = 90) → coord-valid; OSRM may NoRoute → fallback.
- Cross-antimeridian route (e.g. lng=179 to lng=-179) → OSRM handles; if not, fallback haversine is still correct (haversine handles wraparound).
- Very large distance (e.g. HCMC to NYC) → fallback math is meaningless but won't crash. **DECISION: do NOT bound distance.** Caller decides what to do with absurd values. Document in PR.
- OSRM returns `routes[]` with `distance: 0` and `duration: 0` for identical coords (some OSRM builds do this) — accept and pass through as `confidence: "high"`, source `"osrm"`.
- OSRM returns negative distance (malformed) — reject as failure, fall back. Inline guard `if (route.distance < 0 || route.duration < 0) return null`.
- Timeout firing AFTER successful response parse — `AbortController` is wired to the fetch only, parsing is fast and synchronous-ish. Acceptable, no special handling.
- Fetch rejection with `AbortError` MUST be distinguished from generic network error in logs: `event: "routing.osrm.timeout"` vs `event: "routing.osrm.network_error"`.
- Service starts before OSRM is up → first call lands during the window where OSRM is unreachable → fallback returned. No retry. Boot MUST NOT be blocked on OSRM health.

## Tests Required

See "Scope > Tests" above. Test count target: **+24 to +28** new tests. Final count: 237 → **~262**.

- All paths in `osrm.client.spec.ts` use `jest.spyOn(global, "fetch")` or a fetch mock helper. Do NOT use `nock` or other deps.
- `route-estimator.spec.ts` mocks `OsrmClient` directly.
- `env.validation.spec.ts` follows the existing pattern for the 4 new keys.
- Build + lint MUST be clean before claiming completion.

## Acceptance Criteria

- [ ] `pnpm --filter backend lint` returns 0 errors.
- [ ] `pnpm --filter backend build` succeeds.
- [ ] `pnpm --filter backend test` shows all tests passing, count ≥ 261 (237 baseline + ~24).
- [ ] New env keys appear in `.env.example` with documented defaults.
- [ ] Docker-compose has a commented `osrm:` service block (NOT an active service) with a one-line comment pointing to OSRM map-data prep docs.
- [ ] `RouteEstimator` is the only exported provider from `RoutingModule`.
- [ ] No new imports from `rides`, `drivers`, `location`, `geo` in `routing/*`. (Importing `haversine` from `location/jump/haversine.ts` is allowed — explicit exception, documented in PR.)
- [ ] No new public REST endpoint, no WebSocket event, no DB migration.
- [ ] PR summary documents: (a) the haversine import exception, (b) timeout default rationale, (c) fallback formula constants.

## Prompt for Codex

Implement Task 006 only. Build a NestJS `routing` module exposing a single `RouteEstimator.estimate({ pickup, destination })` facade that returns `{ distanceMeters, durationSeconds, polyline, polylineFormat, confidence, source }`.

Primary path: call OSRM `/route/v1/driving/{lng,lat};{lng,lat}?overview=full&geometries=polyline&alternatives=false&steps=false` via built-in `fetch` with `AbortController` timeout from env `OSRM_TIMEOUT_MS`. On success → `confidence: "high"`, `source: "osrm"`, encoded polyline.

Fallback path (OSRM unreachable, timeout, non-2xx, code !== "Ok", empty routes, parse error): use `haversine` from `location/jump/haversine.ts` multiplied by env `ROUTING_FALLBACK_ROAD_FACTOR` for distance; derive duration from env `ROUTING_FALLBACK_CITY_SPEED_KMH`. Return `confidence: "low"`, `source: "fallback"`, `polyline: null`. Never throw on OSRM failure.

Identical coordinates: zero estimate without calling OSRM, `confidence: "high"`, `source: "fallback"`.

Validate lat/lng ranges inline (do NOT import from `geo`). Throw `InvalidRouteCoordinateError` on bad coords.

Add 4 env vars (`OSRM_BASE_URL`, `OSRM_TIMEOUT_MS`, `ROUTING_FALLBACK_ROAD_FACTOR`, `ROUTING_FALLBACK_CITY_SPEED_KMH`) with validation + tests. Add commented `osrm:` service block to `docker-compose.yml`. Update `.env.example`.

No cache, no retries, no public REST/WS, no DB migration, no refactor of `haversine.ts`. Do not touch `rides`, `drivers`, `location` (except importing haversine), `geo`, or `auth`.

Write tests per the "Tests Required" section. Target: 237 → ~262 tests. Lint clean, build clean, tests green.

Finish with: **Summary**, **Changed files** (categorized: new / modified / docs), **Tests run** (count delta), **Notes/Risks** (call out: haversine import exception, why no cache, OSRM timeout default rationale, any deviations from this spec).
