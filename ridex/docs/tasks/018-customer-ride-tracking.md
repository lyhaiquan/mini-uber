# Task 018: Customer Ride Tracking + Live Map

## Task Name

Implement màn tracking ride phía customer: state machine UI (REQUESTED → ... → COMPLETED), live driver position trên map qua WebSocket, ETA, action buttons (cancel), receipt screen sau khi completed.

## Goal

Sau khi customer confirm ride (T017), navigate tới `/rides/{id}` (web) hoặc `/ride/[id]` (mobile). Screen show map với pickup + destination markers + driver marker (khi đã assigned) + polyline route. Status card slide-up show state hiện tại + driver info + ETA. Cancel button (theo state machine rules). Khi COMPLETED → modal receipt với payment breakdown.

## Context

- Backend Task 003 ride state machine: REQUESTED → MATCHING → ACCEPTED → DRIVER_ARRIVED → IN_PROGRESS → COMPLETED. Terminal CANCELLED / NO_DRIVERS_FOUND.
- Task 004 driver location updates qua WS `driver.location-updated`.
- Task 007 emits `ride.matching.no-drivers`, offer events.
- Task 009 payment auto-charge khi ride.completed.
- Backend hiện CHƯA có:
  - WS event forward driver position to customer (rideId room).
  - `GET /rides/:id` cho customer (Task 003 chỉ có RidesFacade internal).
  - `GET /me/payments?rideId=X` (Task 022 add full version).

## Backend addon cần thiết

### 1. `GET /rides/:id` (read-only customer view)
Auth: customer or admin or driver assigned. Customer chỉ xem ride của mình. Response: full ride DTO + driver summary (id, displayName, vehicleInfo nếu có) + pricing snapshot summary.

Driver detail field: backend hiện không có "displayName" hay "vehicleInfo" — chỉ user.email. Defer cosmetic. T018 trả về `driverUserId` + `driver: { id, masked email "a***@" }`.

### 2. WS event `ride.driver-location` per-ride room

Backend hiện emit `driver.location-updated` global. Cần:
- WS namespace cho customer subscribe theo rideId: `socket.emit("ride.subscribe", { rideId })`.
- Backend authorizes: customer chỉ subscribe ride của mình.
- Khi driver assigned ride update location → backend forward sang room `ride:{rideId}` event `ride.driver-location` với `{ rideId, driverUserId, lat, lng, headingDeg, timestamp }`.

### 3. WS event `ride.status-changed`

Khi ride transition → emit room `ride:{rideId}` event `ride.status-changed` với new status + metadata.

### 4. `POST /rides/:id/transitions` (existing Task 003)

Customer có thể trigger transition CANCELLED. Already exists.

## Scope

### Files frontend

```
apps/web-customer/src/
  app/(app)/rides/[id]/page.tsx
  components/ride/
    ride-status-card.tsx               # state chip + driver info + actions
    state-machine-stepper.tsx          # progress stepper visualisation
    driver-card.tsx                    # avatar + name + vehicle + call/chat placeholder
    cancel-confirm-dialog.tsx
    receipt-modal.tsx                  # payment breakdown
  hooks/
    use-ride.ts                        # query GET /rides/:id
    use-ride-ws.ts                     # subscribe WS event
    use-cancel-ride.ts                 # mutation transition CANCELLED

apps/mobile-customer/
  app/ride/[id].tsx
  src/components/ride/
    status-bottom-sheet.tsx
    state-stepper.tsx
    driver-card.tsx
    cancel-button.tsx
    receipt-sheet.tsx
```

### packages/socket-client (mới)

`packages/socket-client/src/index.ts`:
```typescript
import { io, type Socket } from "socket.io-client";

export function createSocket(opts: {
  url: string;
  getToken: () => string | null;
  onAuthError: () => void;
}): Socket {
  const socket = io(opts.url, {
    auth: (cb) => cb({ token: opts.getToken() }),
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    transports: ["websocket"]
  });
  socket.on("connect_error", (err) => {
    if (err.message === "Unauthorized") opts.onAuthError();
  });
  return socket;
}
```

Mỗi app singleton wrapper:
```typescript
// apps/web-customer/src/lib/socket.ts
let socket: Socket | null = null;
export function getSocket() {
  if (socket === null) socket = createSocket({ url, getToken, onAuthError });
  return socket;
}
```

### useRideWs hook

```typescript
export function useRideWs(rideId: string) {
  const qc = useQueryClient();
  const [driverPosition, setDriverPosition] = useState<DriverPosition | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socket.emit("ride.subscribe", { rideId });
    socket.on("ride.driver-location", (payload) => {
      if (payload.rideId === rideId) setDriverPosition({ lat: payload.lat, lng: payload.lng });
    });
    socket.on("ride.status-changed", (payload) => {
      if (payload.rideId === rideId) {
        qc.setQueryData(["rides", rideId], (old) => old ? { ...old, status: payload.toStatus } : old);
      }
    });
    return () => {
      socket.emit("ride.unsubscribe", { rideId });
      socket.off("ride.driver-location");
      socket.off("ride.status-changed");
    };
  }, [rideId]);

  return { driverPosition };
}
```

### Map composition

`<RideTrackingMap pickup={...} destination={...} driverPosition={driverPosition} route={polyline} />`.

