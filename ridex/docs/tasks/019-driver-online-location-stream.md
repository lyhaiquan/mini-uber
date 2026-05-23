# Task 019: Driver Online Toggle + Location Streaming

## Task Name

Driver app: toggle online/offline (POST /drivers/me/online|offline), stream GPS location qua WebSocket khi online, hiển thị availability state, handle location permission denial, foreground service hint trên mobile.

## Goal

Driver login → home screen show map với current location + "GO" button big center → tap GO → app gọi /drivers/me/online → WS connect + start emit `driver.location.update` event mỗi 5s (configurable). Driver thấy state "Online" với timer. Tap GO again hoặc khi quit app → /drivers/me/offline → stop emit.

## Context

- Backend Task 004 đã có `POST /drivers/me/online|offline` + WS gateway listen `driver.location.update`.
- Backend GPS jump detection (Task 004): reject update với speed > 55 m/s hoặc distance jump > 1000m within 30s.
- Backend H3 driver index update on each location (Task 005).
- Mobile foreground location: iOS cần `NSLocationWhenInUseUsageDescription`. Background location require always permission + foreground service Android. T019 chỉ làm foreground (app open).
- Locked decisions: emit interval 5s, không emit khi app background (foreground only T019).

## Scope

### Files

```
apps/web-driver/src/
  app/(app)/home/page.tsx              # update với "GO" button + map
  components/driver/
    online-toggle.tsx                  # big circular GO button
    earnings-strip.tsx                 # placeholder (T022)
    status-pill.tsx                    # "Online" / "Offline" indicator
  hooks/
    use-driver-status.ts               # query GET /drivers/me/availability
    use-go-online.ts                   # mutation POST /online
    use-go-offline.ts
    use-location-stream.ts             # geolocation watch + WS emit

apps/mobile-driver/
  app/(tabs)/home.tsx                  # update
  src/components/driver/
    online-toggle.tsx
    status-pill.tsx
    permission-banner.tsx              # if location denied
  src/hooks/
    use-location-stream.ts             # expo-location watchPosition + WS emit
    use-driver-status.ts
```

### Online toggle UX

State machine UI:
- **Offline** (default): big gray button "GO" + label "Tap để bắt đầu nhận chuyến".
- **Going Online** (loading): button spinner.
- **Online**: green pulsing button "STOP" + timer counter + count rides today.
- **Going Offline** (loading): button spinner.
- **Error**: revert + toast.

Confirmation dialog khi STOP: "Tắt trạng thái online?" để tránh tap nhầm.

### Location stream hook

Web:
```typescript
export function useLocationStream({ enabled, intervalMs = 5000 }) {
  useEffect(() => {
    if (!enabled) return;
    const socket = getSocket();
    const watchId = navigator.geolocation.watchPosition(
      (pos) => socket.emit("driver.location.update", {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        headingDeg: pos.coords.heading ?? undefined,
        speedMps: pos.coords.speed ?? undefined,
        accuracyMeters: pos.coords.accuracy,
        capturedAt: new Date().toISOString()
      }),
      (err) => console.warn("[location]", err.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled, intervalMs]);
}
```

Mobile (expo-location):
```typescript
const sub = await Location.watchPositionAsync(
  { accuracy: Location.Accuracy.High, timeInterval: intervalMs, distanceInterval: 10 },
  (loc) => socket.emit("driver.location.update", { /* same shape */ })
);
return () => sub.remove();
```

Throttle: native `timeInterval` 5s đủ. Web `watchPosition` không throttle native, hook tự throttle 5s qua lodash.throttle.

### Permission handling

Mobile:
- Mở app lần đầu → request permission.
- Denied → banner "Cần quyền vị trí để online" + button "Mở cài đặt".
- Restricted → giống denied.
- Background không request (foreground only).

Web:
- Geolocation API prompt khi tap GO lần đầu.
- Denied: toast "Cần cho phép truy cập vị trí" + GO button vẫn offline.

