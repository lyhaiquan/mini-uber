# Task 015 — Mapbox Integration Implementation Plan

> **For Codex / agentic workers:** Execute task-by-task in order. Steps use checkbox (`- [ ]`) syntax for tracking. After each task: commit, run lint+test+type-check on touched workspaces, mark step complete, move on.
>
> **Spec source:** `docs/tasks/015-mapbox-integration.md`. The plan implements the spec verbatim — do not extend scope.

> **Review patches (2026-05-22) — search this file for the markers C1, C2, C4, C5, C6, C8 before executing each task:**
> - **C1** (Task 12 step 2): vitest matcher extended to cover `src/lib/__tests__/use-*.spec.ts` so the pickup-destination store test runs under jsdom.
> - **C2** (Tasks 5 & 10): call `setTelemetryEnabled(false)` on both mapbox-gl (web) and `@rnmapbox/maps` (mobile) after setting the access token, to honour the spec's privacy requirement.
> - **C4** (Task 4): `useCurrentLocation` (web) guards setState with a `cancelledRef` so a late geolocation callback after unmount does not throw.
> - **C5** (Tasks 12 & 13): web home pages lazy-load the map composition via `next/dynamic({ ssr: false })` to keep ~250 kB of mapbox-gl out of the landing/login bundle.
> - **C6** (Task 13): driver self-marker ships without heading rotation in T015; T019 will wire `bearingDeg` once realtime location includes `heading`.
> - **C8** (Task 14): app-level Jest mocks live in `apps/mobile-*/__mocks__/<module>.js` instead of being merged into `jest.setup.js`. Do not point `moduleNameMapper` at the setup file.
>
> C3 (permission gating flow) and C7 (geocoding token in query string) are accepted trade-offs and need no code change.

**Goal:** 4 surface (web-customer, web-driver, mobile-customer, mobile-driver) render Mapbox map với current-location, click-to-set markers (customer side), geocoding search bar, permission flow đầy đủ trên mobile. Admin app KHÔNG có map.

**Architecture:** Shared `MapViewProps` API trong `@ridex/shared-types`. Hai implementation song song: `@ridex/ui-web` (mapbox-gl + react-map-gl) và `@ridex/ui-mobile` (@rnmapbox/maps). Geocoding gọi Mapbox API trực tiếp từ FE với public token. Mỗi app consume primitives qua per-surface composition components. Pickup/destination state ở client (Zustand) — không call backend route service ở task này (defer T017).

**Tech Stack:**
- Web: `mapbox-gl@^3.8.0`, `react-map-gl@^7.1.7`, `@types/mapbox-gl@^3.4.0`
- Mobile: `@rnmapbox/maps@^10.1.33`, `expo-location@~18.0.4`
- Test: Vitest jsdom (web), ts-jest (mobile) với mocks
- State: Zustand (đã có cả 2 side)

---

## File Structure

### Created

```
packages/shared-types/src/
  geo.ts                                  # latLngSchema, markerSchema, MapViewProps

packages/ui-web/src/components/map/
  map-view.tsx                            # react-map-gl wrapper
  map-marker.tsx                          # custom DOM marker
  map-route.tsx                           # GeoJSON LineString layer
  location-search.tsx                     # debounced geocoding combobox
  use-current-location.ts                 # navigator.geolocation hook
  index.ts                                # barrel exports
packages/ui-web/src/components/map/__tests__/
  use-current-location.spec.ts
  map-view.spec.tsx
  location-search.spec.tsx

packages/ui-mobile/src/components/map/
  map-view.tsx                            # MapView from @rnmapbox/maps
  map-marker.tsx                          # PointAnnotation
  map-route.tsx                           # ShapeSource + LineLayer
  location-search.tsx                     # FlatList + Mapbox geocoding
  use-current-location.ts                 # expo-location hook
  use-location-permission.ts              # permission state machine
  index.ts                                # barrel exports
packages/ui-mobile/__tests__/             # existing top-level __tests__ dir, NOT under src
  use-location-permission.test.tsx
  use-current-location.test.tsx
  location-search.test.ts
packages/ui-mobile/__mocks__/
  @rnmapbox-maps.tsx                      # jest mock for @rnmapbox/maps
  expo-location.ts                        # jest mock for expo-location

apps/web-customer/src/
  components/home/home-map.tsx
  lib/use-pickup-destination-store.ts
apps/web-driver/src/
  components/home/driver-map.tsx
apps/mobile-customer/src/lib/
  use-pickup-destination-store.ts

docs/plans/
  015-mapbox-integration.md               # this file
```

### Modified

```
packages/shared-types/src/index.ts        # +export geo
packages/ui-web/package.json              # +mapbox-gl, +react-map-gl, +@types/mapbox-gl
packages/ui-web/src/index.ts              # +export map primitives
packages/ui-web/vitest.config.ts          # +environmentMatchGlobs map/**
packages/ui-mobile/package.json           # +peer @rnmapbox/maps, +peer expo-location, +shared-types dep
packages/ui-mobile/src/index.ts           # +export map primitives
packages/ui-mobile/jest.config.js         # +moduleNameMapper for @rnmapbox/maps + expo-location + shared-types

apps/web-customer/package.json            # +@testing-library/react, +jsdom, +mapbox-gl + react-map-gl (transitive ok via ui-web peer, but apps need direct for type)
apps/web-customer/src/lib/env.ts          # NEXT_PUBLIC_MAPBOX_TOKEN: required (was optional)
apps/web-customer/vitest.config.ts        # +plugin-react, +environmentMatchGlobs
apps/web-customer/src/app/(app)/home/page.tsx  # render <HomeMap/>
apps/web-customer/.env.local.example      # token doc

apps/web-driver/package.json              # same as customer
apps/web-driver/src/lib/env.ts            # token required
apps/web-driver/vitest.config.ts          # plugin-react + jsdom matcher
apps/web-driver/src/app/(app)/home/page.tsx  # render <DriverMap/>
apps/web-driver/.env.local.example

apps/mobile-customer/package.json         # +@rnmapbox/maps, +expo-location, +expo-linking
apps/mobile-customer/app.json             # +plugin @rnmapbox/maps + expo-location, +iOS NSLocationWhenInUseUsageDescription, +Android ACCESS_FINE_LOCATION
apps/mobile-customer/src/lib/env.ts       # mapboxToken: required
apps/mobile-customer/__mocks__/@rnmapbox-maps.js   # NEW — module mock (C8)
apps/mobile-customer/__mocks__/expo-location.js    # NEW — module mock (C8)
apps/mobile-customer/__mocks__/expo-linking.js     # NEW — module mock (C8)
apps/mobile-customer/jest.config.js       # +moduleNameMapper for __mocks__ above
apps/mobile-customer/app/(tabs)/home.tsx  # render MapView + permission flow
apps/mobile-customer/README.md            # expo prebuild + dev client docs

apps/mobile-driver/package.json
apps/mobile-driver/app.json
apps/mobile-driver/src/lib/env.ts
apps/mobile-driver/__mocks__/@rnmapbox-maps.js     # NEW — same shape as customer (C8)
apps/mobile-driver/__mocks__/expo-location.js      # NEW
apps/mobile-driver/__mocks__/expo-linking.js       # NEW
apps/mobile-driver/jest.config.js
apps/mobile-driver/app/(tabs)/home.tsx    # render self-marker MapView
apps/mobile-driver/README.md
```

### Total

- New files: ~22
- Modified files: ~25
- Test target: ~12 new tests (3 web + 3 mobile per side ≈ matches spec ~10)

---

## Shared Type Contract

```typescript
// packages/shared-types/src/geo.ts
import { z } from "zod";

export const latLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180)
});
export type LatLng = z.infer<typeof latLngSchema>;

export const mapMarkerKindSchema = z.enum(["pickup", "destination", "driver", "generic"]);
export type MapMarkerKind = z.infer<typeof mapMarkerKindSchema>;

export const mapMarkerSchema = z.object({
  id: z.string().min(1),
  position: latLngSchema,
  kind: mapMarkerKindSchema,
  label: z.string().optional(),
  bearingDeg: z.number().min(0).max(360).optional()
});
export type MapMarker = z.infer<typeof mapMarkerSchema>;

export const DEFAULT_MAP_CENTER: LatLng = { lat: 10.7769, lng: 106.7009 }; // Sài Gòn
export const DEFAULT_MAP_ZOOM = 13;
export const DEFAULT_MAP_STYLE = "mapbox://styles/mapbox/streets-v12";

export type MapViewProps = {
  initialCenter?: LatLng;
  initialZoom?: number;
  markers?: MapMarker[];
  routeGeoJson?: GeoJSON.LineString | null;
  onMapClick?: (point: LatLng) => void;
  followUserLocation?: boolean;
  styleUrl?: string;
  testID?: string;
};
```

---

## Task 1 — Shared geo types

**Files:**
- Create: `packages/shared-types/src/geo.ts`
- Modify: `packages/shared-types/src/index.ts`
- Test: `packages/shared-types/src/__tests__/geo.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/shared-types/src/__tests__/geo.spec.ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_STYLE,
  DEFAULT_MAP_ZOOM,
  latLngSchema,
  mapMarkerSchema
} from "../geo";

describe("geo schemas", () => {
  it("accepts valid lat/lng", () => {
    expect(latLngSchema.parse({ lat: 10.78, lng: 106.7 })).toEqual({
      lat: 10.78,
      lng: 106.7
    });
  });

  it("rejects out-of-range latitude", () => {
    expect(() => latLngSchema.parse({ lat: 95, lng: 0 })).toThrow();
  });

  it("requires marker id, position and kind", () => {
    expect(() =>
      mapMarkerSchema.parse({ position: { lat: 0, lng: 0 }, kind: "pickup" })
    ).toThrow();
  });

  it("accepts pickup marker without bearing", () => {
    const m = mapMarkerSchema.parse({
      id: "p1",
      position: { lat: 10, lng: 106 },
      kind: "pickup"
    });
    expect(m.kind).toBe("pickup");
    expect(m.bearingDeg).toBeUndefined();
  });

  it("exposes Saigon default center constants", () => {
    expect(DEFAULT_MAP_CENTER).toEqual({ lat: 10.7769, lng: 106.7009 });
    expect(DEFAULT_MAP_ZOOM).toBe(13);
    expect(DEFAULT_MAP_STYLE).toBe("mapbox://styles/mapbox/streets-v12");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ridex/shared-types test`
