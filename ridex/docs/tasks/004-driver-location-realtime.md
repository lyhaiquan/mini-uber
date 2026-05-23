# Task 004: Driver Location Realtime

## Task Name

Implement authenticated realtime driver location updates with Socket.IO, Redis cache, and explicit driver online/offline state.

## Goal

Add the realtime location ingestion layer for drivers:

1. Bootstrap WebSocket (Socket.IO) infrastructure with JWT-authenticated sockets.
2. Introduce `drivers` module owning explicit online/offline state in PostgreSQL (source of truth).
3. Introduce `location` module owning the latest-location Redis cache (TTL-bounded) and GPS jump detection.
4. Emit cross-module domain events (`driver.went-online`, `driver.went-offline`, `driver.location-updated`) so future tasks (005 H3 discovery, 007 matching) can subscribe without coupling.

This task is the foundation for Tasks 005–007. Spec is intentionally exhaustive so Codex implements without ambiguity.

## Context

- ARCHITECTURE locks: `drivers` owns the `drivers` table; `location` owns the latest-location Redis cache (no persistent `driver_locations` table in this task); module dependency direction is `location → drivers`, `location → geo` (geo not used here yet); domain events flow via NestJS EventEmitter for in-process consumers.
- Previous tasks (001–003) provide: JWT access tokens, `RolesGuard`, `JwtAuthGuard`, `@CurrentUser()` decorator, ApiResponse envelope, structured logger, TypeORM migrations, env validation pipeline.
- Decisions locked with Claude (architect) before spec was finalized:
  - **Driver online state** = DB column on `drivers` table + Redis cache for fast read. DB is the source of truth.
  - **GPS jump detection** = both *speed* AND *distance* checks (defense-in-depth).
  - **Redis infra** added in this task (docker-compose + env + Nest client).

## Scope

### Infrastructure
- Add `redis:` service to `docker-compose.yml` (image `redis:7-alpine`, healthcheck, no auth in dev), and the `backend` service `depends_on: redis`.
- Add Redis env vars to `.env.example` and Docker Compose `backend.environment`.
- Add a small `infra/redis` (or equivalent) Nest module exposing a single shared Redis client built on `ioredis`. The client must be a Nest provider so it can be injected into services and mocked in tests.

### `drivers` module (NEW)
- Entity `drivers` (DB source of truth for driver-specific state). Migration required.
- `DriversService` — DB read/write for availability.
- `DriversFacade` — read API + `setOnline`/`setOffline` used by `location` and (later) `matching`.
- `DriversController` exposing the REST endpoints listed below.
- Domain event emissions on online/offline transitions.

### `location` module (NEW)
- `LocationGateway` (Socket.IO) — JWT-authenticated.
- `DriverLocationDto` (validated payload).
- `DriverLocationCacheService` — Redis abstraction for the latest-location key.
- `GpsJumpDetectionService` (pure compute helper, no I/O).
- Domain event emission on accepted location update.

### Dependencies (add to `apps/backend/package.json`)
- `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io` (server).
- `ioredis`.
- `@nestjs/event-emitter` (in-process domain event bus, per ARCHITECTURE).

### Tests
- Unit tests for: cache service, jump detection helper, drivers service/facade, drivers controller, gateway (auth, role, payload, online check, jump rejection, identity spoofing).
- No E2E HTTP/WS test infrastructure is required, but gateway unit tests must exercise the actual `LocationGateway` instance with mocked `JwtService`, `DriversFacade`, `DriverLocationCacheService`, `GpsJumpDetectionService`, and `EventEmitter2`.

## Out of Scope

- H3 cell conversion or `h3:drivers:r*` Redis sets (Task 005).
- OSRM route or ETA (Task 006).
- Matching engine, ride offers, retry, timeouts (Task 007).
- Customer subscription to ride/driver location (Task 007 onward).
- Persistent `driver_locations` history table (deferred; ARCHITECTURE marks it "(nếu persist)").
- Outbox table (`domain_event_outbox`) — ARCHITECTURE explicitly defers Outbox until first cross-module write (earliest Task 007/009). In-process EventEmitter is sufficient now.
- Driver/admin self-registration (still in Task 002 deferred list).
- Rate limiting on the WS event — defer; do **not** implement throttling in this task.
- Vehicles table (owned by `drivers` per ARCHITECTURE, but not needed yet).
- Frontend map.

## Expected Files/Modules

