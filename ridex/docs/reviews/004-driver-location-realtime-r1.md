# Review: Task 004 — Driver Location Realtime (Round 1)

**Task file:** `docs/tasks/004-driver-location-realtime.md`
**Implementer:** Codex
**Reviewer:** Claude (architect / senior reviewer)
**Date:** 2026-05-16

---

## Verdict: **PASS WITH FIXES**

Spec coverage rất tốt — Codex theo đúng từng acceptance criterion. Tests 128 → 177 (+49), lint clean, build clean. Tất cả hard-review rules được tôn trọng: identity từ `socket.data.user.id`, không trust client; `RolesGuard` + `JwtAuthGuard` cover REST; cache TTL có, không source-of-truth ở Redis; migration đúng format; module dependency direction `location → drivers` (đúng theo ARCHITECTURE).

Codex chose **option B** cho cache-clear-on-offline: `DriverLocationCacheService.handleDriverWentOffline` listens to `driver.went-offline` event và xoá Redis key. Đây là lựa chọn đúng — không bẻ direction `drivers → location` mà spec cấm.

Không có blocker. Các finding ở dưới đều là **should-improve** hoặc **nice-to-have** — Codex có thể merge và sửa trong PR follow-up nhỏ, không block move-on Task 005.

---

## Verification

```
pnpm lint:    clean (0 errors, 0 warnings)
pnpm build:   clean (nest build OK)
pnpm test:    23 suites, 177 tests passed  (+49 từ Task 003: 128 → 177)
```

Test breakdown của module mới:
- `haversine.spec.ts`: 3 tests
- `gps-jump-detection.service.spec.ts`: 6 tests
- `driver-location-cache.service.spec.ts`: 6 tests
- `drivers.service.spec.ts`: 7 tests
- `drivers.facade.spec.ts`: 4 tests
- `drivers.controller.spec.ts`: 5 tests
- `location.gateway.spec.ts`: 11 tests
- `env.validation.spec.ts`: +4 tests cho 6 keys mới
- Tổng: ~46 tests trực tiếp + 3 env tests = 49 ✅

---

## Blockers

None.

---

## Must Fix

None.

---

## Should Improve

### SI-1 — Issuer check trong gateway không khớp với AuthService

**File:** `src/location/gateways/location.gateway.ts:244-253`, `src/auth/auth.service.ts:254-256`

Gateway có check:

```typescript
private isValidAccessPayload(payload: JwtAccessPayloadWithIssuer): payload is JwtAccessPayload {
  const issuer = payload.iss;
  return (
    typeof payload.sub === "string" &&
    payload.sub.length > 0 &&
    ALL_ROLES.includes(payload.role as Role) &&
    (issuer === undefined || issuer === "ridex")
  );
}
```

Nhưng `AuthService.issueAndPersistTokens` ký token không có `iss`:

```typescript
const accessToken = await this.jwtService.signAsync(
  { sub: user.id, role: user.role },
  { secret: this.accessSecret, expiresIn: this.accessTtl }
);
```

→ Tokens thực tế luôn fall vào nhánh `issuer === undefined` → check không có tác dụng thực tế trong production. Wrong-issuer test pass chỉ vì test inject thủ công `iss: "other"`.

**Tác động:** Mild — nếu sau này AuthService bắt đầu ký với `iss` khác `"ridex"`, gateway sẽ silently reject tokens. Một quy ước implicit không được document.

**Đề xuất 2 cách (chọn một):**
- **A (Recommended):** Sign tokens với `iss: "ridex"` ở `AuthService` (cả access + refresh nếu phù hợp), thêm `iss?: string` vào `JwtAccessPayload`, và yêu cầu `iss === "ridex"` trong `JwtStrategy` lẫn gateway. Locked claim → defense in depth thật sự.
- **B:** Bỏ check `iss` khỏi gateway. Document quyết định "ridex chưa stamp `iss`" ở `auth.types.ts` để future change biết tự lock.

---

### SI-2 — Dead conditional trong `DriversService.setOnline`

**File:** `src/drivers/drivers.service.ts:60-64`

```typescript
if (shouldEmitOnline) {
  const onlineSince = existing?.isOnline === true && existing.onlineSince !== null
    ? existing.onlineSince
    : now;
  this.eventEmitter.emit(...)
}
```

`shouldEmitOnline = existing === null || !existing.isOnline`. Khi block này chạy, `existing?.isOnline === true` luôn `false` → nhánh `existing.onlineSince` không bao giờ chạy → `onlineSince` luôn `= now`.

**Đề xuất:**

```typescript
if (shouldEmitOnline) {
  this.eventEmitter.emit(
    DRIVER_WENT_ONLINE_EVENT,
    this.createDomainEvent<DriverWentOnlinePayload>(
      DRIVER_WENT_ONLINE_EVENT,
      driverId,
      { driverId, onlineSince: now.toISOString() },
      correlationId
    )
  );
}
```

---

### SI-3 — Race window trên emit của `setOnline`

**File:** `src/drivers/drivers.service.ts:32-73`

