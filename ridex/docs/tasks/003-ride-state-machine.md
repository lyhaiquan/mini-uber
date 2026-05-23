# Task 003: Ride State Machine

## Task Name

Implement the ride entity, ride status enum, allowed transition map, role-based transition service, and a minimal HTTP surface for ride creation and transitions.

## Goal

Create a strict ride state machine that:

- Blocks invalid transitions with safe domain errors.
- Enforces role-based and ownership-based transition permissions.
- Persists every state change to an append-only `ride_events` audit trail (placeholder for the future audit module).
- Handles concurrent transitions correctly via row-locking + optimistic version checks.

## Context

Ride lifecycle correctness is the central business invariant of RideX. Matching, tracking, pricing, payment, chat, and admin features all depend on a sound state machine. This task creates the `rides` module from scratch — it does not yet exist in the codebase.

Auth (Task 002) is complete: `JwtAuthGuard` is APP_GUARD globally, `RolesGuard` checks `@Roles()` metadata, and `@CurrentUser()` injects the JWT payload. This task plugs into that infrastructure.

## Scope

- Create `rides` module skeleton with `RidesService`, `RideTransitionService`, `RidesFacade`, and `RidesController`.
- Define `RideStatus` and `ActorType` enums.
- Create `rides` and `ride_events` tables via a migration (PG enum type for status).
- Implement allowed-transition map and role/ownership permission map as explicit data structures.
- Implement `RideTransitionService.transition()` with `SELECT … FOR UPDATE` + optimistic `version` check.
- Implement audit emission: structured log event `ride.transition` + INSERT into `ride_events`.
- Add a minimal HTTP surface:
  - `POST /api/v1/rides` — customer creates a ride in `REQUESTED` state.
  - `POST /api/v1/rides/:id/transitions` — caller requests a transition; service validates everything.
- Add `RidesFacade` exposing `getRideForMatching(rideId)`, `markMatching(rideId)`, `assignDriver(rideId, driverId)`, etc., for future modules to consume.
- Unit tests covering full transition matrix (positive + negative), role checks, ownership checks, terminal immutability, concurrency.
- Update `docs/ARCHITECTURE.md` Table Ownership Map note **only if needed** (currently lists `rides` and `ride_events` — no change expected).

## Out of Scope

- Matching engine logic (Task 007).
- OSRM/distance calculation (Task 006).
- Pricing snapshot (Task 008).
- WebSocket broadcasting of ride status (later phase).
- Driver-side endpoints beyond the generic transitions endpoint.
- Admin override UI.
- Cancellation fee calculation (Pricing phase).
- Full audit module — emit only via structured log + `ride_events` table.
- `drivers` table — does not yet exist; this task uses `driver_user_id` referencing `users.id` for the assigned driver.

## Architectural Decisions (Locked)

These are confirmed and must not be relitigated by the implementer:

### Status Enum (8 states)

```
REQUESTED        — ride just created, awaiting matching
MATCHING         — matching engine is searching for driver
ACCEPTED         — driver assigned, en route to pickup
DRIVER_ARRIVED   — driver at pickup location
IN_PROGRESS      — customer picked up, ride in motion
COMPLETED        — terminal: ride finished successfully
CANCELLED        — terminal: cancelled by customer/driver/admin
NO_DRIVERS_FOUND — terminal: matching exhausted with no candidate
```

Cancellation reason is stored in separate columns (`cancelled_by`, `cancellation_reason`), not encoded in the status enum.

Terminal states: `COMPLETED`, `CANCELLED`, `NO_DRIVERS_FOUND`. No transitions leave a terminal state.

### Allowed Transition Map

