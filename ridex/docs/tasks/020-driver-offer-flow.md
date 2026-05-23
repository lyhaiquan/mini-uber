# Task 020: Driver Offer Modal + In-Ride Screen

## Task Name

Driver app nhận ride offer qua WS, hiển thị modal countdown 15s với customer info + pickup, accept/reject buttons. Khi accept: transition state, navigate in-ride screen với driver-side state machine (ACCEPTED → DRIVER_ARRIVED → IN_PROGRESS → COMPLETED).

## Goal

Driver online → backend matching engine assign offer (Task 007) → WS push `ride.offer.created` event → mobile vibrate + sound + modal full-screen với 15s countdown. Driver tap Accept → POST transition ACCEPTED → modal close → in-ride screen với map nav tới pickup. Driver tap Reject → POST transition REJECTED → modal close → matching engine pass tới driver kế.

## Context

- Backend Task 007 matching engine emit WS events:
  - `ride.offer.created` to driver (qua `OfferGateway`).
  - `ride.offer.expired`, `ride.offer.cancelled`.
  - Driver respond qua WS event `ride.offer.accept` / `ride.offer.reject` (already implemented Task 007).
- Backend timeout 15s configurable `MATCHING_OFFER_TIMEOUT_SECONDS`.
- Sau accept, ride transition ACCEPTED qua backend matching service automatic.
- Driver dùng `POST /rides/:id/transitions` Task 003 cho DRIVER_ARRIVED, IN_PROGRESS, COMPLETED.

## Backend addon cần thiết

### `GET /me/driver/offers/current` (REST fallback)
Trong trường hợp WS chưa connect khi offer issue: REST poll mỗi 3s tìm pending offer. Response: current offer DTO hoặc null.

### `GET /me/driver/active-ride` (REST)
Driver reload app: fetch active ride (status IN [ACCEPTED, DRIVER_ARRIVED, IN_PROGRESS]) để restore in-ride screen.

## Scope

### Files

```
apps/web-driver/src/
  app/(app)/home/page.tsx              # update: render OfferModal khi có offer
  app/(app)/rides/[id]/page.tsx        # in-ride screen
  components/driver/
    offer-modal.tsx                    # countdown + accept/reject
    in-ride-map.tsx                    # navigation hint
    transition-button.tsx              # next-state CTA
    customer-card.tsx                  # masked customer info
  hooks/
    use-driver-offer.ts                # WS subscribe + REST fallback
    use-accept-offer.ts                # WS emit
    use-reject-offer.ts
    use-ride-transition.ts             # POST /rides/:id/transitions

apps/mobile-driver/
  app/(tabs)/home.tsx
  app/ride/[id].tsx                    # in-ride screen
  src/components/driver/
    offer-screen.tsx                   # full-screen modal (mobile native)
    in-ride-nav.tsx
    transition-button.tsx
  src/hooks/
    use-driver-offer.ts                # WS + Notifications haptic + sound
```

### Offer modal UX (mobile)

Full-screen overlay khi `ride.offer.created` arrive:
- Top: countdown circle 15 → 0 animated.
- Mid: pickup address + distance + estimated payout (computed: total × 0.8 driver share).
- Mid: destination preview address.
- Bottom: 2 buttons fill-width — "Từ chối" (gray) + "Nhận chuyến" (primary green).
- Vibration on appear (single 200ms pulse).
- Sound: short notification chime (mobile only).
- Auto-dismiss khi count reach 0 → emit reject implicit (or accept timeout → backend handles).

Web tương tự nhưng centered modal với backdrop blur.

### WS event handling

```typescript
export function useDriverOffer() {
  const [offer, setOffer] = useState<Offer | null>(null);
  const router = useRouter();
  useEffect(() => {
    const socket = getSocket();
    socket.on("ride.offer.created", (payload) => {
      setOffer(payload);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);  // mobile only
    });
    socket.on("ride.offer.expired", (payload) => {
      if (offer?.offerId === payload.offerId) setOffer(null);
    });
    socket.on("ride.offer.cancelled", (payload) => {
      if (offer?.offerId === payload.offerId) setOffer(null);
    });
    return () => {
      socket.off("ride.offer.created");
      socket.off("ride.offer.expired");
      socket.off("ride.offer.cancelled");
    };
  }, [offer?.offerId]);

  return offer;
}
```

### Accept flow

```typescript
const accept = () => {
  socket.emit("ride.offer.accept", { offerId: offer.offerId }, (response) => {
    if (response.ok) {
      setOffer(null);
      router.push(`/rides/${offer.rideId}`);
    } else {
      toast.error(response.error.message);  // race lost
    }
  });
};
```

Race condition handling: backend Task 007 SI flagged (acknowledge semantics). FE handle ack timeout 3s → assume race lost → revert UI.

### Reject flow

