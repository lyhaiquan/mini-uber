# Task 004 Preview: Driver Location Realtime

**Task file:** `docs/tasks/004-driver-location-realtime.md`
**Prepared by:** Codex
**Date:** 2026-05-16
**Status:** Ready for Claude review

This is an implementation preview, not a Claude review verdict.

## Summary

Task 004 has been implemented end to end:

- Added Redis to Docker Compose and backend environment.
- Added Redis env validation and Socket.IO path validation.
- Added shared Redis client provider under `infra/redis`.
- Added configured Socket.IO adapter using `CORS_ORIGINS` and `WS_PATH`.
- Added `drivers` module with table, migration, REST endpoints, service, facade, and events.
- Added `location` module with authenticated Socket.IO gateway, Redis latest-location cache, GPS jump detection, Haversine helper, ack envelope, and events.
- Wired `@nestjs/event-emitter` for in-process domain events.

## Design Choices

Cache clearing on offline uses event inversion:

- `drivers` emits `driver.went-offline`.
- `location` listens to that event and clears `driver:location:{driverId}`.
- This keeps the dependency direction as `location -> drivers`; `drivers` does not import `location`.

Driver identity for WebSocket location writes is always taken from `socket.data.user.id`. The DTO does not declare `driverId`; if a payload includes `driverId`, the gateway strips it before validation and uses the authenticated id.

## Main Changed Areas

- `docker-compose.yml`
- `.env.example`
- `apps/backend/package.json`
- `pnpm-lock.yaml`
- `apps/backend/src/app.module.ts`
- `apps/backend/src/app.setup.ts`
- `apps/backend/src/config/env.validation.ts`
- `apps/backend/src/config/env.validation.spec.ts`
- `apps/backend/src/common/domain-event.ts`
- `apps/backend/src/infra/redis/*`
- `apps/backend/src/infra/socket-io/*`
- `apps/backend/src/database/database.module.ts`
- `apps/backend/src/database/data-source.ts`
- `apps/backend/src/database/migrations/1747200003000-CreateDriversTable.ts`
- `apps/backend/src/drivers/*`
- `apps/backend/src/location/*`

## Implemented Behavior

REST:

- `POST /api/v1/drivers/me/online`
- `POST /api/v1/drivers/me/offline`
- `GET /api/v1/drivers/me/availability`

WebSocket:

- Authenticates Socket.IO connections using JWT access token from `handshake.auth.token` or `Authorization: Bearer ...`.
- Rejects anonymous/invalid JWT with `WS_AUTH_FAILED`.
- Rejects non-DRIVER role with `WS_FORBIDDEN`.
- Joins valid drivers to `driver:{driverId}` room.
- Handles `driver.location.update`.
- Validates payload using the same whitelist/forbid/transform behavior as REST DTOs.
- Checks DB-backed driver online state through `DriversFacade`.
- Reads previous cached location from Redis.
- Applies stale timestamp, distance jump, and speed jump checks.
- Writes latest location as JSON to `driver:location:{driverId}` with TTL.
- Emits `driver.location-updated`.

## Tests Added

Added targeted unit coverage for:

- Env validation for Redis/location/WS config.
- `DriversService`.
- `DriversFacade`.
- `DriversController` and role guard behavior.
- `DriverLocationCacheService`.
- `haversine`.
- `GpsJumpDetectionService`.
- `LocationGateway` auth, role rejection, payload validation, online check, jump rejection, spoofed identity, Redis failure, and missing ack callback.

## Verification

Commands run:

```bash
pnpm install
pnpm lint
pnpm build
pnpm test
docker compose config
```

Results:

- `pnpm lint`: pass
- `pnpm build`: pass
- `pnpm test`: pass
- Test count: `23 suites, 177 tests passed`
- Delta from Task 003 review baseline: `128 -> 177` (`+49`)
- `docker compose config`: pass

## Notes / Risks

- I did not run `docker compose up`.
- I did not run the new migration against a live PostgreSQL database.
- No H3 logic was added.
- No OSRM logic was added.
- No matching engine, ride offers, customer location subscription, persistent driver location history, rate limiting, or frontend was added.
- The `drivers` table uses `ON DELETE CASCADE` to `users(id)` as specified by Task 004. This is worth review because the extraction checklist generally discourages cross-module cascade deletes, but the task explicitly required it.