| From            | To               | Allowed Actors                                |
|---|---|---|
| `REQUESTED`     | `MATCHING`       | SYSTEM                                        |
| `REQUESTED`     | `CANCELLED`      | CUSTOMER (own), ADMIN                         |
| `MATCHING`      | `ACCEPTED`       | SYSTEM                                        |
| `MATCHING`      | `NO_DRIVERS_FOUND` | SYSTEM                                      |
| `MATCHING`      | `CANCELLED`      | CUSTOMER (own), ADMIN                         |
| `ACCEPTED`      | `DRIVER_ARRIVED` | DRIVER (assigned), ADMIN                      |
| `ACCEPTED`      | `CANCELLED`      | CUSTOMER (own), DRIVER (assigned), ADMIN      |
| `DRIVER_ARRIVED`| `IN_PROGRESS`    | DRIVER (assigned), ADMIN                      |
| `DRIVER_ARRIVED`| `CANCELLED`      | CUSTOMER (own), DRIVER (assigned), ADMIN      |
| `IN_PROGRESS`   | `COMPLETED`      | DRIVER (assigned), ADMIN                      |
| `IN_PROGRESS`   | `CANCELLED`      | ADMIN ONLY                                    |

Any transition not listed above → `RideInvalidTransitionError` (`code: "RIDE_INVALID_STATE"`).
Any transition listed but actor lacks role/ownership → `RideForbiddenTransitionError` (`code: "RIDE_FORBIDDEN_TRANSITION"`).

### Actor Model

```typescript
enum ActorType {
  CUSTOMER = 'CUSTOMER',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN',
  SYSTEM = 'SYSTEM',
}

interface TransitionActor {
  type: ActorType;
  userId: string | null;  // null only for SYSTEM
}
```

The HTTP controller derives the actor from the JWT (`@CurrentUser()`):
- Role `CUSTOMER` → `ActorType.CUSTOMER`
- Role `DRIVER` → `ActorType.DRIVER`
- Role `ADMIN` → `ActorType.ADMIN`

SYSTEM actor is **never** accepted from HTTP — only used by internal services (matching engine, timeout jobs). The controller must reject any client-supplied actor field.

### Concurrency Control (Both — Defense in Depth)

Each transition runs inside a single DB transaction:

1. `BEGIN`
2. `SELECT * FROM rides WHERE id = $1 FOR UPDATE` — row-lock until commit.
3. Validate ride exists, ownership/role, current status allows transition, optimistic `version` matches the version the caller observed (if provided; for internal callers `version` may be `undefined` to skip the optimistic check while still relying on the row lock).
4. `UPDATE rides SET status = $new, version = version + 1, <timestamps>, <cancelled_by/reason> WHERE id = $1 AND version = $expected` — if no rows affected, throw `RideVersionConflictError` (`code: "RIDE_VERSION_CONFLICT"`).
5. `INSERT INTO ride_events (...)` for the audit trail.
6. `COMMIT`.

If any step fails, rollback. Concurrent callers serialize on the row lock; the loser sees an updated `version` and either retries or returns the conflict error.

### Cancellation Cutoff

Customer (own ride) can cancel while status ∈ `{REQUESTED, MATCHING, ACCEPTED, DRIVER_ARRIVED}`. After `IN_PROGRESS`, only `ADMIN` can move to `CANCELLED`. This rule is encoded directly in the allowed transition map above.

### Tables (rides module owns both)

`rides`:

| Column                | Type                        | Notes |
|---|---|---|
| `id`                  | uuid PK                     | gen_random_uuid() default |
| `customer_id`         | uuid NOT NULL               | logical FK → users.id; **no DB CASCADE** (cross-module rule); index |
| `driver_user_id`      | uuid NULL                   | set when transitioning to ACCEPTED; index |
| `status`              | ride_status enum NOT NULL   | default `REQUESTED` |
| `pickup_lat`          | numeric(9,6) NOT NULL       | |
| `pickup_lng`          | numeric(9,6) NOT NULL       | |
| `pickup_address`      | text NOT NULL               | |
| `destination_lat`     | numeric(9,6) NOT NULL       | |
| `destination_lng`     | numeric(9,6) NOT NULL       | |
| `destination_address` | text NOT NULL               | |
| `requested_at`        | timestamptz NOT NULL        | default now() |
| `matching_started_at` | timestamptz NULL            | |
| `accepted_at`         | timestamptz NULL            | |
| `driver_arrived_at`   | timestamptz NULL            | |
| `started_at`          | timestamptz NULL            | when IN_PROGRESS |
| `completed_at`        | timestamptz NULL            | |
| `cancelled_at`        | timestamptz NULL            | |
| `cancelled_by`        | actor_type enum NULL        | CUSTOMER/DRIVER/ADMIN/SYSTEM |
| `cancellation_reason` | text NULL                   | free-text or coded reason |
| `version`             | integer NOT NULL default 0  | optimistic lock |
| `created_at`          | timestamptz NOT NULL        | default now() |
| `updated_at`          | timestamptz NOT NULL        | default now() |