Khi `driverPosition` update: map smooth-animate driver marker.
Khi state == ACCEPTED: focus camera fit driver + pickup.
Khi state == IN_PROGRESS: focus camera fit driver + destination.
Khi state == COMPLETED: fit pickup + destination.

### State machine stepper

5 steps: REQUESTED → MATCHING → ACCEPTED → IN_PROGRESS → COMPLETED.
Current step highlighted. Past steps checked. Future steps gray.
CANCELLED hoặc NO_DRIVERS_FOUND: stepper hiển thị error chip thay vì progress.

### Cancel flow

Theo Task 003 allowed transitions, customer có thể cancel ở REQUESTED / MATCHING / ACCEPTED (trước khi driver arrived). After DRIVER_ARRIVED customer cancel có thể chịu phí (out of scope).
Dialog confirm "Hủy chuyến?" → POST `/rides/:id/transitions` body `{ toStatus: "CANCELLED", reason: "customer_cancelled" }`.

### Receipt

Khi state COMPLETED → fetch payment qua `GET /me/payments?rideId=` (Task 022 endpoint; nếu chưa có, fetch `GET /rides/:id` có pricing snapshot info). Hiển thị:
- Total VNĐ.
- Distance + duration actual.
- Surge multiplier nếu apply.
- Payment method "Ví RideX".
- Driver name + rating placeholder.
- Close button → home.

## Out of Scope

- Rating / review driver.
- Tipping.
- Chat / call driver.
- Share ride status.
- Receipt PDF download.
- History past rides (T022).
- Multi-leg ride.

## Expected Files/Modules

~20 file FE + 3 file backend addons.

## Functional Requirements

- Customer mở /rides/:id → ride data load < 1s.
- WS connect trong 2s, subscribe room.
- Driver location update → marker animate smooth (interpolate 1s).
- State change từ backend → UI reflect < 500ms.
- Cancel button hiển thị đúng theo state (Task 003 rules).
- Cancel success → state CANCELLED → redirect home với toast.
- Completed → receipt auto-modal.
- NO_DRIVERS_FOUND → error state với CTA "Thử lại".

## Security Requirements

- Customer chỉ xem ride của mình (backend `GET /rides/:id` enforces).
- WS subscribe `ride.subscribe` backend verify `ride.customerId == socket.user.id`.
- KHÔNG show driver email / phone trừ khi đã ACCEPTED.
- Driver location WS chỉ forward sau khi ACCEPTED (không leak driver position khi đang MATCHING).
- Receipt KHÔNG show platform-internal payment IDs.

## Database Requirements

KHÔNG (backend addon `GET /rides/:id` chỉ read).

## API/WebSocket Changes

- New REST: `GET /rides/:id`.
- New WS events: `ride.subscribe`, `ride.unsubscribe`, `ride.driver-location`, `ride.status-changed`.
- Backend `LocationGateway` thêm logic forward `driver.location-updated` → check assigned ride → emit room.

## Business Rules

- Polyline route render qua Mapbox Directions API hoặc reuse backend OSRM result (cache trong ride DTO field `routePolyline`).
- Stepper màu: completed = green, current = primary blue, future = gray, error = red.
- Driver marker rotate theo heading (nếu backend forward heading).
- Pickup marker fade khi driver arrived.

## Edge Cases

- WS disconnect mid-ride: show banner "Mất kết nối, đang thử lại" + fall back polling `useRide` every 5s.
- Driver location stale (>10s no update): show "Đang chờ vị trí mới...".
- Customer reload page mid-ride: reconnect WS + re-subscribe.
- Ride completed trong khi customer ở status MATCHING screen (very fast): jump straight to receipt.
- Backend trả 404 (ride deleted): toast + redirect home.
- Multiple tabs cùng ride: cả 2 nhận update OK.

## Tests Required

- Backend addon:
  - `GET /rides/:id` happy + 403 cho customer khác + 404.
  - WS `ride.subscribe` authorized only customer của ride.
  - `ride.driver-location` chỉ emit sau ACCEPTED.
- FE:
  - StateMachineStepper render đúng step.
  - useRideWs subscribe/unsubscribe.
  - Driver marker animate khi position update.
  - Cancel dialog → mutation → status changed.
  - Receipt modal khi COMPLETED.
- E2E:
  - Customer create ride → mock driver accept → UI update.

Test target: ~15 tests.

## Acceptance Criteria

- [x] Customer xem ride real-time qua WS.
- [x] State machine UI reflect chính xác.
- [x] Driver position animate smooth.
- [x] Cancel work theo Task 003 rules.
- [x] Receipt khi completed.
- [x] WS reconnect tự động.
- [x] Polling fallback nếu WS down.
- [x] Backend WS authorization tight.
- [x] Lint + build + test xanh.

## Prompt for Codex

Implement Task 018. Backend addon: GET /rides/:id read-only customer + WS room ride:{rideId} với events driver-location + status-changed + subscribe/unsubscribe. FE customer tracking: map với pickup/dest/driver markers, state stepper, status card, cancel dialog, receipt modal. socket-client package. useRideWs hook subscribe + unsubscribe + polling fallback. Driver location forward chỉ sau ACCEPTED. Customer cancel theo Task 003 rules. Tests backend WS auth + FE state machine + E2E flow. Finish với Summary, Changed files, Tests run, Notes.
