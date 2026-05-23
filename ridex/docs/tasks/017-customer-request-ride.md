# Task 017: Customer Request Ride Flow

## Task Name

Implement flow đặt xe phía customer trên cả web + mobile: pickup + destination picker, fare estimate preview (real-time qua backend addon), surge multiplier display, confirm + tạo ride.

## Goal

Customer mở app → thấy map với current location làm pickup mặc định → tap "Where to?" → nhập destination → quay lại map với 2 marker + polyline → bottom card show fare estimate (base + surge) → tap "Confirm" → POST /rides → navigate sang Tracking screen (T018).

## Context

- T015 đã có MapView + LocationSearch + geocoding.
- T016 đã có api-client + TanStack Query.
- Backend Task 003 `POST /rides` với body `{ pickup, destination }`, response Ride DTO. Task 008 auto-save pricing snapshot ngay sau khi ride.requested.
- Vấn đề: Customer cần biết giá TRƯỚC khi tạo ride. Backend hiện CHƯA có endpoint `POST /rides/quote`. Cần backend addon.

## Backend addon cần thiết

### `POST /rides/quote` (mới)
Request:
```json
{ "pickup": { "lat": 10.7769, "lng": 106.7009 }, "destination": { "lat": 10.8231, "lng": 106.6297 } }
```
Response:
```json
{
  "data": {
    "distanceMeters": 12500,
    "durationSeconds": 1500,
    "baseFareVnd": 12000,
    "perKmVnd": 5000,
    "perMinVnd": 500,
    "surgeMultiplier": 1.2,
    "totalVnd": 105000,
    "currency": "VND",
    "estimatedAt": "2026-05-18T05:00:00.000Z",
    "expiresInSeconds": 60
  }
}
```

Backend tasks deferred to follow-up implementation (T017-backend-addon hoặc inline trong T017). Implementation outline:
- New module `rides/quote/` hoặc reuse `pricing` + `routing`.
- Compute distance + duration qua `RouteEstimator` (Task 006 OSRM client với fallback haversine).
- Compute surge qua `SurgeService` reuse (Task 008).
- KHÔNG persist `pricing_snapshots` (read-only quote). Snapshot vẫn lock khi ride.requested.
- Idempotency: stateless, không key.
- Authentication: customer JWT required.
- Rate limit: 60 req/min per user (defer to phase 8 if not implemented).

Auth + lint + ~5 tests cho endpoint.

### Files frontend

```
apps/web-customer/src/
  app/(app)/
    home/page.tsx                      # Update: home với MapView fullscreen
  components/ride/
    pickup-destination-picker.tsx      # Bottom sheet picker
    fare-estimate-card.tsx             # Hiển thị breakdown
    confirm-ride-button.tsx
  hooks/
    use-ride-quote.ts                  # TanStack mutation gọi /rides/quote
    use-create-ride.ts                 # TanStack mutation POST /rides
  lib/
    pickup-destination-store.ts        # Zustand: { pickup, destination, set... }

apps/mobile-customer/
  app/(tabs)/home.tsx                  # Update
  src/components/ride/
    pickup-destination-sheet.tsx       # @gorhom/bottom-sheet
    fare-estimate-card.tsx
    confirm-button.tsx
```

### UX flow chi tiết

**Bước 1 — Initial map**
- MapView fullscreen center current location.
- Top: SearchBar disabled với placeholder "Where to?"
- FAB bottom-right: "Center on me".
- Tap SearchBar → expand bottom sheet (mobile) hoặc full-page (web) với:
  - 2 inputs: "Pickup" (pre-filled current address via reverse geocoding) + "Destination" (empty, focused).
  - Recent searches list (defer — empty for T017).
  - Saved locations (defer).

**Bước 2 — Destination chosen**
- Sau khi user chọn destination từ search results:
  - Bottom sheet collapse.
  - Map zoom fit 2 markers.
  - Polyline placeholder render (straight line; OSRM-accurate sẽ render khi quote response về).
  - Bottom card slide up với fare estimate.

**Bước 3 — Fare estimate**
- `useRideQuote` mutation fire ngay khi cả 2 markers set.
- Loading state: skeleton card.
- Success: show
  - **Total VNĐ** big number top.
  - Breakdown nhỏ: base + distance×rate + time×rate + surge.
  - If `surgeMultiplier > 1.0`: badge "Giờ cao điểm ×1.2" với info icon → modal giải thích.
  - Estimated arrival: "~5 phút" (placeholder; T020 sẽ accurate với matching).
- Error: show retry CTA.

**Bước 4 — Confirm**
- Button "Đặt xe — 105,000 ₫" full-width primary.
- Tap → `useCreateRide` mutation POST `/rides` với pickup + destination.
- Loading: button → spinner.
- Success → navigate `/rides/{id}` (T018 tracking screen).
- Error 409 (active ride exists) → toast + redirect tracking active ride.