Indexes: `(customer_id, created_at DESC)`, `(driver_user_id, status)` partial WHERE `driver_user_id IS NOT NULL`, `(status)` partial WHERE `status IN ('REQUESTED','MATCHING','ACCEPTED','DRIVER_ARRIVED','IN_PROGRESS')` for active-ride lookups.

`ride_events` (append-only, intra-module CASCADE to rides is acceptable):

| Column         | Type                       | Notes |
|---|---|---|
| `id`           | uuid PK                    | gen_random_uuid() default |
| `ride_id`      | uuid NOT NULL              | FK → rides.id ON DELETE CASCADE (intra-module) |
| `from_status`  | ride_status NULL           | null only for the synthetic CREATE event |
| `to_status`    | ride_status NOT NULL       | |
| `actor_type`   | actor_type NOT NULL        | |
| `actor_id`     | uuid NULL                  | null for SYSTEM |
| `reason`       | text NULL                  | |
| `metadata`     | jsonb NULL                 | optional context (e.g., `{ offerId, retryCount }`) |
| `occurred_at`  | timestamptz NOT NULL       | default now() |

Index: `(ride_id, occurred_at)`.

PG enums must be created in the same migration:

```sql
CREATE TYPE ride_status AS ENUM (
  'REQUESTED', 'MATCHING', 'ACCEPTED', 'DRIVER_ARRIVED',
  'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_DRIVERS_FOUND'
);
CREATE TYPE actor_type AS ENUM (
  'CUSTOMER', 'DRIVER', 'ADMIN', 'SYSTEM'
);
```

### Audit Placeholder

Per Task 002 review MF-1, the audit module is deferred. For now:

- Structured log event `ride.transition` with `{ rideId, fromStatus, toStatus, actorType, actorId, reason }`.
- DB row in `ride_events`.

When the audit module lands, `RideTransitionService` will additionally call `AuditFacade.emit(...)`. `ride_events` remains as the module-owned audit trail.

## Expected Files/Modules

```
src/rides/
  rides.module.ts
  rides.controller.ts
  rides.service.ts                  # createRide, findRideById, list helpers
  ride-transition.service.ts        # state machine core
  ride-events.service.ts            # insertRideEvent helper
  rides.facade.ts                   # cross-module API (markMatching, assignDriver, getRideForMatching, etc.)
  entities/
    ride.entity.ts
    ride-event.entity.ts
  enums/
    ride-status.enum.ts
    actor-type.enum.ts
  transitions/
    allowed-transitions.ts          # readonly map (from, to) → allowed actor predicate
  dto/
    create-ride.dto.ts              # HTTP body for POST /rides
    transition-ride.dto.ts          # HTTP body for POST /rides/:id/transitions
    ride-response.dto.ts            # HTTP response shape
    ride-summary.dto.ts             # cross-module facade output (no internal columns)
  errors/
    ride-errors.ts                  # RideNotFoundError, RideInvalidTransitionError, RideForbiddenTransitionError, RideVersionConflictError

src/database/migrations/
  <timestamp>-CreateRidesTables.ts  # rides + ride_events + 2 PG enum types + indexes
```

## Functional Requirements

### `RidesService.createRide(dto, actor)`

- Only `ActorType.CUSTOMER` (or `ADMIN` impersonating, but defer impersonation to admin task) may create a ride.
- Persists a new row with `status = REQUESTED`, `requested_at = now()`, `version = 0`.
- Inserts a synthetic `ride_events` row with `from_status = NULL`, `to_status = REQUESTED`, `actor_type = CUSTOMER`.
- Returns the created ride DTO.
- Validates lat/lng ranges (`-90 ≤ lat ≤ 90`, `-180 ≤ lng ≤ 180`) via DTO `class-validator`.

### `RideTransitionService.transition(rideId, toStatus, actor, options?)`