```
ridex/
  docker-compose.yml                                       # + redis service
  .env.example                                             # + Redis & location env vars
  apps/backend/package.json                                # + 4 deps listed above
  apps/backend/src/
    app.module.ts                                          # imports DriversModule, LocationModule, EventEmitterModule, RedisModule
    config/env.validation.ts                               # + new env keys & validators
    config/env.validation.spec.ts                          # + tests for new keys
    infra/redis/
      redis.module.ts
      redis.client.ts                                      # ioredis singleton provider
      redis.tokens.ts                                      # injection token constant
    drivers/
      entities/driver.entity.ts
      dto/driver-availability.dto.ts
      drivers.service.ts
      drivers.service.spec.ts
      drivers.facade.ts
      drivers.facade.spec.ts
      drivers.controller.ts
      drivers.controller.spec.ts
      drivers.module.ts
      errors/driver-errors.ts                              # DriverNotFoundError, DriverAlreadyOnlineError (optional), etc.
      events/driver-events.ts                              # event-type constants + payload types
    location/
      dto/driver-location.dto.ts
      dto/driver-location-ack.dto.ts                       # ack envelope
      cache/driver-location-cache.service.ts
      cache/driver-location-cache.service.spec.ts
      cache/cached-location.types.ts                       # CachedLocation shape
      jump/gps-jump-detection.service.ts
      jump/gps-jump-detection.service.spec.ts
      jump/haversine.ts                                    # pure helper
      jump/haversine.spec.ts
      gateways/location.gateway.ts
      gateways/location.gateway.spec.ts
      events/location-events.ts                            # event-type constants + payload types
      location.module.ts
    database/migrations/1747200003000-CreateDriversTable.ts
```

This is guidance, not a license for unrelated refactors. Do not modify `rides`, `auth`, `users`, `health`, or `common` beyond minimal wiring (e.g., adding `EventEmitterModule.forRoot()` to `app.module.ts` is allowed; rewriting `JwtStrategy` is not).

## Functional Requirements

### Driver availability (REST)
1. `POST /drivers/me/online` — authenticated DRIVER only. Sets `is_online = true`, `online_since = now()`, `last_seen_at = now()`. Emits `driver.went-online`. Returns `204 No Content`.
2. `POST /drivers/me/offline` — authenticated DRIVER only. Sets `is_online = false`. **Clears the driver's Redis location key.** Emits `driver.went-offline`. Returns `204 No Content`.
3. `GET /drivers/me/availability` — authenticated DRIVER only. Returns `{ isOnline: boolean, onlineSince: string | null, lastSeenAt: string | null }`.
4. Idempotency: calling `online` while already online updates `last_seen_at` but does **not** reset `online_since` and does **not** re-emit `driver.went-online`. Calling `offline` while already offline is a no-op (no event, no Redis touch).

### WebSocket (Socket.IO)
1. Connect:
   - Server-side WS adapter mounted via `@nestjs/platform-socket.io`.
   - Authenticate during the connect handshake. Token sources, checked in order: `handshake.auth.token`, then `Authorization: Bearer <token>` header. Validate using the existing `JwtService` against `JWT_ACCESS_SECRET`.
   - On success, populate `socket.data.user = { id, role }` and `socket.data.correlationId` (UUID v4).
   - On failure, emit a `ws:error` event with `{ code: "WS_AUTH_FAILED", message }` and call `socket.disconnect(true)`. Same flow for non-DRIVER role but `code: "WS_FORBIDDEN"`.
   - Each connected DRIVER joins room `driver:{driverId}` (for future events targeting one driver). No customer join logic in this task.
2. Event `driver.location.update`:
   - Payload validated against `DriverLocationDto` using `class-validator` (consistent with REST DTOs).
   - **Driver identity must come from `socket.data.user.id`. Any `driverId` field in the payload is ignored.**
   - Check `DriversFacade.isOnline(driverId)`. If false, ack with `DRIVER_OFFLINE`.
   - Load previous location (if any) from cache, run `GpsJumpDetectionService` against the incoming payload. Reject with the appropriate code if it fails.
   - On success, write the new location to cache with TTL `DRIVER_LOCATION_TTL_SECONDS`, ack `{ ok: true }`, and emit `driver.location-updated` via EventEmitter.