### State management

Zustand `pickup-destination-store`:
```typescript
type PickupDestState = {
  pickup: { lat: number; lng: number; address: string } | null;
  destination: { lat: number; lng: number; address: string } | null;
  setPickup: (p) => void;
  setDestination: (d) => void;
  clear: () => void;
};
```

Quote query keyed `["quote", pickup, destination]` với `enabled` chỉ khi both set, `staleTime` 30s.

### Form validation

- Cả pickup + destination phải có lat/lng.
- Distance không < 100m (cùng 1 chỗ).
- Distance không > 50km (out-of-service).
- Validate trước khi enable Confirm button.

## Out of Scope

- Multiple stops (chỉ 1 destination).
- Vehicle type selector (UberX, UberPool — chỉ 1 loại).
- Schedule ride (đặt trước giờ).
- Payment method picker (chỉ ví — wallet auto-charge).
- Promo code.
- Estimated time of arrival accurate (chỉ placeholder).
- Recent / saved locations.
- Voice search.
- Share ETA.
- Multi-language (VN only).

## Expected Files/Modules

~15 file frontend + 5 file backend addon (quote endpoint).

## Functional Requirements

- Mở home → map render < 2s.
- Search destination → 5 results.
- Select destination → quote fetch < 2s.
- Quote response valid → fare card display.
- Confirm → ride created → navigate tracking.
- Active ride exists → block create, redirect.
- Network error → retry CTA + toast.
- Web responsive: desktop full-page, mobile-web bottom sheet.
- Mobile: gesture handler smooth, sheet snap points 25% / 80%.

## Security Requirements

- Quote response KHÔNG cache cross-user (per-user-session only).
- Customer KHÔNG được set fare client-side — backend là source of truth.
- Customer KHÔNG được set driverUserId hay status — backend enforces.
- Pickup/destination lat/lng validate range trước khi gửi (-90..90, -180..180).
- KHÔNG lưu address user nhập vào analytics.

## Database Requirements

KHÔNG (chỉ frontend; backend addon T017 thêm endpoint không động schema).

## API/WebSocket Changes

- New `POST /rides/quote` (backend addon).
- KHÔNG WS changes.

## Business Rules

- Quote expires sau 60s — sau đó re-fetch khi confirm.
- Surge nếu apply phải show rõ với badge + info modal.
- Currency luôn VND.
- Round VND lên multiple of 1000 cho display (`Math.ceil(vnd / 1000) * 1000`).
- Confirm button disabled khi quote loading hoặc invalid.

## Edge Cases

- User di chuyển trong quá trình quote: pickup không update tự động (manual refresh).
- Backend trả `RIDE_ALREADY_ACTIVE`: redirect active ride.
- OSRM down: backend fallback haversine → quote vẫn về với `confidence: "low"` (Task 006). FE show note "Ước tính có thể chênh".
- Surge thay đổi giữa quote và confirm: ride dùng surge tại moment requested (Task 008 lock-at-requested).
- Pickup/destination quá gần (<100m): disable confirm + show "Quá gần".
- Destination ngoài tầm phục vụ: backend return error → show toast.

## Tests Required

- Backend addon:
  - Quote happy path returns valid breakdown.
  - Quote với pickup == destination → 400.
  - Quote unauthenticated → 401.
  - Quote driver role → 403 (chỉ customer).
  - Quote OSRM fallback → confidence flag.
- FE (Vitest + Testing Library web; Jest mobile):
  - PickupDestinationStore set/clear actions.
  - FareEstimateCard render với surge badge.
  - useRideQuote hook fire khi both set.
  - Confirm button disabled khi quote loading.
  - Active ride 409 → redirect.
- E2E (Playwright web; Maestro mobile):
  - Login → home → search dest → quote → confirm → tracking page.

Test target: ~15 tests (5 backend + 10 frontend).

## Acceptance Criteria

- [x] Customer chọn pickup + destination thấy fare.
- [x] Surge multiplier hiển thị khi >1.0.
- [x] Confirm tạo ride thành công.
- [x] Active ride dedupe.
- [x] Responsive web + mobile.
- [x] Quote endpoint với auth + validation.
- [x] Lint + build + test xanh.

## Prompt for Codex

Implement Task 017. Backend addon `POST /rides/quote` reuse RouteEstimator + SurgeService. FE: pickup/destination picker bottom sheet (web + mobile), fare estimate card với surge badge, confirm button. Zustand store cho 2 markers. TanStack mutations quote + create. Validation khoảng cách 100m-50km. Error handling: active ride 409 redirect, OSRM fallback notice. Tests backend + FE + E2E. Currency VND round-up 1000. Finish với Summary, Changed files, Tests run, Notes.