Expected: FAIL with "Cannot find module '../geo'".

- [ ] **Step 3: Create `geo.ts` with the schema from the "Shared Type Contract" section above**

Paste the file contents shown in **Shared Type Contract** above into `packages/shared-types/src/geo.ts` verbatim.

- [ ] **Step 4: Re-export from `index.ts`**

Append to `packages/shared-types/src/index.ts`:
```typescript
export * from "./geo";
```

- [ ] **Step 5: Run tests + type-check**

```bash
pnpm --filter @ridex/shared-types test
pnpm --filter @ridex/shared-types type-check
```
Expected: PASS, 5 new tests.

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types/src/geo.ts packages/shared-types/src/index.ts \
  packages/shared-types/src/__tests__/geo.spec.ts
git commit -m "feat(shared-types): add geo schemas (LatLng, MapMarker, defaults)"
```

---

## Task 2 — Mapbox env config (web + mobile)

**Files:**
- Modify: `apps/web-customer/src/lib/env.ts`, `apps/web-driver/src/lib/env.ts`
- Modify: `apps/mobile-customer/src/lib/env.ts`, `apps/mobile-driver/src/lib/env.ts`
- Modify: `apps/mobile-customer/app.json`, `apps/mobile-driver/app.json`
- Modify: `apps/web-customer/.env.local.example`, `apps/web-driver/.env.local.example`

- [ ] **Step 1: Update web env schemas to require Mapbox token**

`apps/web-customer/src/lib/env.ts` and `apps/web-driver/src/lib/env.ts`: change the schema to require a non-empty `pk.` token:
```typescript
NEXT_PUBLIC_MAPBOX_TOKEN: z.string().regex(/^pk\./, "Phải dùng public token (pk.*)").min(20)
```

Update the fallback object to include `NEXT_PUBLIC_MAPBOX_TOKEN: ""` (will fail at runtime if invalid, with `console.error`, but won't crash dev).

- [ ] **Step 2: Update mobile env schemas**

`apps/mobile-customer/src/lib/env.ts` and `apps/mobile-driver/src/lib/env.ts`: change `mapboxToken: z.string().min(20).optional().or(z.literal(""))` → `mapboxToken: z.string().regex(/^pk\./).min(20)`. Update fallback to `mapboxToken: ""`.

- [ ] **Step 3: Update mobile app.json (both apps)**

For each `apps/mobile-customer/app.json` and `apps/mobile-driver/app.json`:

1. Add to `expo.plugins` array (replacing existing array):
```json
"plugins": [
  "expo-router",
  "expo-secure-store",
  ["expo-location", { "locationWhenInUsePermission": "RideX cần vị trí để hiển thị bản đồ và tìm xe gần bạn." }],
  ["@rnmapbox/maps", { "RNMapboxMapsDownloadToken": "" }]
]
```

2. Add iOS `infoPlist` keys (merge into existing `expo.ios.infoPlist`):
```json
"NSLocationWhenInUseUsageDescription": "RideX cần vị trí để hiển thị bản đồ và tìm xe gần bạn."
```

3. Add Android permissions array under `expo.android`:
```json
"permissions": ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"]
```

- [ ] **Step 4: Update `.env.local.example` for web-customer, web-driver, web-admin**

The line `NEXT_PUBLIC_MAPBOX_TOKEN=pk.your-token-here` already exists in web-customer. Verify same line exists in `apps/web-driver/.env.local.example` and `apps/web-admin/.env.local.example`. Add if missing.

- [ ] **Step 5: Re-run existing env tests**

```bash
pnpm --filter @ridex/web-customer test
pnpm --filter @ridex/mobile-customer test
```
Expected: PASS (existing env tests use fallback path, unaffected).

- [ ] **Step 6: Commit**

```bash
git add apps/web-customer/src/lib/env.ts apps/web-driver/src/lib/env.ts \
  apps/mobile-customer/src/lib/env.ts apps/mobile-driver/src/lib/env.ts \
  apps/mobile-customer/app.json apps/mobile-driver/app.json \
  apps/web-customer/.env.local.example apps/web-driver/.env.local.example \
  apps/web-admin/.env.local.example
git commit -m "feat(env): require Mapbox public token + iOS/Android location permissions"
```

---

## Task 3 — `@ridex/ui-web` deps + vitest config

**Files:**
- Modify: `packages/ui-web/package.json`
- Modify: `packages/ui-web/vitest.config.ts`

- [ ] **Step 1: Add map dependencies**

Edit `packages/ui-web/package.json`. Under `"dependencies"`, add:
```json
"mapbox-gl": "^3.8.0",
"react-map-gl": "^7.1.7"
```
Under `"devDependencies"`, add:
```json
"@types/mapbox-gl": "^3.4.0"
```

- [ ] **Step 2: Update vitest.config.ts to include map tests under jsdom**

Replace `packages/ui-web/vitest.config.ts` body with:
```typescript
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.spec.{ts,tsx}"],
    environmentMatchGlobs: [
      ["src/**/auth-form.spec.tsx", "jsdom"],
      ["src/components/map/__tests__/**", "jsdom"]
    ]
  }
});
```

- [ ] **Step 3: Install**

```bash
pnpm install
```
Expected: lockfile updated, mapbox-gl + react-map-gl resolved.

- [ ] **Step 4: Commit**

```bash
git add packages/ui-web/package.json packages/ui-web/vitest.config.ts pnpm-lock.yaml
git commit -m "chore(ui-web): add mapbox-gl + react-map-gl deps"
```

---

## Task 4 — `useCurrentLocation` hook (web)

**Files:**
- Create: `packages/ui-web/src/components/map/use-current-location.ts`
- Test: `packages/ui-web/src/components/map/__tests__/use-current-location.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
/**
 * @vitest-environment jsdom
 */
// packages/ui-web/src/components/map/__tests__/use-current-location.spec.ts
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCurrentLocation } from "../use-current-location";

const geolocationMock = {
  getCurrentPosition: vi.fn()
};

beforeEach(() => {
  geolocationMock.getCurrentPosition.mockReset();
  vi.stubGlobal("navigator", { geolocation: geolocationMock });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useCurrentLocation (web)", () => {
  it("returns coords after geolocation success", async () => {
    geolocationMock.getCurrentPosition.mockImplementationOnce((onSuccess) => {
      onSuccess({ coords: { latitude: 10.5, longitude: 106.6 } });
    });
    const { result } = renderHook(() => useCurrentLocation());
    await act(async () => {
      result.current.request();
    });
    await waitFor(() => expect(result.current.coords).toEqual({ lat: 10.5, lng: 106.6 }));
    expect(result.current.status).toBe("ready");
    expect(result.current.error).toBeNull();
  });

  it("returns error when geolocation denied", async () => {
    geolocationMock.getCurrentPosition.mockImplementationOnce((_ok, onError) => {
      onError({ code: 1, message: "User denied" });
    });
    const { result } = renderHook(() => useCurrentLocation());
    await act(async () => {
      result.current.request();
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.coords).toBeNull();
    expect(result.current.error).toBe("denied");
  });

  it("returns 'unsupported' status when navigator.geolocation missing", async () => {
    vi.stubGlobal("navigator", {});
    const { result } = renderHook(() => useCurrentLocation());
    await act(async () => {
      result.current.request();
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("unsupported");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @ridex/ui-web test
```
Expected: FAIL with "Cannot find module '../use-current-location'".

- [ ] **Step 3: Implement the hook**

```typescript
// packages/ui-web/src/components/map/use-current-location.ts
"use client";
import * as React from "react";
import type { LatLng } from "@ridex/shared-types";

type Status = "idle" | "loading" | "ready" | "error";
type ErrorKind = "denied" | "unavailable" | "timeout" | "unsupported";

export interface UseCurrentLocationResult {
  status: Status;
  coords: LatLng | null;
  error: ErrorKind | null;
  request: () => void;
}

export function useCurrentLocation(): UseCurrentLocationResult {
  const [status, setStatus] = React.useState<Status>("idle");
  const [coords, setCoords] = React.useState<LatLng | null>(null);
  const [error, setError] = React.useState<ErrorKind | null>(null);

  const cancelledRef = React.useRef(false);

  React.useEffect(() => {
    cancelledRef.current = false;
    return () => {
      // C4: prevent setState on unmounted component when geolocation resolves late.
      cancelledRef.current = true;
    };
  }, []);

  const request = React.useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("error");
      setError("unsupported");
      return;
    }
    setStatus("loading");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelledRef.current) return;
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("ready");
      },
      (err) => {
        if (cancelledRef.current) return;
        const kind: ErrorKind =
          err.code === 1 ? "denied" : err.code === 3 ? "timeout" : "unavailable";
        setError(kind);
        setStatus("error");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 30_000 }
    );
  }, []);

  return { status, coords, error, request };
}
```

- [ ] **Step 4: Run test, expect PASS**

```bash
pnpm --filter @ridex/ui-web test
```
Expected: 3 new tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui-web/src/components/map/use-current-location.ts \
  packages/ui-web/src/components/map/__tests__/use-current-location.spec.ts
git commit -m "feat(ui-web): add useCurrentLocation hook with status state machine"
```

---

## Task 5 — `MapView` web component

**Files:**
- Create: `packages/ui-web/src/components/map/map-view.tsx`
- Create: `packages/ui-web/src/components/map/index.ts`
- Modify: `packages/ui-web/src/index.ts`
- Test: `packages/ui-web/src/components/map/__tests__/map-view.spec.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
/**
 * @vitest-environment jsdom
 */
// packages/ui-web/src/components/map/__tests__/map-view.spec.tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("react-map-gl", () => ({
  __esModule: true,
  default: ({ onClick, children, "data-testid": testId }: any) => (
    <div data-testid={testId ?? "rmgl"} onClick={() => onClick?.({ lngLat: { lat: 1, lng: 2 } })}>
      {children}
    </div>
  ),
  NavigationControl: () => <div data-testid="nav-control" />,
  Marker: ({ children }: any) => <div data-testid="marker">{children}</div>,
  Source: ({ children }: any) => <div data-testid="source">{children}</div>,
  Layer: () => <div data-testid="layer" />
}));

import { MapView } from "../map-view";

afterEach(cleanup);

describe("MapView (web)", () => {
  it("renders react-map-gl wrapper with NavigationControl", () => {
    render(<MapView accessToken="pk.test" testID="mv" />);
    expect(screen.getByTestId("mv")).toBeTruthy();
    expect(screen.getByTestId("nav-control")).toBeTruthy();
  });

  it("invokes onMapClick with LatLng on click", () => {
    const onMapClick = vi.fn();
    render(<MapView accessToken="pk.test" testID="mv" onMapClick={onMapClick} />);
    screen.getByTestId("mv").click();
    expect(onMapClick).toHaveBeenCalledWith({ lat: 1, lng: 2 });
  });

  it("renders one marker per props.markers entry", () => {
    render(
      <MapView
        accessToken="pk.test"
        markers={[
          { id: "p", position: { lat: 0, lng: 0 }, kind: "pickup" },
          { id: "d", position: { lat: 1, lng: 1 }, kind: "destination" }
        ]}
      />
    );
    expect(screen.getAllByTestId("marker")).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

```bash
pnpm --filter @ridex/ui-web test
```
Expected: FAIL — module `../map-view` not found.

- [ ] **Step 3: Implement `MapView`**

```typescript
// packages/ui-web/src/components/map/map-view.tsx
"use client";
import mapboxgl from "mapbox-gl";
import * as React from "react";
import Map, { Layer, Marker, NavigationControl, Source } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_STYLE,
  DEFAULT_MAP_ZOOM,
  type MapViewProps
} from "@ridex/shared-types";