```typescript
const reject = () => {
  socket.emit("ride.offer.reject", { offerId: offer.offerId, reason: "driver_declined" });
  setOffer(null);
};
```

### In-ride screen

Screen `apps/web-driver/src/app/(app)/rides/[id]/page.tsx` (similar mobile):

- Map full với driver position + pickup marker (pre-IN_PROGRESS) hoặc destination marker (post).
- Bottom card:
  - Status pill: ACCEPTED / DRIVER_ARRIVED / IN_PROGRESS.
  - Customer name (masked) + pickup/destination address.
  - Big CTA button next state:
    - ACCEPTED → "Đã đến điểm đón" → POST transition DRIVER_ARRIVED.
    - DRIVER_ARRIVED → "Bắt đầu chuyến" → IN_PROGRESS.
    - IN_PROGRESS → "Hoàn thành" → COMPLETED.
  - Secondary: "Báo cáo sự cố" (defer placeholder).

After COMPLETED → modal "Hoàn thành! Thu nhập ước tính: 80,000₫" + button "Tiếp tục online" → back home.

### State machine guard

Bấm CTA chỉ enable nếu rule allow current state. Disable + tooltip nếu không.

### Restore active ride on reload

`use-active-ride.ts`: query `/me/driver/active-ride`. Nếu có ride status active → redirect `/rides/{id}`.

## Out of Scope

- Turn-by-turn navigation (chỉ map + address).
- Cancel ride driver-side mid-trip (out of T020).
- Driver chat customer.
- Rating customer.
- Driver decline reason taxonomy.
- Multiple consecutive offers queue.
- Sound on web.
- Customer photo / avatar (just initials).
- Driver earnings counter real-time (T022).

## Expected Files/Modules

~15 file FE + 2 backend addons.

## Functional Requirements

- WS offer → modal trong 500ms.
- Countdown decrement đúng 1s/step.
- Accept → ride active → in-ride screen.
- Reject → modal close → driver vẫn online.
- Timeout 15s → modal auto-close (backend mark expired).
- In-ride state transition theo Task 003 rules.
- App reload → restore active ride.
- 1 offer active tại 1 lúc (backend Task 007 unique constraint).

## Security Requirements

- WS accept/reject backend verify driver match offer.driverId.
- Customer info masked: chỉ first name + first letter last (e.g., "Bob L.").
- KHÔNG show customer phone / full email.
- Pickup address full chỉ sau accept; pre-accept show distance + general area.

## Database Requirements

KHÔNG.

## API/WebSocket Changes

- New REST: `GET /me/driver/offers/current`, `GET /me/driver/active-ride`.
- WS events: consume existing.

## Business Rules

- Offer modal blocking — driver không tap được gì khác.
- Estimated payout = total × driverShareBps / 10000 (lấy snapshot từ offer payload).
- Multiple offers cùng lúc: backend Task 007 chỉ 1 active per driver — FE trust.
- Reject lý do mặc định `driver_declined`.

## Edge Cases

- Offer arrive khi driver bấm STOP: backend race → offer cancelled → modal disappear.
- WS disconnect khi modal open: REST poll fallback every 3s.
- Backend ack timeout: revert UI + toast "Mạng chậm, thử lại".
- 2 offers in flight (shouldn't happen but defensive): show latest, ignore previous.
- App backgrounded khi offer arrive: notification (push) — defer to push notification task. T020 chỉ in-app modal.
- Customer cancel ride mid in-ride: receive `ride.cancelled` → modal "Khách đã hủy" → back home.

## Tests Required

- Backend addon endpoints (3 tests).
- FE hooks:
  - useDriverOffer subscribe/unsubscribe.
  - Accept emit + ack.
  - Reject emit.
  - Timeout auto-dismiss.
- Component:
  - OfferModal countdown.
  - In-ride transition buttons enable based on state.
- E2E (Maestro):
  - Driver online → mock backend send offer → accept → navigate in-ride.

Test target: ~15 tests.

## Acceptance Criteria

- [x] WS offer modal full-screen với countdown.
- [x] Accept/reject work với backend Task 007.
- [x] In-ride state machine UI hoạt động.
- [x] Reload restore active ride.
- [x] Customer info masked.
- [x] Race conditions handled (timeout, conflicts).
- [x] Lint + build + test xanh.

## Prompt for Codex

Implement Task 020. Backend addons GET /me/driver/offers/current + active-ride. FE driver offer modal full-screen 15s countdown + haptic + sound (mobile), accept/reject WS emit với ack timeout 3s. In-ride screen state machine: ACCEPTED → DRIVER_ARRIVED → IN_PROGRESS → COMPLETED via POST transitions. Customer info masked. Restore active ride on reload. Race conditions handled. Tests hooks + components + E2E. Finish với Summary, Changed files, Tests run, Notes.
