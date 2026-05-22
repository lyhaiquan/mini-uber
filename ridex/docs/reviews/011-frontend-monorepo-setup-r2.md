# Review: Task 011 - Frontend Monorepo + Shared Packages (Round 2)

**Task file:** `docs/tasks/011-frontend-monorepo-setup.md`
**Previous review:** `docs/reviews/011-frontend-monorepo-setup-r1.md`
**Implementer:** Claude (Opus 4.7)
**Reviewer:** self-review responding to Codex audit
**Date:** 2026-05-18

---

## Verdict: PASS (pending Codex re-audit)

All 5 blockers identified by Codex are fixed. Lint, build, test now green across both FE packages. Backend untouched.

Verification:

```text
pnpm install                                          → 958 packages, OK
pnpm --filter @ridex/shared-types lint                → clean
pnpm --filter @ridex/shared-types test                → 5 suites, 29 tests passed
pnpm --filter @ridex/shared-types build               → emitted dist/*.{js,d.ts,map}
pnpm --filter @ridex/ui-tokens lint                   → clean
pnpm --filter @ridex/ui-tokens build                  → emitted dist/*.{js,d.ts,map}
pnpm --filter @ridex/backend build                    → clean (backend unaffected)
pnpm exec turbo run lint                              → 2 successful tasks
pnpm exec turbo run test                              → 1 successful task
```

---

## Fixes Applied

### F-1 fixed: ESLint config resolution

**Cause:** ESLint v8 (configured in r1) requires shareable configs follow the `eslint-config-*` naming convention. `@ridex/config-eslint/package.js` matched no valid lookup pattern. Compounding this: the workspace mixed ESLint 8 (FE packages) with ESLint 9 (backend), and pnpm's strict mode placed plugin packages where ESLint's legacy resolver could not find them across packages.

**Fix:** migrated FE packages to ESLint 9 flat config — same toolchain backend already uses:

- `packages/config-eslint/package.json`:
  - `eslint` peer bumped: `^8.57.0` → `^9.17.0`
  - `@typescript-eslint/*` bumped: `^8.18.0` (matches backend)
  - `type: "module"`, exports map for `./package`, `./base`, `./next`, `./expo`