- `options.reason?: string`, `options.metadata?: object`, `options.expectedVersion?: number`.
- Runs the FOR-UPDATE + version-check transaction described above.
- Updates timestamps based on target state:
  - `MATCHING` → `matching_started_at = now()`
  - `ACCEPTED` → `accepted_at = now()`, sets `driver_user_id` from `options.metadata.driverUserId` (required for ACCEPTED).
  - `DRIVER_ARRIVED` → `driver_arrived_at = now()`
  - `IN_PROGRESS` → `started_at = now()`
  - `COMPLETED` → `completed_at = now()`
  - `CANCELLED` → `cancelled_at = now()`, `cancelled_by = actor.type`, `cancellation_reason = options.reason ?? null`
  - `NO_DRIVERS_FOUND` → `cancelled_at = now()` (treat as terminal failure timestamp; reason = "no candidates")
- Throws:
  - `RideNotFoundError` (404) — id not found.
  - `RideInvalidTransitionError` (409, code `RIDE_INVALID_STATE`) — transition not in allowed map.
  - `RideForbiddenTransitionError` (403, code `RIDE_FORBIDDEN_TRANSITION`) — actor lacks role/ownership.
  - `RideVersionConflictError` (409, code `RIDE_VERSION_CONFLICT`) — version mismatch.
- Returns the updated ride DTO.

### `RidesFacade` (cross-module API)

Used by future modules (matching, payments, chat). Examples:

- `getRideForMatching(rideId): Promise<RideSummaryDto>` — returns pickup/destination + status; throws if not in a matching-eligible state.
- `markMatching(rideId): Promise<void>` — internal SYSTEM transition REQUESTED → MATCHING.
- `assignDriver(rideId, driverUserId): Promise<void>` — internal SYSTEM transition MATCHING → ACCEPTED.
- `markNoDriversFound(rideId, reason): Promise<void>` — internal SYSTEM transition MATCHING → NO_DRIVERS_FOUND.
- `findActiveRideForCustomer(customerId): Promise<RideSummaryDto | null>` — used by matching/chat to dedupe.

All facade methods that mutate must call `RideTransitionService.transition()` with `actor = { type: SYSTEM, userId: null }` — never bypass the state machine.

## Security Requirements

- The controller **must not** trust any client-supplied `actorType`, `actorId`, `userId`, `customerId`, `driverUserId`, or `status` field. Derive actor exclusively from the authenticated JWT (`@CurrentUser()`).
- `POST /rides` requires authenticated CUSTOMER role; `customerId` is taken from JWT, never from request body.
- `POST /rides/:id/transitions` requires authenticated user; actor is derived from JWT role.
  - If JWT role is `CUSTOMER`, ride must satisfy `ride.customer_id === jwtUser.id`.
  - If JWT role is `DRIVER`, ride must satisfy `ride.driver_user_id === jwtUser.id` (where applicable per the transition map).
  - If JWT role is `ADMIN`, no ownership check (but transition must still be allowed by map; admin override audited via `ride_events` row).
- Transition request body accepts only `{ toStatus, reason?, expectedVersion?, metadata? }`. Reject unknown fields with `forbidNonWhitelisted: true` (already global in app.setup.ts).
- Ride creation pickup/destination coordinates must pass DTO validation; reject NaN/Infinity.
- Use the existing global `AllExceptionsFilter` to surface domain errors as `{ code, message }`; do not leak stack traces.

## Database Requirements

- One migration creating both PG enum types, both tables, all indexes.
- Down migration drops in reverse order and drops both enum types.
- Use `gen_random_uuid()` (requires `pgcrypto` extension — add `CREATE EXTENSION IF NOT EXISTS pgcrypto;` in migration if not already present from Task 001/002).
- Use TypeORM `@PrimaryColumn({ type: 'uuid' })` + `@BeforeInsert` if `gen_random_uuid()` default doesn't work cleanly with TypeORM, OR use `@PrimaryGeneratedColumn('uuid')`.
- Migrations follow expand-and-contract per `DATABASE_RULES.md`.
- All timestamps are `timestamptz` UTC.

## API Spec

### `POST /api/v1/rides`

**Auth:** Bearer JWT, role `CUSTOMER`.

**Request body:**

```json
{
  "pickup": {
    "lat": 10.7769,
    "lng": 106.7009,
    "address": "Bến Thành Market, HCMC"
  },
  "destination": {
    "lat": 10.8231,
    "lng": 106.6297,
    "address": "Tan Son Nhat Airport"
  }
}
```