### DTO (`DriverLocationDto`)
| Field | Type | Constraints |
|---|---|---|
| `lat` | number | required, -90 ≤ lat ≤ 90 |
| `lng` | number | required, -180 ≤ lng ≤ 180 |
| `heading` | number | optional, 0 ≤ heading < 360 |
| `speed` | number | optional, ≥ 0, ≤ `LOCATION_MAX_SPEED_MPS` (used as a soft cap; the actual jump check still computes its own speed from positions) |
| `accuracy` | number | optional, ≥ 0 |
| `recordedAt` | ISO-8601 string | required, parsed to Date; rejected if NaN, if > `now + 5s` (clock skew tolerance), or if older than `DRIVER_LOCATION_TTL_SECONDS` |

### Cached location (Redis value)
- Key: `driver:location:{driverId}`
- Value (JSON, stringified): `CachedLocation = { lat, lng, heading?, speed?, accuracy?, recordedAt: ISO-string, receivedAt: ISO-string }`
- TTL: `DRIVER_LOCATION_TTL_SECONDS` (default 60). Reset on each accepted update.

### GPS jump detection algorithm
Given `prev: CachedLocation | null`, `next: { lat, lng, recordedAt: Date }`, and config:

```
if (prev === null) return ALLOW;

const prevAt = Date.parse(prev.recordedAt);
const nextAt = next.recordedAt.getTime();
const elapsedSeconds = (nextAt - prevAt) / 1000;

if (elapsedSeconds <= 0) return REJECT("STALE_TIMESTAMP");
if (elapsedSeconds > LOCATION_JUMP_DETECTION_WINDOW_SECONDS) return ALLOW; // stale prev; treat as fresh session

const distanceMeters = haversine(prev.lat, prev.lng, next.lat, next.lng);
if (distanceMeters > LOCATION_MAX_JUMP_METERS) return REJECT("GPS_JUMP_DISTANCE");

const computedSpeedMps = distanceMeters / elapsedSeconds;
if (computedSpeedMps > LOCATION_MAX_SPEED_MPS) return REJECT("GPS_JUMP_SPEED");

return ALLOW;
```

Haversine must use the Earth-radius constant `EARTH_RADIUS_METERS = 6_371_000` and return distance in meters. Place the helper in `location/jump/haversine.ts` as a pure function with its own spec.

### Ack envelope
Ack is sent as the second argument to the client's emit callback (Socket.IO ack pattern). Shape:

```typescript
type LocationAck =
  | { ok: true }
  | { ok: false; error: { code: LocationErrorCode; message: string } };

type LocationErrorCode =
  | "INVALID_PAYLOAD"
  | "DRIVER_OFFLINE"
  | "STALE_TIMESTAMP"
  | "GPS_JUMP_DISTANCE"
  | "GPS_JUMP_SPEED"
  | "INTERNAL";
```

If the client does not pass an ack callback, the server still applies validation and silently swallows the response (no exception).

### Cross-module domain events
Use `@nestjs/event-emitter` (`EventEmitter2`). Event-type constants live in module-level `events/*.ts` files. Payload types are exported so Task 005 can `import type` them. Use a lightweight envelope (do **not** persist to an outbox table in this task):

```typescript
interface DomainEvent<TPayload> {
  eventId: string;          // uuid v4
  eventType: string;        // see below
  aggregateType: "driver";
  aggregateId: string;      // driverId
  payload: TPayload;
  correlationId: string;    // socket.data.correlationId or request correlation id
  occurredAt: string;       // ISO-8601 UTC
  emittedBy: "drivers" | "location";
}
```

Events to emit:
| Event type | Emitted by | Payload |
|---|---|---|
| `driver.went-online` | `drivers` | `{ driverId, onlineSince }` |
| `driver.went-offline` | `drivers` | `{ driverId, offlineAt }` |
| `driver.location-updated` | `location` | `{ driverId, lat, lng, heading?, speed?, recordedAt, receivedAt }` |

No subscribers are added in this task; emissions are verified in unit tests by spying on `EventEmitter2.emit`.

## Security Requirements