Flow hiện tại: `findOne` → quyết định `shouldEmitOnline` → `INSERT ... ON CONFLICT ...` → nếu `shouldEmitOnline` thì emit.

Hai request `setOnline` concurrent từ cùng `driverId` (vd driver mở 2 tab) có thể cùng đọc `existing.isOnline === false` (hoặc cùng `null`) và cùng emit `driver.went-online`. Postgres UPSERT serialise việc ghi nhưng JS read-then-decide không có lock.

**Tác động:** Trong thesis MVP, double-emit là noisy không phải bug correctness — Task 005 H3 indexer sẽ idempotent. Nhưng khi Matching (Task 007) consume event này, double-emit có thể trigger duplicate matching attempts.

**Đề xuất (chọn 1, không phải Task 004):**
- **A:** Dùng RETURNING từ UPSERT để biết row đã transition. Postgres syntax:
  ```sql
  INSERT ... ON CONFLICT (driver_id) DO UPDATE SET ...
  RETURNING (xmax = 0) AS inserted, "is_online", (SELECT "is_online" FROM "drivers" WHERE "driver_id" = $1) AS prev_state
  ```
  Phức tạp. Có thể defer.
- **B (Recommended cho follow-up):** Bọc read + write trong transaction với `SELECT ... FOR UPDATE`. Đơn giản, đúng pattern Task 003 đã dùng cho ride transitions.

**Defer-OK cho Task 004**, nhưng track ở Task 007 spec để Matching engine prep cho idempotent consumers.

---

### SI-4 — `lastSeenAt` không update khi accept location update

**File:** `src/drivers/drivers.service.ts` (no update path), `src/location/gateways/location.gateway.ts:201-206`

Hiện tại `lastSeenAt` chỉ được set khi `setOnline`/`setOffline`. Nếu driver online từ 09:00, gửi location updates liên tục đến 10:00, thì `GET /drivers/me/availability` lúc 10:00 vẫn trả `lastSeenAt: 09:00`.

**Tác động:** UX thesis demo — admin dashboard (Task 010) sẽ muốn biết "driver có gửi tin gần đây không", và `lastSeenAt = setOnline time` không trả lời câu đó.

**Đề xuất:**
Khi gateway accept location update, gọi `DriversFacade.touchLastSeen(driverId)` → `DriversService.touchLastSeen` chạy `UPDATE drivers SET last_seen_at = now() WHERE driver_id = $1`. Idempotent, không emit event. Có thể throttle (vd update DB tối đa 1 lần / 30s) để không spam writes — Redis có thể track `lastSeenAt`.

**Note:** Spec gốc không yêu cầu rõ behavior này. Có thể defer cho Task 010 admin dashboard nếu muốn giữ Task 004 nhỏ.

---

### SI-5 — `DomainEvent<T>` quá hẹp ở `common/domain-event.ts`

**File:** `src/common/domain-event.ts`

```typescript
export interface DomainEvent<TPayload> {
  ...
  aggregateType: "driver";
  emittedBy: "drivers" | "location";
  ...
}
```

Type lock này đến từ spec của tôi (Task 004 chỉ emit driver events). Khi Task 007 emit `ride.assigned`, Task 009 emit `payment.captured`, type này sẽ phải nới ra.

**Tác động:** Future tasks phải refactor type. Không phải bug của Codex.

**Đề xuất:** Đổi sang generics:

```typescript
export interface DomainEvent<
  TPayload,
  TAggregate extends string = string,
  TEmittedBy extends string = string
> {
  eventId: string;
  eventType: string;
  aggregateType: TAggregate;
  aggregateId: string;
  payload: TPayload;
  correlationId: string;
  occurredAt: string;
  emittedBy: TEmittedBy;
}
```

Cho phép module-level types specialise: `DomainEvent<DriverWentOnlinePayload, "driver", "drivers">`. Cho phép Task 007 dùng `DomainEvent<RideAssignedPayload, "ride", "matching">` mà không đụng common file.

---

## Nice to Have

### NH-1 — Speed soft-cap upper bound

`LOCATION_MAX_SPEED_MPS` validate cap = 200 m/s (~720 km/h). OK cho safety, nhưng commercial GPS hiếm khi vượt 100 m/s (360 km/h) — có thể tight bound xuống ~120 m/s khi gặp data thực tế.

### NH-2 — `errorMessage` switch có dead case

`location.gateway.ts:322-336` — `INVALID_PAYLOAD`, `DRIVER_OFFLINE`, `INTERNAL` không bao giờ được pass vào `errorMessage()` (chúng đều dùng inline message). Có thể narrow signature thành `Extract<LocationErrorCode, "STALE_TIMESTAMP" | "GPS_JUMP_DISTANCE" | "GPS_JUMP_SPEED">` cho explicit.

### NH-3 — `DriverLocationCacheService` không expose `key()` publicly

Method `key(driverId)` là `public` nhưng không có consumer ngoài chính class. Để `private` cho clean. (Trừ khi Task 005 H3 indexer plan share key format — nhưng key format là implementation detail, nên không export.)