- `packages/config-eslint/base.mjs` (new): flat config — imports plugins directly via ES module, no ESLint name-resolution magic required.
- `packages/config-eslint/package.mjs` (new): library variant.
- Removed: `base.js`, `next.js`, `expo.js`, `package.js` (legacy `.eslintrc` chain).
- `packages/shared-types/eslint.config.mjs` + `packages/ui-tokens/eslint.config.mjs` (new): `import packageConfig from "@ridex/config-eslint/package"` — works in pnpm strict because flat config plugins are explicit imports, not string-name lookups.
- Removed: per-package `.eslintrc.cjs` files.
- `next.js`/`expo.js` variants intentionally NOT recreated; will be added in T012/T013 when web/expo apps actually exist (their plugins — `eslint-plugin-react`, `react-hooks`, `react-native`, `eslint-config-next` — are pulled in then to avoid dragging them into config-eslint before they're used).

**Why flat config:** backend already uses `eslint.config.mjs` (ESLint 9). Aligning FE removes the cross-package version conflict that surfaced when pnpm's hoist tried to satisfy both ESLint 8 and 9 from a single root copy.

### F-2 fixed: ride transition field name `targetStatus` → `toStatus`

`packages/shared-types/src/rides.ts` `transitionRideDtoSchema`:

```typescript
export const transitionRideDtoSchema = z
  .object({
    toStatus: rideStatusSchema,
    reason: z.string().max(500).optional(),
    expectedVersion: z.number().int().min(0).optional()
  })
  .strict();
```

Three corrections in one block:
1. Field rename `targetStatus → toStatus` matches `apps/backend/src/rides/dto/transition-ride.dto.ts:7` (`@IsEnum(RideStatus) toStatus!: RideStatus`).
2. `reason` max length tightened from 512 → **500** to match backend `@MaxLength(500)` at line 11.
3. `.strict()` added so the FE catches typos client-side instead of getting a backend 400 from `forbidNonWhitelisted: true`.

Test added: `rides.spec.ts` "transition DTO is strict — rejects unknown fields like `targetStatus`" + the inverse positive case.

### F-3 fixed: WebSocket location ack shape

`packages/shared-types/src/drivers.ts`:

```typescript
export const locationAckSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true) }),
  z.object({
    ok: z.literal(false),
    error: z.object({
      code: locationErrorCodeSchema,
      message: z.string()
    })
  })
]);
```

Matches backend exactly: `apps/backend/src/location/dto/driver-location-ack.dto.ts:9-17` declares `{ ok: true } | { ok: false, error: { code, message } }`. The old `{ accepted, recordedAt }` shape was fabricated.

`locationErrorCodeSchema` enumerates the 6 codes the backend can emit (`INVALID_PAYLOAD`, `DRIVER_OFFLINE`, `STALE_TIMESTAMP`, `GPS_JUMP_DISTANCE`, `GPS_JUMP_SPEED`, `INTERNAL`) so the FE can render code-specific UI.

Also added `.strict()` to `driverLocationDtoSchema` and `driverOnlineDtoSchema` — backend's `OfferGateway.stripSpoofedDriverId()` already drops spoofed `driverId`/`driverUserId` server-side, but client-side strictness keeps payloads clean and predictable.

### F-4 fixed: WebSocket offer event names + payloads

`packages/shared-types/src/events.ts` was rewritten from scratch after auditing `apps/backend/src/matching/gateways/offer.gateway.ts` and `apps/backend/src/location/gateways/location.gateway.ts`.

**Backend reality (verified by reading the gateway files):**

| Direction | Event name | Payload | Source |
|---|---|---|---|
| Server → driver | `ride.offer.received` | `OfferReceivedPayload` | offer.gateway.ts:119 |
| Server → driver | `ride.offer.cancelled` | `OfferCancelledPayload` | offer.gateway.ts:123 |
| Server → driver | `ride.offer.error` | `OfferErrorPayload` | offer.gateway.ts:243 |
| Driver → server | `ride.offer.accept` | `OfferActionDto` (ack `{ok}|{ok,error}`) | offer.gateway.ts:126 |
| Driver → server | `ride.offer.reject` | `OfferActionDto` (ack `{ok}|{ok,error}`) | offer.gateway.ts:152 |
| Driver → server | `driver.location.update` | `DriverLocationDto` (ack `LocationAck`) | location.gateway.ts:127 |
| Server → any | `ws:error` | `{ code, message }` | location.gateway.ts:240 |

**Not yet emitted by backend (flagged as `FUTURE_WS_EVENTS`):**

- `ride.status-changed` — needed by T018 (customer ride tracking). Internal NestJS EventEmitter event `RIDE_OFFER_CREATED_EVENT = "ride.offer.created"` IS broadcast but it stays in-process. WS fan-out is a T018 backend addon.
- `driver.location-updated` — needed by T018 too. Same situation: backend emits internally via `EventEmitter2` (`DRIVER_LOCATION_UPDATED_EVENT`), but does not forward to a customer WS room.

These two forward declarations are kept in `events.ts` under `FUTURE_WS_EVENTS` with payload schemas so T018's backend addon and FE code can land in the same PR cycle. Listeners must NOT subscribe to these names until the backend addon lands.

The old `WS_EVENTS.RIDE_OFFER_CREATED = "ride.offer.created"` and the old payload (`pickup/destination` as `{lat,lng,address}` instead of `{lat,lng}`, plus an estimated fare field that doesn't exist) are removed.

Tests added: `events.spec.ts` × 6 cases, including a strict-rejection test for spoofed `driverId` in `OfferActionDto`.

### F-5 fixed: register DTO drops `role`

`packages/shared-types/src/auth.ts`:

```typescript
export const registerDtoSchema = z
  .object({
    email: z.string().email().max(254),
    password: z.string().min(8).max(128)
  })
  .strict();
```

Matches backend `RegisterDto` exactly. `.strict()` catches any client-side `role` field before the request hits the backend's `forbidNonWhitelisted: true` rejection. Test added: `auth.spec.ts` "RegisterDto is strict — rejects `role` field".

---

## Files added / changed

```
Added:
  packages/config-eslint/base.mjs
  packages/config-eslint/package.mjs
  packages/shared-types/eslint.config.mjs
  packages/ui-tokens/eslint.config.mjs
  packages/shared-types/src/__tests__/drivers.spec.ts
  packages/shared-types/src/__tests__/events.spec.ts

Changed:
  packages/config-eslint/package.json   (ESM, exports map, ESLint 9, typescript-eslint v8)
  packages/shared-types/package.json    (eslint 9, lint script simplified to `eslint .`)
  packages/ui-tokens/package.json       (same)
  packages/shared-types/src/auth.ts     (registerDtoSchema strict, no role)
  packages/shared-types/src/rides.ts    (toStatus, strict, reason cap 500)
  packages/shared-types/src/drivers.ts  (locationAck discriminated union, strict)
  packages/shared-types/src/events.ts   (full rewrite to match backend gateway reality)
  packages/shared-types/src/__tests__/auth.spec.ts  (new strict test)
  packages/shared-types/src/__tests__/rides.spec.ts (toStatus + strict tests)

Removed:
  packages/config-eslint/base.js, next.js, expo.js, package.js  (legacy)
  packages/shared-types/.eslintrc.cjs   (legacy)
  packages/ui-tokens/.eslintrc.cjs      (legacy)
  .npmrc                                (no longer needed with flat config)
```

---

## Counts

- Tests: 14 → **29** passing across 5 suites.
- Lint: 0 errors, 0 warnings.
- TypeScript: strict mode, no errors.

---

## Items Codex should re-audit in r2

1. **Confirm flat config decision.** Backend uses `eslint.config.mjs` (ESLint 9) so this aligns. If Codex prefers staying on legacy `.eslintrc.*` for FE, raise it; otherwise the toolchain is consistent.
2. **Confirm `FUTURE_WS_EVENTS` placement.** They are forward-declared but explicitly labelled as "NOT yet emitted." The alternative is to defer the schemas entirely to T018 and not export anything. I kept them so T018 can lean on the same shapes without re-deciding payload structure. Codex: please flag if you'd prefer them excluded.
3. **`reason` max length=500.** Cross-checked backend at `transition-ride.dto.ts:11`. OfferActionDto uses `MaxLength(200)` (verified separately in `events.ts`). Both now match.
4. **`.strict()` everywhere.** Applied to all client→server DTOs (CreateRide* still missing — backend `CreateRideDto` validates nested objects, so I left it permissive; let me know if `.strict()` should be added).
5. **No more `@types/node` concern.** All consumer packages declare it; pnpm doesn't conflict because backend uses `@types/node@22` and FE uses `@types/node@20` — pnpm keeps them isolated.

Round-2 verification command for Codex (copy-paste):

```
pnpm install
pnpm --filter @ridex/backend build
pnpm --filter @ridex/backend test
pnpm --filter @ridex/shared-types lint
pnpm --filter @ridex/shared-types test
pnpm --filter @ridex/shared-types build
pnpm --filter @ridex/ui-tokens lint
pnpm --filter @ridex/ui-tokens build
pnpm exec turbo run lint
pnpm exec turbo run test
```

If all green, T011 is unblocked and T012 + T013 can proceed.
