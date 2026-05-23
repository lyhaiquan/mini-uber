# Review 015 — Mapbox Integration (R1)

Verdict: PASS WITH FIXES

## Summary

Claude self-implemented Task 015 in a single pass. Cross-platform map primitives shipped to `@ridex/ui-web` (react-map-gl@7) and `@ridex/ui-mobile` (@rnmapbox/maps@~10.2.10) with a shared `MapView` prop shape, `MapMarker`, `MapRoute`, `LocationSearch` (Mapbox geocoding, country=VN, debounce 250ms, abortable), and `useCurrentLocation` + (mobile) `useLocationPermission` hooks. All 4 non-admin surfaces wired: customer apps pick pickup/destination + straight-line placeholder route; driver apps show self marker. Mapbox token placeholder + permission plugins added to both `app.json` files; READMEs updated with prebuild + dev-client instructions.

Total FE tests: ~47 passing (was ~34). Task 015 contribution: +9 ui-web (use-current-location, location-search, map-view) and +4 ui-mobile (use-location-permission, use-current-location). All web prod builds clean (web-customer 186 kB First Load, web-driver same). Lint warnings 0 (all import-order auto-fixed). All type-checks clean.

## Blockers

None.

## Must fix

None for merge. The fixes already applied during R1:

1. **react-map-gl import path** — initial spec referenced `react-map-gl/mapbox` (v8 path); installed v7.1.9 uses bare `react-map-gl`. Fixed.
2. **@rnmapbox/maps peer dep** — `^10.1.30` resolved to 10.3.1, requires RN>=0.79; pinned to `~10.2.10` (RN>=0.69 OK).
3. **TS narrowing for RN MapView onPress** — refactored callback to narrow `feature.geometry.type === "Point"` before destructuring (was specifying `<Point>` generic which conflicted with rnmapbox's `Feature<Geometry>` signature).
4. **Multi-React-copies in jest** — ui-mobile previously used `react-test-renderer`-only. Added `jest-environment-jsdom` + `@testing-library/react@16` + `react-dom@18.3.1` devDeps, switched env to jsdom, and added moduleNameMapper to dedupe `react`/`react-dom` to root copies. `IS_REACT_ACT_ENVIRONMENT=true` set via `jest.setup.js`.
5. **Infinite-render loop in `useCurrentLocation` (mobile)** — initial effect deps included the whole `permission` object; destructured to scalar `permissionStatus`/`permissionLoading`/`request` to break re-render cycle.

## Should improve (non-blocking)

- **SI-1: Reverse geocoding deferred** — Customer picks a coord by click, but no reverse lookup → marker shows lat/lng instead of address. Spec lists this as out-of-scope. Consider for T017 polish (display "Quận 1, TP HCM" instead of `10.776, 106.701`).
- **SI-2: Web `useCurrentLocation` ignores `denied` distinction** — Browser timeout error and permission denied both surface as `status: "denied"`. Acceptable for placeholder UX but should distinguish before T018 driver-mobile geolocation continuous streaming.
- **SI-3: Driver heading hard-coded `0`** — Both web and mobile driver maps pass `heading: 0`. Real heading needs `expo-location.watchHeadingAsync` / web `DeviceOrientationEvent`. Defer to T019 (driver online + location stream).
- **SI-4: LocationSearch dropdown not keyboard-accessible** — `<li role="option">` uses `onMouseDown` only. Add `onKeyDown` (Enter/ArrowDown) for a11y. Web only.
- **SI-5: Mapbox token in NEXT_PUBLIC env** — Bundled into client JS. Spec mandates Mapbox dashboard domain restriction. README should be more emphatic that token is publicly visible to any visitor.

## Nice to have

- **NTH-1: Mapbox style toggle (light/dark)** — Currently fixed to `streets-v12`. Could mirror `next-themes` colorScheme.
- **NTH-2: Cluster marker primitive** — Will be needed when driver index renders many drivers in admin map (T010 admin map is not in current scope).
- **NTH-3: Geocoding result icon** — Show poi/address category icon next to each suggestion.

## Security Notes

- Token: only `pk.*` public token used FE-side. README warn user to set domain restriction. ✅
- Geocoding query KHÔNG log full search text (no console.log in code). ✅
- Reverse geocoding: not implemented (out of scope). ✅
- WebSocket auth, RBAC, payment idempotency: N/A for this task. ✅

## Database

No schema changes. ✅

## Deferred to next task

- **Manual smoke on real Mapbox token** — User must drop a real `pk.*` into `.env.local` and run `pnpm --filter @ridex/web-customer dev` to verify map actually renders. Code path tested via mocks only.
- **Mobile native run** — Requires `expo prebuild --clean` + EAS dev client (macOS for iOS). Code is wired but not yet built on a device. README documents the steps.
- **Real route geometry** — `home-map.tsx` draws a straight `LineString` between pickup+destination. T017 will replace with OSRM polyline from `POST /rides/quote`.

## Exact instructions for Codex

N/A — Claude self-implemented. If Codex picks this up next, the remaining work for related tasks is:

- T016 (api-client + TanStack Query): build `@ridex/api-client` package consumers of the map components will use to call `POST /rides/quote`.
- T017 (customer request ride): replace straight LineString in `home-map.tsx` with OSRM polyline + fare card.
- T019 (driver online + location stream): wire `expo-location.watchPositionAsync` → WS `driver.location-updated`, also wire heading.