### NH-4 — Logging coordinates ở debug level chưa được implement

Spec: "Driver location (lat/lng) may be logged at `debug` level only". Gateway hiện không log lat/lng ở bất kỳ level nào. OK (spec dùng "may"), nhưng debug trace cho dev local có thể cần — defer.

### NH-5 — RedisModule `lazyConnect: true`

`infra/redis/redis.client.ts:11` dùng `lazyConnect: true`. Tốt cho test (không cần Redis chạy để start app), nhưng production nên fail-fast: connect ngay khi bootstrap, throw nếu Redis down trong N giây. Có thể add health check ping ở `health.controller.ts` về sau.

---

## Architectural / Security Sanity Check

| Rule | Status |
|---|---|
| Driver identity từ `socket.data.user.id`, ignore payload | ✅ Stripped explicitly + identity never read from DTO |
| `RolesGuard` block CUSTOMER/ADMIN trên drivers REST | ✅ Class-level `@Roles(Role.DRIVER)` + spec test |
| JWT verify trong WS handshake | ✅ `verifyAsync` với `JWT_ACCESS_SECRET` |
| Cache TTL có, không SoT trong Redis | ✅ `SET ... EX <ttl>`, DB là SoT |
| Migration reversible | ✅ `down()` drops index + table |
| Module dependency direction | ✅ `location → drivers`; `drivers` không import `location` |
| Cross-module event qua EventEmitter2 | ✅ 3 events emit đúng envelope |
| Cache clear on offline | ✅ via `@OnEvent` listener trong cache service |
| Não cào field secret/token | ✅ Logger error chỉ log driverId + errorName |
| Không bypass auth, RBAC, ownership | ✅ |
| Không trust client-supplied driverId / payment / role | ✅ `stripSpoofedDriverId` + identity từ JWT |
| Không change schema không migration | ✅ Migration mới đúng location ownership rule |

Hard review rules pass.

---

## Exact instructions for Codex

Optional follow-up PR (`task-004-followup` branch hoặc cuối Task 004) — đều là code-cleanup nhỏ, không change behavior:

1. **SI-2:** Remove dead conditional in `drivers.service.ts:60-64`. Replace với chỉ `now`. Cập nhật test nếu cần (test hiện chỉ check `payload.driverId` nên không break).

2. **SI-1 (chọn A hoặc B):**
   - **A:** Add `iss: "ridex"` constant somewhere (vd `src/auth/auth.constants.ts`). Sign cả access và refresh với `issuer: "ridex"`. Update `JwtAccessPayload` thêm `iss: string`. Require `iss === "ridex"` trong cả `JwtStrategy.validate` (currently chỉ check sub + role) và gateway. Add test cho missing-iss case.
   - **B:** Bỏ block `(issuer === undefined || issuer === "ridex")` khỏi `isValidAccessPayload`. Remove `JwtAccessPayloadWithIssuer` type alias. Update `rejects missing, expired, malformed, and wrong-issuer tokens` test — xoá wrong-issuer subcase (hoặc reframe nó thành malformed-payload).
   - State trong PR summary chọn cách nào và why.

3. **SI-5:** Refactor `src/common/domain-event.ts` thành generic 3-param signature như trên. Cập nhật module-level types để pass concrete generics. Không thay đổi runtime behavior — chỉ type-level.

4. **SI-3, SI-4:** Defer — không đụng Task 004. Document trong Task 007 spec (matching engine):
   - SI-3: "Matching consumer phải idempotent vì `driver.went-online` có thể duplicate trong race."
   - SI-4: Decide ở Task 010 admin dashboard scope hoặc tách thành Task 004.1 nếu cần sớm.

5. **NH-2, NH-3:** Nice-to-have cleanup nếu có thời gian. Không block.

**Move on Task 005 (H3 Discovery) được**, không cần round 2.

---

## Note for Codex

Code chất lượng cao — spec dày nên rủi ro lệch ý đồ thấp, nhưng Codex execute đầy đủ, không tự ý thêm scope (vd không add rate limit, không add persistent history, không build customer subscription). Cách Codex chọn "location listens to event" thay vì "drivers inject interface" là đúng dependency direction.

Một observation cho riêng tôi (architect): `infra/socket-io/configured-socket-io.adapter.ts` không có trong "Expected Files/Modules" của spec, nhưng Codex thêm để honour `WS_PATH` và `CORS_ORIGINS` cho WebSocket. Đây là correct addition — spec yêu cầu CORS reuse + path từ env nhưng không nói explicit phải tạo adapter mới. Codex tự suy ra đúng. Tốt.

Tests đáng khen: gateway spec cover được cả `iss: "other"` case (mặc dù nó là dead defense, nhưng test coverage đủ); `stripSpoofedDriverId` được verify; `INTERNAL` ack được verify; ack-callback-omitted case được verify.

---

**Reviewer signature:** Claude (architect, reviewer)
**Status:** ✅ PASS WITH FIXES — 5 should-improve + 5 nice-to-have, không blocker, không must-fix. Move on Task 005 được.