- Socket connect MUST verify a valid signed access token. Reject anonymous, expired, malformed, wrong-secret, and wrong-issuer tokens.
- Non-DRIVER role MUST be rejected with `WS_FORBIDDEN` and disconnected. CUSTOMER and ADMIN cannot send `driver.location.update`.
- Driver identity for cache write, online check, and event emission MUST be derived from `socket.data.user.id`. Any `driverId` field in the payload MUST be ignored (do not even read it).
- `DriverLocationDto` validated with the same global ValidationPipe behavior as REST DTOs (whitelist, forbidNonWhitelisted, transform).
- Never log the bearer token, the raw `Authorization` header, or refresh tokens. Driver location (lat/lng) may be logged at `debug` level only and must not appear in `warn`/`error` traces unless redacted (e.g., `{ driverId, accepted: false, code }` without coordinates is fine in info/warn).
- REST endpoints (`/drivers/me/online`, `/drivers/me/offline`, `/drivers/me/availability`) are protected by `JwtAuthGuard` + `RolesGuard` with `@Roles(Role.DRIVER)`.
- The Redis client connection string is read from `REDIS_URL`; do not hard-code credentials.
- Do not expose the driver's Redis location key, TTL value, or socket id to other clients.

## Database Requirements

### New table: `drivers`
Migration `1747200003000-CreateDriversTable.ts`. Schema:

| Column | Type | Constraints |
|---|---|---|
| `driver_id` | `uuid` | PK, FK → `users(id)` ON DELETE CASCADE |
| `is_online` | `boolean` | NOT NULL DEFAULT false |
| `online_since` | `timestamptz` | NULL |
| `last_seen_at` | `timestamptz` | NULL |
| `created_at` | `timestamptz` | NOT NULL DEFAULT now() |
| `updated_at` | `timestamptz` | NOT NULL DEFAULT now() |

Indexes:
- Partial index `drivers_is_online_idx` ON `drivers (driver_id) WHERE is_online = true` — supports future fast online-only lookups without paying for index maintenance on offline rows.

Constraints:
- `driver_id` FK references `users(id)`. Per ARCHITECTURE table ownership, the `drivers` module owns the row; `users` owns identity/credentials.

Lifecycle:
- A `drivers` row is created lazily on the first availability action by a user whose role is `DRIVER`. Specifically: `DriversService.setOnline(driverId)` does an upsert (INSERT … ON CONFLICT DO UPDATE), validating against the `users` table that the user exists and has role `DRIVER`. If not, throw `DriverNotEligibleError` (HTTP 403, code `DRIVER_NOT_ELIGIBLE`).
- `setOffline` performs an UPDATE; if no row exists yet, it is a no-op (idempotent).
- `GET /drivers/me/availability` returns `{ isOnline: false, onlineSince: null, lastSeenAt: null }` when no row exists (driver has never gone online).

### Redis usage
- The `driver:location:{driverId}` key is **not** a source of truth — it is a TTL-bound cache.
- Use `SET key value EX <ttl>` on write. Use `GET` on read. Use `DEL` on offline.
- Do not introduce `h3:drivers:r*` sets in this task (Task 005 owns them).

### Concurrency
- REST `setOnline` / `setOffline` use a single-row UPDATE; no explicit row lock is required because the operation is idempotent and the row is keyed by `driver_id`.
- Concurrent `driver.location.update` events from the same socket are handled sequentially by Socket.IO's per-connection event loop. Cross-connection races on the cache are acceptable — last write wins for the latest-location key.

## API/WebSocket Changes

### REST
- `POST /api/v1/drivers/me/online` → `204 No Content`
- `POST /api/v1/drivers/me/offline` → `204 No Content`
- `GET /api/v1/drivers/me/availability` → `200 OK { isOnline, onlineSince, lastSeenAt }` wrapped in the existing `ApiResponse` envelope

Error responses use the project's standard error taxonomy:
- `401 UNAUTHORIZED` — missing/invalid JWT
- `403 FORBIDDEN` — non-DRIVER role (or `DRIVER_NOT_ELIGIBLE` when user role mismatch)