### Driver status persistence

Khi app close, server vẫn nghĩ driver online cho đến khi:
- 30s không heartbeat → backend sweeper (Task 005) mark offline.
- Hoặc app gửi `/offline` explicit.

T019 add: app close hoặc backgrounded → gửi `/offline` best-effort.
- Web: `window.beforeunload` → `navigator.sendBeacon("/api/drivers/offline", "")`.
- Mobile: `AppState` listener change to "background" → gọi offline endpoint.

### WebSocket auth (already done T016 socket-client)

Connect with JWT in `auth.token` handshake. Backend verify JWT + role=DRIVER for `driver.location.update` event.

### Earnings strip placeholder

Top of driver home: "Hôm nay: 0₫ • 0 chuyến". Real data T022.

## Out of Scope

- Background location khi app closed (cần foreground service Android + always permission iOS).
- Auto-online on app boot.
- Driver scheduling.
- Heatmap demand areas.
- Driver pool selection (vehicle type).
- Battery optimization (defer).
- Tile prefetch.
- Driver chat.

## Expected Files/Modules

~15 file FE.

## Functional Requirements

- Tap GO → online API → WS emit start → status pill "Online".
- WS emit interval đúng 5s.
- Tap STOP confirm → offline API → WS emit stop → pill "Offline".
- Permission denied → banner + cannot online.
- App background → offline auto best-effort.
- App reopen → check `/drivers/me/availability` → restore state.
- Network drop mid-stream: retry connect, banner "Mất kết nối".
- Location jump (Task 004 rejects) → silent ignore (FE không show), log debug.

## Security Requirements

- WS event `driver.location.update` chỉ emit khi role DRIVER + online state.
- KHÔNG log coords (privacy).
- KHÔNG persist coords vào localStorage / asyncstorage.
- App background → stop emit (không track silent).

## Database Requirements

KHÔNG.

## API/WebSocket Changes

KHÔNG (chỉ consume existing).

## Business Rules

- Driver cannot be ONLINE và CUSTOMER trong cùng account (backend enforces qua role).
- Emit interval 5s match backend expected throughput (Task 004 spec).
- Speed > 55 m/s reject backend (already done) — FE không filter.
- Heading optional (some devices không có).

## Edge Cases

- iOS sim: location permission auto-grant qua scheme; coords fixed unless override.
- Android emu: extended controls cần manually set location.
- Permission revoked giữa session: app detect via `Linking.addEventListener` resume → re-check → force offline if denied.
- WS connect fail khi tap GO: rollback online state, toast retry.
- 2 driver app instance cùng login (web + mobile): cả 2 emit — backend last-write-wins (acceptable).

## Tests Required

- Hook tests (Vitest web; Jest mobile):
  - useLocationStream: emit khi enabled, stop khi disabled.
  - usePermissionStatus: granted/denied/undetermined branches.
  - useGoOnline / useGoOffline mutations.
- Component tests:
  - OnlineToggle renders state.
  - PermissionBanner shows on denied.
- E2E:
  - Driver login → tap GO → API called → WS subscribe → tap STOP → API offline.
  - Permission denied → toast.

Test target: ~12 tests.

## Acceptance Criteria

- [x] Driver toggle online/offline via UI.
- [x] WS emit interval 5s.
- [x] Permission flow đầy đủ.
- [x] App background → auto offline.
- [x] Reconnect on network drop.
- [x] Driver status pill phản ánh state.
- [x] Lint + build + test xanh.

## Prompt for Codex

Implement Task 019. Driver online toggle UI (web + mobile), location stream qua WS interval 5s, permission handling đầy đủ 3 states, app-background auto-offline best-effort, status pill, confirm dialog khi STOP. Mobile dùng expo-location watchPositionAsync với timeInterval+distanceInterval. Web dùng navigator.geolocation.watchPosition + throttle. KHÔNG implement background location. Tests hooks + components + E2E. Finish với Summary, Changed files, Tests run, Notes.