**Response 201:**

```json
{
  "data": {
    "id": "<uuid>",
    "customerId": "<uuid>",
    "status": "REQUESTED",
    "pickup": { "lat": ..., "lng": ..., "address": "..." },
    "destination": { "lat": ..., "lng": ..., "address": "..." },
    "requestedAt": "2026-05-15T10:00:00.000Z",
    "version": 0
  }
}
```

### `POST /api/v1/rides/:id/transitions`

**Auth:** Bearer JWT, role `CUSTOMER | DRIVER | ADMIN`.

**Request body:**

```json
{
  "toStatus": "CANCELLED",
  "reason": "Changed my mind",
  "expectedVersion": 0
}
```

`expectedVersion` is optional — if omitted, only the row lock protects against races (acceptable for SYSTEM/internal calls but recommended for HTTP clients).

`metadata` field is rejected at the HTTP boundary — only internal services may pass metadata via the service layer.

**Response 200:**

```json
{
  "data": { "<full ride dto>": "..." }
}
```

**Error responses:**

- `404 RIDE_NOT_FOUND`
- `403 RIDE_FORBIDDEN_TRANSITION`
- `409 RIDE_INVALID_STATE`
- `409 RIDE_VERSION_CONFLICT`
- `400 VALIDATION_ERROR` (bad body)

## Business Rules

- Terminal states (`COMPLETED`, `CANCELLED`, `NO_DRIVERS_FOUND`) are immutable — any transition from them fails with `RIDE_INVALID_STATE`.
- `ACCEPTED` transition requires `metadata.driverUserId`; the service sets `ride.driver_user_id` atomically with the status change.
- All subsequent driver-only transitions (`DRIVER_ARRIVED`, `IN_PROGRESS`, `COMPLETED`) require `actor.userId === ride.driver_user_id`.
- A ride must not be created with non-customer JWT.
- Customer cancellation is permitted only while status is in `{REQUESTED, MATCHING, ACCEPTED, DRIVER_ARRIVED}`. Encoded directly in the transition map.

## Edge Cases (must be tested or handled)

1. Transition from `COMPLETED` to any state → `RIDE_INVALID_STATE`.
2. Transition from `CANCELLED` to any state → `RIDE_INVALID_STATE`.
3. Driver A tries to transition a ride assigned to driver B → `RIDE_FORBIDDEN_TRANSITION`.
4. Customer A tries to cancel customer B's ride → `RIDE_FORBIDDEN_TRANSITION`.
5. Customer attempts `IN_PROGRESS → CANCELLED` → `RIDE_INVALID_STATE` (not in map for CUSTOMER, only ADMIN).
6. Same transition attempted twice concurrently → one wins, the other gets `RIDE_VERSION_CONFLICT` (or `RIDE_INVALID_STATE` if status already moved beyond).
7. Unknown `toStatus` value in request body → `400 VALIDATION_ERROR` via DTO whitelist.
8. `ACCEPTED` transition called without `driverUserId` metadata → throw internal error (this is a programmer error in matching, never from HTTP).
9. Ride id does not exist → `RIDE_NOT_FOUND`.
10. Customer creates ride while still having an active ride — **not enforced in this task** (Matching engine will enforce dedupe). Document as deferred.

## Tests Required

### Unit tests (Jest)

`ride-transition.service.spec.ts`:

- Full positive matrix: every allowed (from, to, role) combination succeeds.
- Full negative matrix sample: each transition not in the map throws `RIDE_INVALID_STATE` for any role.
- Role denial: e.g., customer tries DRIVER-only transition → `RIDE_FORBIDDEN_TRANSITION`.
- Ownership denial: customer A on customer B's ride → forbidden.
- Driver assignment denial: driver B on driver A's ride → forbidden.
- Terminal immutability: COMPLETED + CANCELLED + NO_DRIVERS_FOUND cannot leave.
- Version conflict: caller passes stale `expectedVersion` → `RIDE_VERSION_CONFLICT`.
- Admin override on `IN_PROGRESS → CANCELLED` succeeds and produces a `ride_events` row with `actor_type = ADMIN`.
- `ride_events` row is inserted on every successful transition.
- `driver_user_id` is set atomically on MATCHING → ACCEPTED.