import { MapMarker } from "./map-marker";

// C2: privacy — disable mapbox-gl telemetry once at module load.
if (typeof window !== "undefined") {
  (mapboxgl as unknown as { setTelemetryEnabled?: (v: boolean) => void }).setTelemetryEnabled?.(
    false
  );
}

export interface WebMapViewProps extends MapViewProps {
  accessToken: string;
  className?: string;
}

export function MapView({
  accessToken,
  initialCenter = DEFAULT_MAP_CENTER,
  initialZoom = DEFAULT_MAP_ZOOM,
  styleUrl = DEFAULT_MAP_STYLE,
  markers = [],
  routeGeoJson,
  onMapClick,
  testID,
  className
}: WebMapViewProps) {
  return (
    <div className={className ?? "h-full w-full"} data-testid={testID}>
      <Map
        mapboxAccessToken={accessToken}
        initialViewState={{
          latitude: initialCenter.lat,
          longitude: initialCenter.lng,
          zoom: initialZoom
        }}
        mapStyle={styleUrl}
        onClick={(evt) => onMapClick?.({ lat: evt.lngLat.lat, lng: evt.lngLat.lng })}
        data-testid={testID}
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" />
        {markers.map((m) => (
          <Marker key={m.id} latitude={m.position.lat} longitude={m.position.lng}>
            <MapMarker kind={m.kind} label={m.label} bearingDeg={m.bearingDeg} />
          </Marker>
        ))}
        {routeGeoJson ? (
          <Source id="route" type="geojson" data={routeGeoJson}>
            <Layer
              id="route-line"
              type="line"
              paint={{ "line-color": "#0a84ff", "line-width": 4 }}
            />
          </Source>
        ) : null}
      </Map>
    </div>
  );
}
```

- [ ] **Step 4: Create `MapMarker` and `MapRoute` stubs to unblock import**

```typescript
// packages/ui-web/src/components/map/map-marker.tsx
"use client";
import type { MapMarkerKind } from "@ridex/shared-types";

const COLOR_BY_KIND: Record<MapMarkerKind, string> = {
  pickup: "#0a84ff",
  destination: "#000000",
  driver: "#10b981",
  generic: "#6c6c70"
};

export interface MapMarkerProps {
  kind: MapMarkerKind;
  label?: string;
  bearingDeg?: number;
}

export function MapMarker({ kind, label, bearingDeg }: MapMarkerProps) {
  const color = COLOR_BY_KIND[kind];
  const shape = kind === "destination" ? "0" : "9999px";
  return (
    <div
      style={{
        width: 18,
        height: 18,
        background: color,
        borderRadius: shape,
        border: "2px solid white",
        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        transform: bearingDeg ? `rotate(${bearingDeg}deg)` : undefined
      }}
      aria-label={label ?? kind}
    />
  );
}
```

```typescript
// packages/ui-web/src/components/map/map-route.tsx
// Currently no extra wrapper needed — MapView renders Source/Layer directly.
// File reserved for future custom layer styling (T017+).
export {};
```

- [ ] **Step 5: Barrel exports**

```typescript
// packages/ui-web/src/components/map/index.ts
export { MapView } from "./map-view";
export type { WebMapViewProps } from "./map-view";
export { MapMarker } from "./map-marker";
export type { MapMarkerProps } from "./map-marker";
export { useCurrentLocation } from "./use-current-location";
export type { UseCurrentLocationResult } from "./use-current-location";
```

Append to `packages/ui-web/src/index.ts`:
```typescript
export * from "./components/map";
```

- [ ] **Step 6: Run tests + type-check**

```bash
pnpm --filter @ridex/ui-web test
pnpm --filter @ridex/ui-web type-check
```
Expected: 3 new map-view tests PASS, type-check clean.

- [ ] **Step 7: Commit**

```bash
git add packages/ui-web/src/components/map/ packages/ui-web/src/index.ts
git commit -m "feat(ui-web): MapView component + MapMarker primitives (react-map-gl)"
```

---

## Task 6 — `LocationSearch` web component (geocoding)

**Files:**
- Create: `packages/ui-web/src/components/map/location-search.tsx`
- Test: `packages/ui-web/src/components/map/__tests__/location-search.spec.tsx`
- Modify: `packages/ui-web/src/components/map/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
/**
 * @vitest-environment jsdom
 */
// packages/ui-web/src/components/map/__tests__/location-search.spec.tsx
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocationSearch } from "../location-search";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  cleanup();
});

