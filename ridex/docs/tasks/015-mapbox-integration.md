# Task 015: Mapbox Integration (Web + Mobile)

## Task Name

Tích hợp Mapbox GL JS (web) + @rnmapbox/maps (mobile). Map component shared, marker primitives, location permission flow trên mobile, geocoding search bar. Áp dụng cho 4 surface (skip admin).

## Goal

User mở Customer/Driver app (web hoặc mobile) → thấy map render với current location → có thể đặt marker pickup/destination (customer) hoặc hiển thị current location marker (driver). Pickup/destination picker UX giống Uber: bottom sheet với search bar + map sau đó.

## Context

- Mapbox token: 1 token public (`pk.*`) share giữa web + mobile. Đăng ký Mapbox account (free tier 50K loads/month, đủ thesis).
- Web SDK: `mapbox-gl@3.x` + `react-map-gl@7.x` wrapper.
- Mobile SDK: `@rnmapbox/maps@10.x`. Cần custom dev client (Expo prebuild) hoặc EAS Build — không work trong Expo Go.
- Location permission:
  - Web: Geolocation API (browser prompt).
  - iOS: `NSLocationWhenInUseUsageDescription` trong Info.plist (via Expo `app.json`).
  - Android: `ACCESS_FINE_LOCATION` permission.
- Geocoding: Mapbox Geocoding API `/geocoding/v5/mapbox.places/{search}.json` cho address autocomplete.

## Scope

### Files

```
packages/
  ui-web/src/components/
    map/
      map-view.tsx                     # wrapper react-map-gl + tokens
      map-marker.tsx                   # custom marker
      map-route.tsx                    # GeoJSON polyline route render
      location-search.tsx              # geocoding autocomplete dropdown
      use-current-location.ts          # Geolocation hook
  ui-mobile/src/components/
    map/
      map-view.tsx                     # MapView from @rnmapbox/maps
      map-marker.tsx                   # PointAnnotation
      map-route.tsx
      location-search.tsx              # FlatList + Mapbox geocoding
      use-current-location.ts          # expo-location hook
      use-location-permission.ts       # request + status

apps/web-customer/src/
  components/home/
    home-map.tsx                       # MapView với pickup/destination markers
  lib/
    use-pickup-destination-store.ts    # Zustand state cho 2 markers
apps/web-driver/src/
  components/home/
    driver-map.tsx                     # MapView với self marker
apps/mobile-customer/
  app/(tabs)/home.tsx                  # update với MapView
apps/mobile-driver/
  app/(tabs)/home.tsx                  # update với MapView
```

Admin app KHÔNG có map.

### MapView API (cross-platform similar)

```typescript
// Both web + mobile expose same prop shape (different impl)
type MapViewProps = {
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  markers?: Marker[];
  route?: GeoJSON.LineString;
  onMapClick?: (point: { lat: number; lng: number }) => void;
  followUserLocation?: boolean;
  style?: string;  // mapbox style URL, default "mapbox://styles/mapbox/streets-v12"
};
```

### Geocoding search bar

Input → debounce 250ms → fetch `https://api.mapbox.com/geocoding/v5/mapbox.places/{encodedQuery}.json?access_token=...&country=VN&limit=5&language=vi` → render dropdown 5 results → click → set marker + center map.

Web: dropdown floating dưới input, shadcn Command palette.
Mobile: bottom sheet với FlatList.

### Current location

Web: `navigator.geolocation.getCurrentPosition` → set initial center. Permission prompt qua browser.
Mobile: `expo-location.requestForegroundPermissionsAsync()` → `getCurrentPositionAsync()`. Nếu denied: fallback default center (Sài Gòn: 10.7769, 106.7009).

### Permission states (mobile)

```typescript
const { status, request } = useLocationPermission();
// status: "granted" | "denied" | "undetermined" | "restricted"
```

UI: nếu `denied`, show banner "Cần quyền vị trí để sử dụng RideX. Mở cài đặt" + button → `Linking.openSettings()`.

### Mapbox token env

Web: `NEXT_PUBLIC_MAPBOX_TOKEN`.
Mobile: `app.json` `extra.mapboxToken` + `expo.plugins[].@rnmapbox/maps].RNMapboxMapsDownloadToken`.