### WebSocket
- Default Socket.IO path (`/socket.io`). Same HTTP server as REST (Nest's IoAdapter).
- Single event: `driver.location.update` (client → server).
- Reserved server-emitted error event: `ws:error` (used only when the handshake fails before normal acks are available).
- No client→server "join room" event; rooms are server-assigned at connect.
- CORS for the WS server should reuse `CORS_ORIGINS` from existing env.

## Business Rules

- Only authenticated users with role `DRIVER` can emit `driver.location.update`.
- A driver must explicitly call `POST /drivers/me/online` before location updates are accepted. Connecting the socket does **not** auto-mark the driver online.
- A driver's location update is rejected if any of: payload invalid; not online; `recordedAt` stale or in the future beyond clock skew; GPS jump detected.
- The server controls all driver identity used by the system; the client's payload `driverId` field, if present, is ignored — but the DTO should not declare a `driverId` field at all (defense by absence).
- Going offline clears the Redis cache key for that driver to prevent stale "last known" data from leaking into Task 005 H3 indexing later.
- Going offline does not delete the `drivers` row; the row persists as the driver's availability record.

## Edge Cases

- Missing token at connect → disconnect with `WS_AUTH_FAILED`.
- Expired token → disconnect with `WS_AUTH_FAILED`.
- Malformed token / wrong secret → disconnect with `WS_AUTH_FAILED`.
- Token valid but role = CUSTOMER or ADMIN → disconnect with `WS_FORBIDDEN`.
- Token valid, role = DRIVER, but no `drivers` row yet and user emits location → ack `DRIVER_OFFLINE` (since `isOnline` defaults to false).
- Payload missing `lat`/`lng` → ack `INVALID_PAYLOAD`.
- Payload `lat = 91`, `lat = -91`, `lng = 181`, `lng = -181` → ack `INVALID_PAYLOAD`.
- Payload `recordedAt` is not a parseable ISO-8601 string → ack `INVALID_PAYLOAD`.
- Payload `recordedAt` is more than 5 seconds in the future (clock skew tolerance exceeded) → ack `INVALID_PAYLOAD`.
- Payload `recordedAt` older than `DRIVER_LOCATION_TTL_SECONDS` → ack `INVALID_PAYLOAD`.
- Payload includes a `driverId` field → it is ignored (no error, server uses authenticated id).
- Prev location exists, `next.recordedAt < prev.recordedAt` → ack `STALE_TIMESTAMP`.
- Prev location exists, distance > `LOCATION_MAX_JUMP_METERS` within window → ack `GPS_JUMP_DISTANCE`.
- Prev location exists, computed speed > `LOCATION_MAX_SPEED_MPS` within window → ack `GPS_JUMP_SPEED`.
- Prev location exists but older than `LOCATION_JUMP_DETECTION_WINDOW_SECONDS` → allow update (treat as new session).
- Redis unavailable (connection refused / timeout) → ack `INTERNAL`, log at `error` level with driverId but not coordinates; do not crash the gateway.
- Driver calls `POST /offline` then immediately emits a queued location update → ack `DRIVER_OFFLINE`.
- Driver disconnects mid-update (socket close before ack) → server still applies validation; ack is dropped harmlessly.
- Two sockets for the same driver (e.g., reconnect) → both are allowed; last-write-wins for the cache key. No deduplication in this task.

## Tests Required

### Unit
1. `haversine.spec.ts` — known reference distances (0 m for same point; ~111 km for 1 degree latitude; ~78 km for 1 degree longitude at lat=45).
2. `gps-jump-detection.service.spec.ts` — every branch of the algorithm above (no prev → allow; backward timestamp → reject; stale-prev → allow; speed exceeded → reject; distance exceeded → reject; both within limit → allow).
3. `driver-location-cache.service.spec.ts` — set writes correct key with TTL via mocked ioredis; get parses JSON; get returns null on miss; clear deletes key; malformed JSON returns null and logs a warning.
4. `drivers.service.spec.ts` — `setOnline` upserts, sets timestamps, emits event once on transition false→true, no event on already-online; `setOffline` updates, clears cache via injected facade/service, emits event once on transition true→false, no-op when already offline; `isOnline` returns DB value; throws `DriverNotEligibleError` when user role ≠ DRIVER.
5. `drivers.facade.spec.ts` — delegates to service; surface API is `setOnline(driverId)`, `setOffline(driverId)`, `isOnline(driverId)`, `getAvailability(driverId)`. Cache-clearing on offline is wired through.
6. `drivers.controller.spec.ts` — `POST /online` returns 204; `POST /offline` returns 204; `GET /availability` returns DTO; `RolesGuard` blocks CUSTOMER and ADMIN.
7. `location.gateway.spec.ts` — covers (a) connect with valid DRIVER JWT joins `driver:{id}` room; (b) connect with missing/expired/malformed JWT disconnects with `WS_AUTH_FAILED`; (c) connect with CUSTOMER role disconnects with `WS_FORBIDDEN`; (d) accepted `driver.location.update` writes cache, ack `{ok:true}`, emits `driver.location-updated`; (e) offline driver → ack `DRIVER_OFFLINE`; (f) invalid lat/lng/recordedAt → ack `INVALID_PAYLOAD`; (g) backward timestamp → ack `STALE_TIMESTAMP`; (h) distance jump → ack `GPS_JUMP_DISTANCE`; (i) speed jump → ack `GPS_JUMP_SPEED`; (j) payload includes spoofed `driverId` — server uses authenticated id (verify the cache key written contains the auth id, not the payload id); (k) Redis throws — ack `INTERNAL`, no crash; (l) connect with no ack callback — no exception.
8. `env.validation.spec.ts` — add tests for the new env keys: required, type, range.

### Integration
- None required in this task. Gateway unit tests with real `LocationGateway` instance and mocked dependencies are sufficient.

### Migration
- Migration runs without error against the existing `users` table. (Manual verification noted in Notes/Risks; CI not required.)

## Configuration

Add to `.env.example`:
```
REDIS_URL=redis://localhost:6379
DRIVER_LOCATION_TTL_SECONDS=60
LOCATION_MAX_SPEED_MPS=55
LOCATION_MAX_JUMP_METERS=1000
LOCATION_JUMP_DETECTION_WINDOW_SECONDS=30
WS_PATH=/socket.io
```

Defaults rationale:
- `LOCATION_MAX_SPEED_MPS=55` ≈ 198 km/h — leaves slack above urban speed limits while catching teleport-style jumps.
- `LOCATION_MAX_JUMP_METERS=1000` — a 1 km jump within 30 s is implausible for a normal ride scenario.
- `DRIVER_LOCATION_TTL_SECONDS=60` — short enough that stale state can't dominate H3 sets in Task 005.
- `LOCATION_JUMP_DETECTION_WINDOW_SECONDS=30` — when the previous fix is older than this, do not penalize the new fix.

All five values validated in `env.validation.ts` with `readPositiveInteger` (or string for `WS_PATH`). Add a check that the new keys are in `EnvironmentVariables`.

Docker Compose `redis` service:

```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  command: ["redis-server", "--save", "", "--appendonly", "no"]
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 5s
    timeout: 3s
    retries: 10
```

And `backend.depends_on` must include `redis: { condition: service_healthy }`.

## Acceptance Criteria

- [ ] Redis service runs via `docker-compose up` and `backend` waits on its health.
- [ ] `.env.example` and `env.validation.ts` include and validate all 6 new keys.
- [ ] `drivers` table migration created and reversible.
- [ ] `POST /drivers/me/online`, `POST /drivers/me/offline`, `GET /drivers/me/availability` work behind JWT + DRIVER role guard. RolesGuard rejects CUSTOMER and ADMIN.
- [ ] Socket.IO gateway accepts authenticated DRIVER sockets, rejects unauthenticated and non-DRIVER, joins each driver to `driver:{driverId}`.
- [ ] `driver.location.update`: validated, online-checked, jump-checked, cache-stored with TTL, ack returned, `driver.location-updated` event emitted.
- [ ] Driver identity for every server-side write is the authenticated id, not the payload.
- [ ] Offline clears the Redis location key for the driver.
- [ ] All edge cases listed above are exercised in tests.
- [ ] `pnpm lint` clean.
- [ ] `pnpm build` clean.
- [ ] `pnpm test` green, with new tests added per the Tests Required section. Report the test count delta from Task 003's 128.
- [ ] No H3 logic, no matching logic, no customer subscription, no persistent location history.

## Prompt for Codex

Implement Task 004 only. Add the `drivers` module (table, REST endpoints, facade, service) and the `location` module (Socket.IO gateway, Redis cache, GPS jump detection helper, haversine) per the spec. Wire `@nestjs/event-emitter` for the three domain events listed. Add Redis to `docker-compose.yml` and add the 6 new env keys with validation. Do **not** implement H3, OSRM, matching, ride offers, customer subscription, persistent location history, rate limiting, or any frontend.

Architectural rules to honor:
- `location` may import `drivers` (via facade) but `drivers` MUST NOT import `location`. To clear the cache on offline, inject a small `LocationCacheGateway` interface into `drivers` and have `LocationModule` provide the implementation — or invert the dependency by having `location` listen to `driver.went-offline` and clear the cache itself. Choose one and document the choice in the PR summary.
- Driver identity for every WS code path is `socket.data.user.id`. The DTO must not declare `driverId`.
- All cross-module access goes through facades. No reaching into entities of another module.
- New env values must be validated; missing/invalid values must fail boot.
- Tests are mandatory for every code path in the Tests Required section.

Finish with: Summary, Changed files, Tests run (with count delta), Notes/Risks (including which `drivers`↔`location` direction you chose for the cache-clear on offline, and any spec ambiguities you had to resolve).