`rides.service.spec.ts`:

- `createRide` creates row in `REQUESTED` with version 0 and emits synthetic ride_events row.
- `createRide` validates lat/lng range.

`rides.facade.spec.ts`:

- `markMatching`, `assignDriver`, `markNoDriversFound` call through to transition service with SYSTEM actor.
- `getRideForMatching` returns expected DTO; throws if ride is not in a matching-eligible state.

### Integration tests

If feasible without a live Postgres, mock the transactional EntityManager. If e2e against Postgres is set up later, defer HTTP-level tests to that suite (note as deferred in Notes/Risks).

## Acceptance Criteria

- `rides` and `ride_events` tables created via migration; migration is idempotent up/down.
- PG enum types `ride_status` and `actor_type` created in migration.
- `RideStatus` and `ActorType` TypeScript enums mirror the PG enum exactly.
- Allowed transition map is one explicit data structure that is iterated by tests.
- `RideTransitionService.transition()` enforces map + role + ownership + version + row lock.
- Every successful transition writes a `ride_events` row.
- Every transition emits a structured log `event: "ride.transition"`.
- HTTP controller accepts only JWT-derived actor; rejects client-supplied identity fields.
- All listed test cases pass; total test count goes up commensurately (expect roughly +30–40 tests).
- `pnpm lint` clean, `pnpm build` clean, `pnpm test` clean.
- No CASCADE FK from `rides.customer_id` or `rides.driver_user_id` to `users` (cross-module rule).
- `ride_events.ride_id` → `rides.id` ON DELETE CASCADE is permitted (intra-module).

## Notes for Implementer

- Use TypeORM `QueryRunner` or `DataSource.transaction()` for the FOR-UPDATE transaction. Acquire a `manager` inside the callback and use it for all reads/writes.
- `SELECT … FOR UPDATE` in TypeORM: `manager.getRepository(Ride).createQueryBuilder('r').setLock('pessimistic_write').where('r.id = :id', { id }).getOne()`.
- For the optimistic version check, use `manager.update(Ride, { id, version: expected }, patch)` and check `result.affected === 1`.
- Map TypeORM raw enum columns to TS enums via `{ type: 'enum', enum: RideStatus }` on the column decorator.
- For the `metadata` jsonb column, type as `Record<string, unknown> | null`.
- Reuse `StructuredLogger` from `CommonModule` for the `ride.transition` event.
- Follow the Facade pattern strictly: `RidesService` and `RideTransitionService` are not exported from the module. Only `RidesFacade` is exposed via `exports`. The controller may inject the services directly (intra-module).
- Add `@Public()` decorator NOT applied to the controller — these endpoints require auth.

## Notes/Risks to Document on Completion

- Audit persistence currently dual-stored (structured log + `ride_events`). Will reconcile when audit module lands.
- E2E HTTP tests deferred (no Postgres in test runner) — re-evaluate with `sql.js` or Testcontainers later.
- "One active ride per customer" rule deferred to Matching task.
- `cancelled_by = SYSTEM` is set for `NO_DRIVERS_FOUND` to keep the column non-null on terminal failures.
- Optimistic version is exposed in the API response so HTTP clients can pass `expectedVersion` on subsequent transitions; internal services may omit.

## Prompt for Codex

Implement Task 003 as fully specified above. Do not deviate from the locked architectural decisions (status enum, transition map, concurrency design, controller scope). Do not implement matching, OSRM, pricing, payments, WebSocket, or the audit module — emit transitions via `StructuredLogger` + `ride_events` only. Follow the Facade pattern: only `RidesFacade` is exported from the module; `RidesService` and `RideTransitionService` stay internal but are injected into the controller. Use TypeORM `QueryRunner` (or `DataSource.transaction()`) with `SELECT … FOR UPDATE` and a `version`-column optimistic check inside one DB transaction per transition. Add the migration creating both PG enum types, both tables, and the indexes listed. Write unit tests covering the full positive transition matrix, key negative cases, role and ownership denials, terminal immutability, and version conflict. Finish with: Summary, Changed files, Tests run, Notes/Risks. Do not refactor outside the rides module.