`.env.local.example` update để doc.

### Expo prebuild requirement

`@rnmapbox/maps` requires native code. Mobile apps cần:
1. `expo prebuild` để generate `ios/` + `android/` folders.
2. Hoặc dùng EAS Build dev client.
3. Document trong README mỗi mobile app: "Run `expo prebuild --clean` 1 lần trước dev đầu tiên".

Alternative: Expo Go không support → require dev client. Spec lock: dev client (EAS Build → install via QR).

## Out of Scope

- Custom Mapbox Studio style (use default).
- 3D buildings / pitch.
- Heatmap overlays.
- Geofencing.
- Turn-by-turn navigation.
- Offline maps (download tile cache).
- Traffic layer.
- Map clustering (defer until many drivers).
- Map markers customize beyond basic icon + label.
- Reverse geocoding tự động cập nhật address (chỉ implement nếu user click trên map → reverse geocode để show address).

## Expected Files/Modules

~20 file. 2 packages update + 4 app screens update.

## Functional Requirements

- Map render trong vòng 2s sau page mount (cached tiles).
- Click trên map (customer) → marker xuất hiện + state lưu lat/lng.
- Search bar nhập "Bến Thành" → top 5 results VN.
- Mobile: lần đầu mở app → permission prompt → grant → map center current location.
- Mobile permission denied → banner + fallback center.
- 2 markers (pickup + destination) → polyline path placeholder (không call OSRM yet — T017 mới gọi quote).
- Web: zoom +/- buttons + drag pan smooth.
- Mobile: pinch zoom + drag pan native.

## Security Requirements

- Mapbox token chỉ dùng `pk.*` (public scope), KHÔNG dùng `sk.*` ở FE.
- Token đặt domain restriction trên Mapbox dashboard (web app domains + mobile bundle IDs).
- Geocoding query KHÔNG log full search text vào analytics.
- Reverse geocoding kết quả KHÔNG cache cross-user (privacy).

## Database Requirements

KHÔNG.

## API/WebSocket Changes

KHÔNG (gọi Mapbox API trực tiếp từ FE).

## Business Rules

- Pickup marker style: blue dot (Uber-like).
- Destination marker: black square.
- Driver self marker: car icon rotated theo heading.
- Map default style: `streets-v12` (chuẩn).
- Bounds Việt Nam ưu tiên: geocoding `country=VN` filter.

## Edge Cases

- Token invalid: map render với "Authorization needed" overlay. Show retry CTA.
- Geolocation timeout (>10s): fallback default center + toast.
- Mạng yếu: tile load progressively, không freeze UI.
- iOS sim không có location: dùng "Custom Location" setting (Debug menu).
- Android emulator: dùng Extended Controls Location.
- User block permission permanently: banner "Mở cài đặt" + deep link.

## Tests Required

- Mock Mapbox SDK (gl + rnmapbox) trong test environment.
- Web (Vitest + Testing Library):
  - `useCurrentLocation` hook returns coords khi geolocation grant.
  - `LocationSearch` component debounce + render dropdown.
  - `MapView` renders với props.
- Mobile (Jest):
  - `useLocationPermission` returns granted/denied đúng.
  - `useCurrentLocation` fallback khi denied.
- Manual smoke test trên iOS + Android sim (document trong Notes).

Test target: ~10 tests.

## Acceptance Criteria

- [x] 4 surfaces có map render.
- [x] Click map → set pickup/dest (customer).
- [x] Search bar → geocoding result.
- [x] Mobile permission flow đầy đủ 3 states.
- [x] Fallback Sài Gòn default center.
- [x] Token env-based, KHÔNG hard-code.
- [x] README mỗi mobile app document `expo prebuild` step.
- [x] Lint + build + test xanh.

## Prompt for Codex

Implement Task 015 đúng spec. Mapbox GL JS web + @rnmapbox/maps mobile. Shared MapView API. Geocoding autocomplete VN-filtered. Permission flow đầy đủ trên mobile. Current location hook. Pickup/destination markers customer side. Driver self marker. KHÔNG implement route calculation thật (defer T017). Mock SDK trong tests. Document expo prebuild + dev client setup. Finish với Summary, Changed files, Tests run, Notes.