describe("LocationSearch (web)", () => {
  it("debounces input and queries Mapbox geocoding with VN filter", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [{ id: "1", place_name: "Bến Thành, HCM", center: [106.7, 10.77] }]
      })
    });
    render(<LocationSearch accessToken="pk.test" onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "ben thanh" } });
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(260);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/geocoding/v5/mapbox.places/");
    expect(url).toContain("country=VN");
    expect(url).toContain("language=vi");
    expect(url).toContain("limit=5");
    expect(url).toContain("access_token=pk.test");
  });

  it("renders up to 5 result rows then calls onSelect with LatLng + address", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          { id: "1", place_name: "A", center: [106.0, 10.0] },
          { id: "2", place_name: "B", center: [106.1, 10.1] }
        ]
      })
    });
    const onSelect = vi.fn();
    render(<LocationSearch accessToken="pk.test" onSelect={onSelect} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "x" } });
    await vi.advanceTimersByTimeAsync(260);
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(2));
    fireEvent.click(screen.getAllByRole("option")[1]);
    expect(onSelect).toHaveBeenCalledWith({
      lat: 10.1,
      lng: 106.1,
      address: "B"
    });
  });

  it("does NOT fetch when input shorter than 2 chars", async () => {
    render(<LocationSearch accessToken="pk.test" onSelect={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "a" } });
    await vi.advanceTimersByTimeAsync(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

```bash
pnpm --filter @ridex/ui-web test
```
Expected: FAIL.

- [ ] **Step 3: Implement `LocationSearch`**

```typescript
// packages/ui-web/src/components/map/location-search.tsx
"use client";
import * as React from "react";
import type { LatLng } from "@ridex/shared-types";

export interface LocationSearchResult {
  lat: number;
  lng: number;
  address: string;
}

export interface LocationSearchProps {
  accessToken: string;
  placeholder?: string;
  countryCode?: string; // default VN
  language?: string;    // default vi
  onSelect: (point: LocationSearchResult) => void;
  initialValue?: string;
}

interface MapboxFeature {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
}

export function LocationSearch({
  accessToken,
  placeholder = "Tìm địa điểm",
  countryCode = "VN",
  language = "vi",
  onSelect,
  initialValue = ""
}: LocationSearchProps) {
  const [value, setValue] = React.useState(initialValue);
  const [results, setResults] = React.useState<MapboxFeature[]>([]);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const url =
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value)}.json` +
          `?access_token=${accessToken}&country=${countryCode}&limit=5&language=${language}`;
        const res = await fetch(url);
        if (!res.ok) {
          setResults([]);
          return;
        }
        const json = (await res.json()) as { features?: MapboxFeature[] };
        setResults(json.features ?? []);
        setOpen(true);
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [value, accessToken, countryCode, language]);

  return (
    <div className="relative w-full">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        className="w-full rounded-md border border-surface-200 px-3 py-2 text-sm"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
      />
      {open && results.length > 0 ? (
        <ul role="listbox" className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow">
          {results.slice(0, 5).map((f) => (
            <li
              key={f.id}
              role="option"
              aria-selected="false"
              className="cursor-pointer px-3 py-2 text-sm hover:bg-surface-100"
              onClick={() => {
                onSelect({ lng: f.center[0], lat: f.center[1], address: f.place_name });
                setValue(f.place_name);
                setOpen(false);
              }}
            >
              {f.place_name}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Add to barrel**

In `packages/ui-web/src/components/map/index.ts`, append:
```typescript
export { LocationSearch } from "./location-search";
export type { LocationSearchProps, LocationSearchResult } from "./location-search";
```

- [ ] **Step 5: Run tests + type-check**

```bash
pnpm --filter @ridex/ui-web test
pnpm --filter @ridex/ui-web type-check
```
Expected: 3 new tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ui-web/src/components/map/location-search.tsx \
  packages/ui-web/src/components/map/__tests__/location-search.spec.tsx \
  packages/ui-web/src/components/map/index.ts
git commit -m "feat(ui-web): LocationSearch geocoding autocomplete (debounced, VN filter)"
```

---

## Task 7 — `@ridex/ui-mobile` deps + jest mock setup

**Files:**
- Modify: `packages/ui-mobile/package.json`
- Modify: `packages/ui-mobile/jest.config.js`
- Create: `packages/ui-mobile/__mocks__/@rnmapbox-maps.tsx`
- Create: `packages/ui-mobile/__mocks__/expo-location.ts`

> **Convention:** existing `packages/ui-mobile/jest.config.js` uses `*.test.ts(x)` files and a `__mocks__/` folder for module mocks (see `__mocks__/react-native.tsx`). Follow the same convention — do NOT introduce `jest.setup.js` for this package. Test files: `*.test.ts` not `*.spec.ts`.

- [ ] **Step 1: Add peer deps and devDeps in `packages/ui-mobile/package.json`**

Append to `"peerDependencies"`:
```json
"@rnmapbox/maps": "^10.0.0",
"expo-location": "*"
```
Append to `"devDependencies"`:
```json
"@rnmapbox/maps": "^10.1.33",
"expo-location": "~18.0.4"
```
Append `"@ridex/shared-types": "workspace:*"` to `"dependencies"` (runtime reference for `LatLng` + `DEFAULT_MAP_CENTER`).

- [ ] **Step 2: Update `packages/ui-mobile/jest.config.js` to wire the new mocks**

Replace the `moduleNameMapper` block with:
```javascript
moduleNameMapper: {
  "^react-native$": "<rootDir>/__mocks__/react-native.tsx",
  "^nativewind$": "<rootDir>/__mocks__/nativewind.tsx",
  "^react-native-safe-area-context$": "<rootDir>/__mocks__/react-native-safe-area-context.tsx",
  "^@rnmapbox/maps$": "<rootDir>/__mocks__/@rnmapbox-maps.tsx",
  "^expo-location$": "<rootDir>/__mocks__/expo-location.ts",
  "^@ridex/shared-types$": "<rootDir>/../shared-types/src/index.ts"
}
```

Keep the rest of the config (transform + testMatch) unchanged.

- [ ] **Step 3: Create `packages/ui-mobile/__mocks__/@rnmapbox-maps.tsx`**

```tsx
import * as React from "react";

const passthrough = ({ children }: { children?: React.ReactNode }) =>
  React.createElement(React.Fragment, null, children ?? null);

const empty = () => null;

const MapboxGL = {
  setAccessToken: jest.fn(),
  setTelemetryEnabled: jest.fn(),
  MapView: passthrough,
  Camera: empty,
  PointAnnotation: passthrough,
  ShapeSource: passthrough,
  LineLayer: empty
};

export default MapboxGL;
export const MapView = passthrough;
export const Camera = empty;
export const PointAnnotation = passthrough;
export const ShapeSource = passthrough;
export const LineLayer = empty;
export const setAccessToken = MapboxGL.setAccessToken;
export const setTelemetryEnabled = MapboxGL.setTelemetryEnabled;
```

- [ ] **Step 4: Create `packages/ui-mobile/__mocks__/expo-location.ts`**

```typescript
export const PermissionStatus = {
  GRANTED: "granted" as const,
  DENIED: "denied" as const,
  UNDETERMINED: "undetermined" as const
};

export const Accuracy = { Balanced: 3 };

export const requestForegroundPermissionsAsync = jest.fn(async () => ({
  status: "undetermined"
}));
export const getForegroundPermissionsAsync = jest.fn(async () => ({
  status: "undetermined"
}));
export const getCurrentPositionAsync = jest.fn(async () => ({
  coords: { latitude: 0, longitude: 0 }
}));
```

- [ ] **Step 5: Install + smoke test existing tests**

```bash
pnpm install
pnpm --filter @ridex/ui-mobile test
```
Expected: existing Button test still passes; no new tests yet.

- [ ] **Step 6: Commit**

```bash
git add packages/ui-mobile/package.json packages/ui-mobile/jest.config.js \
  packages/ui-mobile/__mocks__/@rnmapbox-maps.tsx \
  packages/ui-mobile/__mocks__/expo-location.ts \
  pnpm-lock.yaml
git commit -m "chore(ui-mobile): add @rnmapbox/maps + expo-location deps with jest mocks"
```

---

## Task 8 — `useLocationPermission` hook (mobile)

**Files:**
- Create: `packages/ui-mobile/src/components/map/use-location-permission.ts`
- Test: `packages/ui-mobile/__tests__/use-location-permission.test.tsx`

> **Test pattern:** Mobile hook tests use a `Probe` component + `react-test-renderer.act`, following the existing `button.test.tsx` style. No `@testing-library/react-native` dependency.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/ui-mobile/__tests__/use-location-permission.test.tsx
import * as React from "react";
import renderer, { act } from "react-test-renderer";
import * as Location from "expo-location";

import {
  useLocationPermission,
  type UseLocationPermissionResult
} from "../src/components/map/use-location-permission";

const mockGet = Location.getForegroundPermissionsAsync as jest.Mock;
const mockReq = Location.requestForegroundPermissionsAsync as jest.Mock;

let snapshot: UseLocationPermissionResult;
function Probe() {
  snapshot = useLocationPermission();
  return null;
}

beforeEach(() => {
  mockGet.mockReset();
  mockReq.mockReset();
});

async function flush() {
  // Flush microtasks queued by useEffect + then-chains
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useLocationPermission", () => {
  it("reads initial status on mount", async () => {
    mockGet.mockResolvedValueOnce({ status: "undetermined" });
    await act(async () => {
      renderer.create(<Probe />);
    });
    await flush();
    expect(snapshot.status).toBe("undetermined");
  });

  it("becomes granted after request", async () => {
    mockGet.mockResolvedValueOnce({ status: "undetermined" });
    mockReq.mockResolvedValueOnce({ status: "granted" });
    await act(async () => {
      renderer.create(<Probe />);
    });
    await flush();
    await act(async () => {
      await snapshot.request();
    });
    expect(snapshot.status).toBe("granted");
  });

  it("becomes denied when user rejects", async () => {
    mockGet.mockResolvedValueOnce({ status: "undetermined" });
    mockReq.mockResolvedValueOnce({ status: "denied" });
    await act(async () => {
      renderer.create(<Probe />);
    });
    await flush();
    await act(async () => {
      await snapshot.request();
    });
    expect(snapshot.status).toBe("denied");
  });
});
```

- [ ] **Step 2: Run test to verify FAIL**

```bash
pnpm --filter @ridex/ui-mobile test
```
Expected: FAIL — module `../src/components/map/use-location-permission` not found.

- [ ] **Step 3: Implement hook**

```typescript
// packages/ui-mobile/src/components/map/use-location-permission.ts
import * as Location from "expo-location";
import * as React from "react";

export type LocationPermissionStatus = "granted" | "denied" | "undetermined" | "restricted";

export interface UseLocationPermissionResult {
  status: LocationPermissionStatus;
  request: () => Promise<LocationPermissionStatus>;
}

function normalize(raw: string | undefined): LocationPermissionStatus {
  if (raw === "granted") return "granted";
  if (raw === "denied") return "denied";
  if (raw === "restricted") return "restricted";
  return "undetermined";
}

export function useLocationPermission(): UseLocationPermissionResult {
  const [status, setStatus] = React.useState<LocationPermissionStatus>("undetermined");

  React.useEffect(() => {
    let mounted = true;
    Location.getForegroundPermissionsAsync().then((r) => {
      if (mounted) setStatus(normalize(r?.status));
    });
    return () => {
      mounted = false;
    };
  }, []);

  const request = React.useCallback(async () => {
    const r = await Location.requestForegroundPermissionsAsync();
    const next = normalize(r?.status);
    setStatus(next);
    return next;
  }, []);

  return { status, request };
}
```

- [ ] **Step 4: Run test, expect PASS**

```bash
pnpm --filter @ridex/ui-mobile test
```
Expected: 3 new tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui-mobile/src/components/map/use-location-permission.ts \
  packages/ui-mobile/__tests__/use-location-permission.test.tsx \
  packages/ui-mobile/package.json pnpm-lock.yaml
git commit -m "feat(ui-mobile): useLocationPermission hook (expo-location)"
```

---

## Task 9 — `useCurrentLocation` hook (mobile)

**Files:**
- Create: `packages/ui-mobile/src/components/map/use-current-location.ts`
- Test: `packages/ui-mobile/__tests__/use-current-location.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// packages/ui-mobile/__tests__/use-current-location.test.tsx
import * as React from "react";
import renderer, { act } from "react-test-renderer";
import * as Location from "expo-location";

import {
  useCurrentLocation,
  type UseCurrentLocationResult
} from "../src/components/map/use-current-location";

const mockGetPos = Location.getCurrentPositionAsync as jest.Mock;
const mockReq = Location.requestForegroundPermissionsAsync as jest.Mock;

let snapshot: UseCurrentLocationResult;
function Probe() {
  snapshot = useCurrentLocation();
  return null;
}

beforeEach(() => {
  mockGetPos.mockReset();
  mockReq.mockReset();
});

describe("useCurrentLocation (mobile)", () => {
  it("returns Sài Gòn fallback before request", async () => {
    await act(async () => {
      renderer.create(<Probe />);
    });
    expect(snapshot.coords).toEqual({ lat: 10.7769, lng: 106.7009 });
    expect(snapshot.status).toBe("idle");
  });

  it("returns actual coords on grant", async () => {
    mockReq.mockResolvedValueOnce({ status: "granted" });
    mockGetPos.mockResolvedValueOnce({ coords: { latitude: 10.5, longitude: 106.6 } });
    await act(async () => {
      renderer.create(<Probe />);
    });
    await act(async () => {
      await snapshot.request();
    });
    expect(snapshot.status).toBe("ready");
    expect(snapshot.coords).toEqual({ lat: 10.5, lng: 106.6 });
  });

  it("keeps Sài Gòn fallback on denied + sets error", async () => {
    mockReq.mockResolvedValueOnce({ status: "denied" });
    await act(async () => {
      renderer.create(<Probe />);
    });
    await act(async () => {
      await snapshot.request();
    });
    expect(snapshot.status).toBe("error");
    expect(snapshot.coords).toEqual({ lat: 10.7769, lng: 106.7009 });
    expect(snapshot.error).toBe("denied");
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

- [ ] **Step 3: Implement hook**

```typescript
// packages/ui-mobile/src/components/map/use-current-location.ts
import * as Location from "expo-location";
import * as React from "react";
import { DEFAULT_MAP_CENTER, type LatLng } from "@ridex/shared-types";

type Status = "idle" | "loading" | "ready" | "error";
type ErrorKind = "denied" | "unavailable" | "timeout";

export interface UseCurrentLocationResult {
  status: Status;
  coords: LatLng;
  error: ErrorKind | null;
  request: () => Promise<void>;
}

export function useCurrentLocation(): UseCurrentLocationResult {
  const [status, setStatus] = React.useState<Status>("idle");
  const [coords, setCoords] = React.useState<LatLng>(DEFAULT_MAP_CENTER);
  const [error, setError] = React.useState<ErrorKind | null>(null);

  const request = React.useCallback(async () => {
    setStatus("loading");
    setError(null);
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") {
      setError("denied");
      setStatus("error");
      return;
    }
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setStatus("ready");
    } catch {
      setError("unavailable");
      setStatus("error");
    }
  }, []);

  return { status, coords, error, request };
}
```

- [ ] **Step 4: Run test, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/ui-mobile/src/components/map/use-current-location.ts \
  packages/ui-mobile/__tests__/use-current-location.test.tsx
git commit -m "feat(ui-mobile): useCurrentLocation hook with Sài Gòn fallback"
```

---

## Task 10 — `MapView` mobile component

**Files:**
- Create: `packages/ui-mobile/src/components/map/map-view.tsx`
- Create: `packages/ui-mobile/src/components/map/map-marker.tsx`
- Create: `packages/ui-mobile/src/components/map/map-route.tsx`
- Create: `packages/ui-mobile/src/components/map/index.ts`
- Modify: `packages/ui-mobile/src/index.ts`

No render test for MapView mobile (RN render tests with @rnmapbox/maps are flaky and depend on native bridge — defer to Maestro E2E in T024 per the same rationale documented in T013 for Button tests). Type-check is the contract verification.

- [ ] **Step 1: Implement `MapView`**

```typescript
// packages/ui-mobile/src/components/map/map-view.tsx
import MapboxGL from "@rnmapbox/maps";
import * as React from "react";
import { StyleSheet, View } from "react-native";
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_STYLE,
  DEFAULT_MAP_ZOOM,
  type MapViewProps
} from "@ridex/shared-types";

import { MapMarker } from "./map-marker";
import { MapRoute } from "./map-route";

export interface MobileMapViewProps extends MapViewProps {
  accessToken: string;
}

let tokenSet = false;

export function MapView({
  accessToken,
  initialCenter = DEFAULT_MAP_CENTER,
  initialZoom = DEFAULT_MAP_ZOOM,
  styleUrl = DEFAULT_MAP_STYLE,
  markers = [],
  routeGeoJson,
  onMapClick,
  followUserLocation,
  testID
}: MobileMapViewProps) {
  if (!tokenSet) {
    MapboxGL.setAccessToken(accessToken);
    MapboxGL.setTelemetryEnabled(false); // C2: privacy — disable Mapbox anonymous analytics
    tokenSet = true;
  }
  return (
    <View style={styles.container} testID={testID}>
      <MapboxGL.MapView
        style={styles.map}
        styleURL={styleUrl}
        onPress={(feature) => {
          const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
          onMapClick?.({ lat, lng });
        }}
      >
        <MapboxGL.Camera
          zoomLevel={initialZoom}
          centerCoordinate={[initialCenter.lng, initialCenter.lat]}
          followUserLocation={followUserLocation}
        />
        {markers.map((m) => (
          <MapMarker key={m.id} marker={m} />
        ))}
        {routeGeoJson ? <MapRoute geoJson={routeGeoJson} /> : null}
      </MapboxGL.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 }
});
```

- [ ] **Step 2: Implement `MapMarker`**

```typescript
// packages/ui-mobile/src/components/map/map-marker.tsx
import MapboxGL from "@rnmapbox/maps";
import * as React from "react";
import { View } from "react-native";
import type { MapMarker as MapMarkerType, MapMarkerKind } from "@ridex/shared-types";

const COLOR_BY_KIND: Record<MapMarkerKind, string> = {
  pickup: "#0a84ff",
  destination: "#000000",
  driver: "#10b981",
  generic: "#6c6c70"
};

export function MapMarker({ marker }: { marker: MapMarkerType }) {
  const color = COLOR_BY_KIND[marker.kind];
  const isDestination = marker.kind === "destination";
  return (
    <MapboxGL.PointAnnotation
      id={marker.id}
      coordinate={[marker.position.lng, marker.position.lat]}
    >
      <View
        style={{
          width: 18,
          height: 18,
          backgroundColor: color,
          borderRadius: isDestination ? 0 : 9999,
          borderWidth: 2,
          borderColor: "#fff",
          transform: marker.bearingDeg ? [{ rotate: `${marker.bearingDeg}deg` }] : undefined
        }}
      />
    </MapboxGL.PointAnnotation>
  );
}
```

- [ ] **Step 3: Implement `MapRoute`**

```typescript
// packages/ui-mobile/src/components/map/map-route.tsx
import MapboxGL from "@rnmapbox/maps";
import * as React from "react";

export function MapRoute({ geoJson }: { geoJson: GeoJSON.LineString }) {
  return (
    <MapboxGL.ShapeSource
      id="route-source"
      shape={{ type: "Feature", geometry: geoJson, properties: {} }}
    >
      <MapboxGL.LineLayer id="route-line" style={{ lineColor: "#0a84ff", lineWidth: 4 }} />
    </MapboxGL.ShapeSource>
  );
}
```

- [ ] **Step 4: Barrel**

```typescript
// packages/ui-mobile/src/components/map/index.ts
export { MapView } from "./map-view";
export type { MobileMapViewProps } from "./map-view";
export { MapMarker } from "./map-marker";
export { MapRoute } from "./map-route";
export { useCurrentLocation } from "./use-current-location";
export type { UseCurrentLocationResult } from "./use-current-location";
export { useLocationPermission } from "./use-location-permission";
export type {
  LocationPermissionStatus,
  UseLocationPermissionResult
} from "./use-location-permission";
```

Append to `packages/ui-mobile/src/index.ts`:
```typescript
export * from "./components/map";
```

- [ ] **Step 5: Type-check + commit**

```bash
pnpm --filter @ridex/ui-mobile type-check
pnpm --filter @ridex/ui-mobile test
git add packages/ui-mobile/src/components/map/map-view.tsx \
  packages/ui-mobile/src/components/map/map-marker.tsx \
  packages/ui-mobile/src/components/map/map-route.tsx \
  packages/ui-mobile/src/components/map/index.ts \
  packages/ui-mobile/src/index.ts
git commit -m "feat(ui-mobile): MapView + MapMarker + MapRoute primitives (@rnmapbox/maps)"
```

---

## Task 11 — `LocationSearch` mobile component

**Files:**
- Create: `packages/ui-mobile/src/components/map/location-search.tsx`
- Test: `packages/ui-mobile/__tests__/location-search.test.ts`

- [ ] **Step 1: Write the failing test (logic only, no rendering)**

Test only the pure fetch helper, not the FlatList render. Extract `searchPlaces` as a pure async function and test it.

```typescript
// packages/ui-mobile/__tests__/location-search.test.ts
import { searchPlaces } from "../src/components/map/location-search";

const fetchMock = jest.fn();
(global as unknown as { fetch: typeof fetchMock }).fetch = fetchMock;

beforeEach(() => fetchMock.mockReset());

describe("searchPlaces", () => {
  it("returns empty array when query shorter than 2 chars", async () => {
    const res = await searchPlaces("a", "pk.test");
    expect(res).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls Mapbox geocoding with VN + vi defaults", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [{ id: "1", place_name: "Bến Thành", center: [106.7, 10.77] }]
      })
    });
    const res = await searchPlaces("Bến Thành", "pk.test");
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("country=VN");
    expect(url).toContain("language=vi");
    expect(url).toContain("limit=5");
    expect(res).toEqual([
      { id: "1", placeName: "Bến Thành", lat: 10.77, lng: 106.7 }
    ]);
  });

  it("returns empty array on non-ok response", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    const res = await searchPlaces("x", "pk.test");
    expect(res).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

- [ ] **Step 3: Implement `LocationSearch` + extracted `searchPlaces`**

```typescript
// packages/ui-mobile/src/components/map/location-search.tsx
import * as React from "react";
import { FlatList, TextInput, View } from "react-native";

import { Text } from "../text";

export interface PlaceResult {
  id: string;
  placeName: string;
  lat: number;
  lng: number;
}

interface MapboxFeature {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
}

export async function searchPlaces(
  query: string,
  accessToken: string,
  opts: { country?: string; language?: string; limit?: number } = {}
): Promise<PlaceResult[]> {
  if (query.trim().length < 2) return [];
  const country = opts.country ?? "VN";
  const language = opts.language ?? "vi";
  const limit = opts.limit ?? 5;
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
    `?access_token=${accessToken}&country=${country}&limit=${limit}&language=${language}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = (await res.json()) as { features?: MapboxFeature[] };
    return (json.features ?? []).map((f) => ({
      id: f.id,
      placeName: f.place_name,
      lat: f.center[1],
      lng: f.center[0]
    }));
  } catch {
    return [];
  }
}

export interface LocationSearchProps {
  accessToken: string;
  placeholder?: string;
  onSelect: (p: PlaceResult) => void;
}

export function LocationSearch({
  accessToken,
  placeholder = "Tìm địa điểm",
  onSelect
}: LocationSearchProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<PlaceResult[]>([]);

  React.useEffect(() => {
    const handle = setTimeout(async () => {
      setResults(await searchPlaces(query, accessToken));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, accessToken]);

  return (
    <View>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={placeholder}
        style={{
          borderWidth: 1,
          borderColor: "#d2d2d7",
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          fontSize: 14
        }}
      />
      {results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <View
              onTouchEnd={() => {
                onSelect(item);
                setQuery(item.placeName);
                setResults([]);
              }}
              style={{ paddingVertical: 10, paddingHorizontal: 12 }}
            >
              <Text variant="body">{item.placeName}</Text>
            </View>
          )}
        />
      ) : null}
    </View>
  );
}
```

- [ ] **Step 4: Append to barrel**

```typescript
export { LocationSearch, searchPlaces } from "./location-search";
export type { LocationSearchProps, PlaceResult } from "./location-search";
```

- [ ] **Step 5: Run tests + commit**

```bash
pnpm --filter @ridex/ui-mobile test
pnpm --filter @ridex/ui-mobile type-check
git add packages/ui-mobile/src/components/map/location-search.tsx \
  packages/ui-mobile/__tests__/location-search.test.ts \
  packages/ui-mobile/src/components/map/index.ts
git commit -m "feat(ui-mobile): LocationSearch + searchPlaces helper (Mapbox geocoding)"
```

---

## Task 12 — Web Customer pickup/destination store + HomeMap

**Files:**
- Create: `apps/web-customer/src/lib/use-pickup-destination-store.ts`
- Create: `apps/web-customer/src/components/home/home-map.tsx`
- Modify: `apps/web-customer/src/app/(app)/home/page.tsx`
- Modify: `apps/web-customer/package.json` (add @testing-library/react, jsdom)
- Modify: `apps/web-customer/vitest.config.ts`
- Test: `apps/web-customer/src/lib/__tests__/use-pickup-destination-store.spec.ts`

- [ ] **Step 1: Add devDeps for jsdom rendering**

In `apps/web-customer/package.json` add to devDependencies:
```json
"@testing-library/react": "^16.1.0",
"@vitejs/plugin-react": "^4.3.4",
"jsdom": "^25.0.1"
```

- [ ] **Step 2: Update `vitest.config.ts`**

```typescript
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  test: {
    environment: "node",
    include: ["src/**/*.spec.{ts,tsx}"],
    environmentMatchGlobs: [
      ["src/components/**", "jsdom"],
      ["src/lib/__tests__/use-*.spec.{ts,tsx}", "jsdom"]
    ]
  }
});
```

> **Why two matchers (C1 fix):** the pickup-destination store test (Task 12 step 3) uses `renderHook` from `@testing-library/react`, which requires `document`/`window`. The store test lives under `src/lib/__tests__/` not `src/components/`, so the second glob entry catches `use-*.spec.ts` files in lib.

- [ ] **Step 3: Write the failing store test**

```typescript
// apps/web-customer/src/lib/__tests__/use-pickup-destination-store.spec.ts
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { usePickupDestinationStore } from "../use-pickup-destination-store";

afterEach(() => {
  usePickupDestinationStore.getState().reset();
});

describe("usePickupDestinationStore", () => {
  it("starts empty with pickup active by default", () => {
    const { result } = renderHook(() => usePickupDestinationStore());
    expect(result.current.pickup).toBeNull();
    expect(result.current.destination).toBeNull();
    expect(result.current.activeField).toBe("pickup");
  });

  it("setPickup advances active field to destination", () => {
    const { result } = renderHook(() => usePickupDestinationStore());
    act(() => result.current.setPickup({ lat: 10, lng: 106, address: "A" }));
    expect(result.current.pickup).toEqual({ lat: 10, lng: 106, address: "A" });
    expect(result.current.activeField).toBe("destination");
  });

  it("reset clears all fields", () => {
    const { result } = renderHook(() => usePickupDestinationStore());
    act(() => {
      result.current.setPickup({ lat: 1, lng: 2 });
      result.current.setDestination({ lat: 3, lng: 4 });
      result.current.reset();
    });
    expect(result.current.pickup).toBeNull();
    expect(result.current.destination).toBeNull();
    expect(result.current.activeField).toBe("pickup");
  });
});
```

Install + run:
```bash
pnpm install
pnpm --filter @ridex/web-customer test
```
Expected: FAIL.

- [ ] **Step 4: Implement store**

```typescript
// apps/web-customer/src/lib/use-pickup-destination-store.ts
"use client";
import { create } from "zustand";

export interface PickupDestinationPoint {
  lat: number;
  lng: number;
  address?: string;
}

type ActiveField = "pickup" | "destination" | null;

interface PickupDestinationState {
  pickup: PickupDestinationPoint | null;
  destination: PickupDestinationPoint | null;
  activeField: ActiveField;
  setPickup: (p: PickupDestinationPoint | null) => void;
  setDestination: (p: PickupDestinationPoint | null) => void;
  setActiveField: (f: ActiveField) => void;
  reset: () => void;
}

export const usePickupDestinationStore = create<PickupDestinationState>((set) => ({
  pickup: null,
  destination: null,
  activeField: "pickup",
  setPickup: (pickup) =>
    set((s) => ({
      pickup,
      activeField: pickup && !s.destination ? "destination" : s.activeField
    })),
  setDestination: (destination) => set({ destination }),
  setActiveField: (activeField) => set({ activeField }),
  reset: () => set({ pickup: null, destination: null, activeField: "pickup" })
}));
```

- [ ] **Step 5: Run store test, expect PASS**

- [ ] **Step 6: Implement `HomeMap` composition**

```typescript
// apps/web-customer/src/components/home/home-map.tsx
"use client";
import * as React from "react";
import { LocationSearch, MapView, useCurrentLocation } from "@ridex/ui-web";
import { DEFAULT_MAP_CENTER, type MapMarker } from "@ridex/shared-types";

import { env } from "@/lib/env";
import { usePickupDestinationStore } from "@/lib/use-pickup-destination-store";

export function HomeMap() {
  const token = env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
  const { coords, request, status } = useCurrentLocation();
  const pickup = usePickupDestinationStore((s) => s.pickup);
  const destination = usePickupDestinationStore((s) => s.destination);
  const activeField = usePickupDestinationStore((s) => s.activeField);
  const setPickup = usePickupDestinationStore((s) => s.setPickup);
  const setDestination = usePickupDestinationStore((s) => s.setDestination);
  const setActiveField = usePickupDestinationStore((s) => s.setActiveField);

  React.useEffect(() => {
    request();
  }, [request]);

  const markers: MapMarker[] = [];
  if (pickup)
    markers.push({ id: "pickup", position: pickup, kind: "pickup", label: pickup.address });
  if (destination)
    markers.push({
      id: "destination",
      position: destination,
      kind: "destination",
      label: destination.address
    });

  // Placeholder straight-line route — real OSRM polyline arrives in T017.
  const placeholderRoute: GeoJSON.LineString | null =
    pickup && destination
      ? {
          type: "LineString",
          coordinates: [
            [pickup.lng, pickup.lat],
            [destination.lng, destination.lat]
          ]
        }
      : null;

  const handleMapClick = (point: { lat: number; lng: number }) => {
    if (activeField === "destination") setDestination(point);
    else setPickup(point);
  };

  const handleSelect = (r: { lat: number; lng: number; address: string }) => {
    if (activeField === "destination") setDestination(r);
    else setPickup(r);
  };

  if (!token) {
    return (
      <div className="rounded-md border border-state-error bg-state-error/10 p-4 text-sm">
        Thiếu cấu hình Mapbox. Đặt biến môi trường <code>NEXT_PUBLIC_MAPBOX_TOKEN</code>.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-surface-700">Điểm đón</label>
          <button
            type="button"
            onClick={() => setActiveField("pickup")}
            className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
              activeField === "pickup" ? "border-primary-500" : "border-surface-200"
            }`}
          >
            {pickup?.address ?? "Chạm trên bản đồ hoặc tìm địa chỉ"}
          </button>
        </div>
        <div>
          <label className="text-xs font-medium text-surface-700">Điểm đến</label>
          <button
            type="button"
            onClick={() => setActiveField("destination")}
            className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
              activeField === "destination" ? "border-primary-500" : "border-surface-200"
            }`}
          >
            {destination?.address ?? "Chạm trên bản đồ hoặc tìm địa chỉ"}
          </button>
        </div>
      </div>
      <LocationSearch accessToken={token} onSelect={handleSelect} />
      <div className="h-[420px] overflow-hidden rounded-lg border border-surface-200">
        <MapView
          accessToken={token}
          initialCenter={status === "ready" ? coords ?? DEFAULT_MAP_CENTER : DEFAULT_MAP_CENTER}
          markers={markers}
          routeGeoJson={placeholderRoute}
          onMapClick={handleMapClick}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Render `<HomeMap/>` in `apps/web-customer/src/app/(app)/home/page.tsx`**

Replace the placeholder `<Card>` block with `<HomeMap />`. Keep the auth gate and greeting header. Final file:

```typescript
"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import * as React from "react";

import { useAuthStore } from "@/lib/auth-store";

// C5: lazy-load mapbox-gl (~250 kB gzipped) only when /home renders, so landing/login bundles stay small.
const HomeMap = dynamic(
  () => import("@/components/home/home-map").then((m) => ({ default: m.HomeMap })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[420px] animate-pulse rounded-lg bg-surface-100 dark:bg-surface-800" />
    )
  }
);

export default function CustomerHomePage() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  React.useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated" || !user) {
    return <p className="text-sm text-surface-700 dark:text-surface-300">Đang tải...</p>;
  }

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Xin chào, {user.email}</h1>
        <p className="text-sm text-surface-700 dark:text-surface-300">
          Chọn điểm đón và điểm đến để bắt đầu.
        </p>
      </header>
      <HomeMap />
    </section>
  );
}
```

- [ ] **Step 8: Verify build**

```bash
pnpm --filter @ridex/web-customer test
pnpm --filter @ridex/web-customer type-check
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1 \
  NEXT_PUBLIC_WS_URL=http://localhost:3000 \
  NEXT_PUBLIC_MAPBOX_TOKEN=pk.thesis-placeholder-with-enough-length \
  pnpm --filter @ridex/web-customer build
```
Expected: tests PASS, prod build clean.

- [ ] **Step 9: Commit**

```bash
git add apps/web-customer/
git commit -m "feat(web-customer): HomeMap with pickup/destination Zustand store"
```

---

## Task 13 — Web Driver self-marker map

**Files:**
- Create: `apps/web-driver/src/components/home/driver-map.tsx`
- Modify: `apps/web-driver/src/app/(app)/home/page.tsx`
- Modify: `apps/web-driver/package.json` (add same deps as web-customer)
- Modify: `apps/web-driver/vitest.config.ts`

- [ ] **Step 1: Apply same devDeps + vitest.config update as Task 12**

Mirror `apps/web-driver/package.json` to add `@testing-library/react`, `jsdom`, `@vitejs/plugin-react`.

Replace `apps/web-driver/vitest.config.ts` with the same content from Task 12 step 2.

- [ ] **Step 2: Implement `DriverMap`**

```typescript
// apps/web-driver/src/components/home/driver-map.tsx
"use client";
import * as React from "react";
import { MapView, useCurrentLocation } from "@ridex/ui-web";
import { DEFAULT_MAP_CENTER, type MapMarker } from "@ridex/shared-types";

import { env } from "@/lib/env";

export function DriverMap() {
  const token = env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
  const { coords, request, status } = useCurrentLocation();

  React.useEffect(() => {
    request();
  }, [request]);

  if (!token) {
    return (
      <div className="rounded-md border border-state-error bg-state-error/10 p-4 text-sm">
        Thiếu cấu hình Mapbox. Đặt biến môi trường <code>NEXT_PUBLIC_MAPBOX_TOKEN</code>.
      </div>
    );
  }

  const center = status === "ready" && coords ? coords : DEFAULT_MAP_CENTER;
  const markers: MapMarker[] = coords
    ? [{ id: "self", position: coords, kind: "driver" }]
    : [];

  return (
    <div className="h-[480px] overflow-hidden rounded-lg border border-surface-200">
      <MapView accessToken={token} initialCenter={center} markers={markers} />
    </div>
  );
}
```

- [ ] **Step 3: Mount in driver home page**

```typescript
// apps/web-driver/src/app/(app)/home/page.tsx
"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import * as React from "react";

import { useAuthStore } from "@/lib/auth-store";

// C5: lazy-load mapbox-gl bundle from the driver home route only.
const DriverMap = dynamic(
  () => import("@/components/home/driver-map").then((m) => ({ default: m.DriverMap })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[480px] animate-pulse rounded-lg bg-surface-100 dark:bg-surface-800" />
    )
  }
);

export default function DriverHomePage() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  React.useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  if (status !== "authenticated" || !user) {
    return <p className="text-sm text-surface-700 dark:text-surface-300">Đang tải...</p>;
  }

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Trạm điều phối</h1>
        <p className="text-sm text-surface-700 dark:text-surface-300">
          Tài xế: <strong>{user.email}</strong>
        </p>
      </header>
      <DriverMap />
    </section>
  );
}
```

> **C6 note — driver heading rotation deferred:** spec Business Rules mention "car icon rotated theo heading," but the backend driver-location WS payload (T019) does not exist yet and `useCurrentLocation` does not extract `heading` from the geolocation API yet. For T015 the driver self-marker renders without rotation; T019 will add `heading` to the realtime payload and a follow-up will wire it via `bearingDeg`. Document this in the review summary (Task 17 step 3).

- [ ] **Step 4: Verify**

```bash
pnpm install
pnpm --filter @ridex/web-driver type-check
pnpm --filter @ridex/web-driver test
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1 \
  NEXT_PUBLIC_WS_URL=http://localhost:3000 \
  NEXT_PUBLIC_MAPBOX_TOKEN=pk.thesis-placeholder-with-enough-length \
  pnpm --filter @ridex/web-driver build
```

- [ ] **Step 5: Commit**

```bash
git add apps/web-driver/
git commit -m "feat(web-driver): DriverMap self-marker on home"
```

---

## Task 14 — Mobile Customer home tab with map

**Files:**
- Create: `apps/mobile-customer/src/lib/use-pickup-destination-store.ts`
- Modify: `apps/mobile-customer/app/(tabs)/home.tsx`
- Modify: `apps/mobile-customer/package.json` (add `@rnmapbox/maps`, `expo-location`)
- Modify: `apps/mobile-customer/jest.config.js` + `jest.setup.js` (add mocks)

- [ ] **Step 1: Install deps**

In `apps/mobile-customer/package.json` dependencies, add:
```json
"@rnmapbox/maps": "^10.1.33",
"expo-location": "~18.0.4",
"expo-linking": "~7.0.3"
```

**C8 fix — use `__mocks__/` files, not jest.setup.js merging.** Jest's `moduleNameMapper` expects a module file with `export`/`module.exports`, not a setup script. Create dedicated mock files so the app mock contract mirrors the package mock contract (T15 Task 7).

Create `apps/mobile-customer/__mocks__/@rnmapbox-maps.js`:
```javascript
const passthrough = ({ children }) => children ?? null;
const empty = () => null;
const MapboxGL = {
  setAccessToken: jest.fn(),
  setTelemetryEnabled: jest.fn(),
  MapView: passthrough,
  Camera: empty,
  PointAnnotation: passthrough,
  ShapeSource: passthrough,
  LineLayer: empty
};
module.exports = MapboxGL;
module.exports.default = MapboxGL;
module.exports.MapView = passthrough;
module.exports.Camera = empty;
module.exports.PointAnnotation = passthrough;
module.exports.ShapeSource = passthrough;
module.exports.LineLayer = empty;
```

Create `apps/mobile-customer/__mocks__/expo-location.js`:
```javascript
module.exports = {
  PermissionStatus: { GRANTED: "granted", DENIED: "denied", UNDETERMINED: "undetermined" },
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: "undetermined" }),
  getForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: "undetermined" }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({ coords: { latitude: 0, longitude: 0 } })
};
```

Create `apps/mobile-customer/__mocks__/expo-linking.js`:
```javascript
module.exports = { openSettings: jest.fn() };
```

In `apps/mobile-customer/jest.config.js` add to `moduleNameMapper`:
```javascript
"^@rnmapbox/maps$": "<rootDir>/__mocks__/@rnmapbox-maps.js",
"^expo-location$": "<rootDir>/__mocks__/expo-location.js",
"^expo-linking$": "<rootDir>/__mocks__/expo-linking.js"
```

Do **not** touch `jest.setup.js` — keep existing secure-store/constants mocks there untouched.

- [ ] **Step 2: Create the pickup-destination store (mirror web)**

```typescript
// apps/mobile-customer/src/lib/use-pickup-destination-store.ts
import { create } from "zustand";

export interface PickupDestinationPoint {
  lat: number;
  lng: number;
  address?: string;
}

type ActiveField = "pickup" | "destination" | null;

interface State {
  pickup: PickupDestinationPoint | null;
  destination: PickupDestinationPoint | null;
  activeField: ActiveField;
  setPickup: (p: PickupDestinationPoint | null) => void;
  setDestination: (p: PickupDestinationPoint | null) => void;
  setActiveField: (f: ActiveField) => void;
  reset: () => void;
}

export const usePickupDestinationStore = create<State>((set) => ({
  pickup: null,
  destination: null,
  activeField: "pickup",
  setPickup: (pickup) =>
    set((s) => ({
      pickup,
      activeField: pickup && !s.destination ? "destination" : s.activeField
    })),
  setDestination: (destination) => set({ destination }),
  setActiveField: (activeField) => set({ activeField }),
  reset: () => set({ pickup: null, destination: null, activeField: "pickup" })
}));
```

- [ ] **Step 3: Rewrite `apps/mobile-customer/app/(tabs)/home.tsx`**

```typescript
import * as Linking from "expo-linking";
import * as React from "react";
import { View } from "react-native";
import { Button, Screen, Text } from "@ridex/ui-mobile";
import {
  LocationSearch,
  MapView,
  useCurrentLocation,
  useLocationPermission
} from "@ridex/ui-mobile";
import { DEFAULT_MAP_CENTER, type MapMarker } from "@ridex/shared-types";

import { env } from "@/lib/env";
import { usePickupDestinationStore } from "@/lib/use-pickup-destination-store";

export default function HomeTab() {
  const perm = useLocationPermission();
  const loc = useCurrentLocation();
  const pickup = usePickupDestinationStore((s) => s.pickup);
  const destination = usePickupDestinationStore((s) => s.destination);
  const activeField = usePickupDestinationStore((s) => s.activeField);
  const setPickup = usePickupDestinationStore((s) => s.setPickup);
  const setDestination = usePickupDestinationStore((s) => s.setDestination);

  React.useEffect(() => {
    if (perm.status === "granted") loc.request();
  }, [perm.status, loc.request]);

  if (!env.mapboxToken) {
    return (
      <Screen>
        <Text variant="body">Thiếu Mapbox token — cập nhật app.json.extra.mapboxToken.</Text>
      </Screen>
    );
  }

  if (perm.status === "undetermined") {
    return (
      <Screen>
        <Text variant="h2">Bản đồ RideX</Text>
        <Text variant="body">Cần quyền vị trí để hiển thị xe gần bạn.</Text>
        <Button onPress={() => perm.request()}>Cho phép vị trí</Button>
      </Screen>
    );
  }

  if (perm.status === "denied" || perm.status === "restricted") {
    return (
      <Screen>
        <Text variant="h2">Bản đồ RideX</Text>
        <Text variant="body">
          Bạn đã từ chối quyền vị trí. Mở cài đặt để bật lại — bản đồ sẽ dùng Sài Gòn mặc định.
        </Text>
        <Button onPress={() => Linking.openSettings()}>Mở cài đặt</Button>
      </Screen>
    );
  }

  const markers: MapMarker[] = [];
  if (pickup) markers.push({ id: "p", position: pickup, kind: "pickup" });
  if (destination) markers.push({ id: "d", position: destination, kind: "destination" });

  const placeholderRoute: GeoJSON.LineString | null =
    pickup && destination
      ? {
          type: "LineString",
          coordinates: [
            [pickup.lng, pickup.lat],
            [destination.lng, destination.lat]
          ]
        }
      : null;

  const handleMapClick = (point: { lat: number; lng: number }) => {
    if (activeField === "destination") setDestination(point);
    else setPickup(point);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 12 }}>
        <LocationSearch
          accessToken={env.mapboxToken}
          onSelect={(p) => {
            const point = { lat: p.lat, lng: p.lng, address: p.placeName };
            if (activeField === "destination") setDestination(point);
            else setPickup(point);
          }}
        />
      </View>
      <MapView
        accessToken={env.mapboxToken}
        initialCenter={loc.coords ?? DEFAULT_MAP_CENTER}
        markers={markers}
        routeGeoJson={placeholderRoute}
        onMapClick={handleMapClick}
      />
    </View>
  );
}
```

- [ ] **Step 4: Verify**

```bash
pnpm install
pnpm --filter @ridex/mobile-customer type-check
pnpm --filter @ridex/mobile-customer test
```
Expected: existing 9 tests still pass.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile-customer/
git commit -m "feat(mobile-customer): home tab Mapbox map + pickup/destination flow"
```

---

## Task 15 — Mobile Driver home tab with self-marker

**Files:**
- Modify: `apps/mobile-driver/package.json`
- Modify: `apps/mobile-driver/jest.config.js`, `jest.setup.js`
- Modify: `apps/mobile-driver/app/(tabs)/home.tsx`

- [ ] **Step 1: Install deps + Jest mocks (mirror Task 14 step 1, replacing customer→driver paths)**

That includes the **C8 fix**: create `apps/mobile-driver/__mocks__/@rnmapbox-maps.js`, `expo-location.js`, `expo-linking.js` with the same content as the customer mocks, and wire `moduleNameMapper` in `apps/mobile-driver/jest.config.js`. Do **not** merge mock factories into `jest.setup.js`.

- [ ] **Step 2: Rewrite home tab**

```typescript
// apps/mobile-driver/app/(tabs)/home.tsx
import * as Linking from "expo-linking";
import * as React from "react";
import { View } from "react-native";
import { Button, Screen, Text } from "@ridex/ui-mobile";
import { MapView, useCurrentLocation, useLocationPermission } from "@ridex/ui-mobile";
import { DEFAULT_MAP_CENTER, type MapMarker } from "@ridex/shared-types";

import { env } from "@/lib/env";

export default function HomeTab() {
  const perm = useLocationPermission();
  const loc = useCurrentLocation();

  React.useEffect(() => {
    if (perm.status === "granted") loc.request();
  }, [perm.status, loc.request]);

  if (!env.mapboxToken) {
    return (
      <Screen>
        <Text variant="body">Thiếu Mapbox token.</Text>
      </Screen>
    );
  }

  if (perm.status === "undetermined") {
    return (
      <Screen>
        <Text variant="h2">Bản đồ tài xế</Text>
        <Text variant="body">Cho phép vị trí để hiển thị xe của bạn.</Text>
        <Button onPress={() => perm.request()}>Cho phép vị trí</Button>
      </Screen>
    );
  }

  if (perm.status === "denied" || perm.status === "restricted") {
    return (
      <Screen>
        <Text variant="h2">Bản đồ tài xế</Text>
        <Text variant="body">Đã từ chối quyền vị trí.</Text>
        <Button onPress={() => Linking.openSettings()}>Mở cài đặt</Button>
      </Screen>
    );
  }

  const markers: MapMarker[] = [{ id: "self", position: loc.coords, kind: "driver" }];

  return (
    <View style={{ flex: 1 }}>
      <MapView
        accessToken={env.mapboxToken}
        initialCenter={loc.coords ?? DEFAULT_MAP_CENTER}
        markers={markers}
        followUserLocation
      />
    </View>
  );
}
```

- [ ] **Step 3: Verify + commit**

```bash
pnpm install
pnpm --filter @ridex/mobile-driver type-check
pnpm --filter @ridex/mobile-driver test
git add apps/mobile-driver/
git commit -m "feat(mobile-driver): home tab self-marker map + permission flow"
```

---

## Task 16 — Document expo prebuild + dev client setup

**Files:**
- Create or Modify: `apps/mobile-customer/README.md`, `apps/mobile-driver/README.md`

- [ ] **Step 1: Write README content**

Insert at top of each mobile README (or create if missing):

````markdown
# RideX <Surface> Mobile

## Lần đầu chạy (sau khi clone)

`@rnmapbox/maps` yêu cầu native code — KHÔNG chạy trong Expo Go.

1. Đặt `RNMAPBOX_DOWNLOAD_TOKEN` (Mapbox secret token `sk.*`) làm env trước khi prebuild:
   ```bash
   export RNMAPBOX_DOWNLOAD_TOKEN=sk.xxxxx
   ```
2. Generate native folders:
   ```bash
   pnpm --filter @ridex/mobile-<surface> exec expo prebuild --clean
   ```
3. EAS dev client build (chỉ cần 1 lần / mỗi platform):
   ```bash
   pnpm --filter @ridex/mobile-<surface> exec eas build --profile development --platform ios
   pnpm --filter @ridex/mobile-<surface> exec eas build --profile development --platform android
   ```
4. Cài dev client trên thiết bị qua QR / link, sau đó:
   ```bash
   pnpm --filter @ridex/mobile-<surface> start
   ```
   → Mở app dev client, scan QR → app load.

## Environment

`app.json` → `expo.extra.mapboxToken`: dùng public token `pk.*` (không phải `sk.*`).
````

Replace `<surface>` with `customer` / `driver`.

- [ ] **Step 2: Commit**

```bash
git add apps/mobile-customer/README.md apps/mobile-driver/README.md
git commit -m "docs(mobile): expo prebuild + EAS dev client setup for Mapbox"
```

---

## Task 17 — Final verification

- [ ] **Step 1: Run all checks**

```bash
pnpm install
pnpm -r lint
pnpm -r type-check
pnpm -r test
```

Expected:
- Backend: 444 tests still pass (no backend change).
- `@ridex/shared-types`: +5 tests.
- `@ridex/ui-web`: +9 tests (3 hook + 3 map-view + 3 location-search).
- `@ridex/ui-mobile`: +9 tests (3 permission + 3 location hook + 3 search).
- `@ridex/web-customer`: +3 tests (store).
- All other packages: existing counts unchanged.

- [ ] **Step 2: Run 3 web prod builds**

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1 \
  NEXT_PUBLIC_WS_URL=http://localhost:3000 \
  NEXT_PUBLIC_MAPBOX_TOKEN=pk.thesis-placeholder-with-enough-length \
  pnpm --filter @ridex/web-customer build
# repeat for web-driver, web-admin (admin doesn't have map — should still build)
```

Expected: all 3 builds pass; bundle size for web-customer/driver larger by mapbox-gl chunk (~250 kB gzipped on the home route).

- [ ] **Step 3: Document smoke checklist in `docs/reviews/015-mapbox-integration-r1.md`** (Codex creates this)

Codex should produce a Review-ready summary at the path above with:
- Summary
- Changed files (list)
- Tests run (pasted counts)
- Notes:
  - "expo prebuild not executed in this session" (manual step)
  - "@rnmapbox/maps native render not exercised — Jest mock only" (T024 Maestro)
  - "Live Mapbox API hit not exercised — requires real public token"
  - "Token domain restriction must be set on Mapbox dashboard before staging"

- [ ] **Step 4: Final commit (if any leftover) + PR**

```bash
git status
# If any untracked outputs, decide per file
git log --oneline -20
```

Confirm task 015 commits are on `main` (or feature branch per project policy).

---

## Out-of-band Notes for Codex

1. **Do not implement OSRM route calculation** — task spec says polyline placeholder only. T017 will wire `POST /rides/quote`.
2. **Reverse geocoding** is out of scope. If user clicks map → set marker with `{ lat, lng }` only; address remains undefined.
3. **Admin app** is untouched — confirm `apps/web-admin/package.json` unchanged.
4. **Mapbox token in `.env.local.example` files** must use `pk.your-token-here` placeholder — do not commit real tokens.
5. **iOS sim location** requires Debug → Location → Custom Location for testing; Android emulator needs Extended Controls. Mention in README if dev gets blank map.
6. **Lockfile drift**: from T012 retrospective — if `pnpm install` warns about lockfile, use `pnpm install --no-frozen-lockfile` once then commit `pnpm-lock.yaml`.
7. **`expo-linking`** is already a transitive dep of `expo-router` — verify before adding directly. If `import * as Linking from "expo-linking"` resolves, skip the explicit dep.

## Acceptance Match (vs spec)

- [x] 4 surfaces có map render → Tasks 12–15
- [x] Click map → set pickup/dest (customer) → Task 12, 14
- [x] Search bar → geocoding result → Tasks 6, 11, 12, 14
- [x] Mobile permission flow đầy đủ 3 states → Task 8 + Task 14, 15
- [x] Fallback Sài Gòn default center → Tasks 1, 9
- [x] Token env-based, KHÔNG hard-code → Task 2
- [x] README mỗi mobile app document `expo prebuild` step → Task 16
- [x] Lint + build + test xanh → Task 17
