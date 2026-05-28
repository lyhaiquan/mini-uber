# Task 024 — Driver E2E Maestro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap Maestro infrastructure cho `apps/mobile-driver` và viết 2 flow regression-cover hai race condition còn lại sau T019/T020 (offer leak khi offline + COMPLETED redirect).

**Architecture:** Phase 1 chuẩn bị nền (Maestro skeleton, NODE_ENV-gated seed endpoint trong NestJS, FRONTEND_PLAN update). Phase 2 viết YAML flow + manual negative verification. Seed endpoint reuse existing `MatchingFacade.dispatchOffer`/auth signup paths để không bypass state machine — chỉ gating bằng `NODE_ENV` guard.

**Tech Stack:** Maestro CLI (Android emulator), NestJS controller + ConfigService, Jest, existing `auth`/`drivers`/`rides`/`matching` modules. KHÔNG migration, KHÔNG dependency mới phía mobile.

---

## File Structure

**Created:**
- `ridex/apps/backend/src/testing/testing.module.ts` — Nest module conditionally registered chỉ khi `NODE_ENV !== "production"`.
- `ridex/apps/backend/src/testing/e2e-seed.controller.ts` — `POST /testing/seed-driver-offer` endpoint.
- `ridex/apps/backend/src/testing/e2e-seed.service.ts` — orchestrate signup driver+customer, place online, push ride request, trigger offer.
- `ridex/apps/backend/src/testing/e2e-seed.controller.spec.ts` — Jest unit test cho gating + 404 trong production mode.
- `ridex/apps/backend/src/testing/dto/seed-driver-offer-request.dto.ts` + `seed-driver-offer-response.dto.ts`.
- `ridex/apps/mobile-driver/.maestro/config.yaml`
- `ridex/apps/mobile-driver/.maestro/README.md`
- `ridex/apps/mobile-driver/.maestro/offer-leak-on-offline.yaml`
- `ridex/apps/mobile-driver/.maestro/complete-ride-redirect.yaml`
- `ridex/apps/mobile-driver/.maestro/fixtures/seed.json` (chỉ pickup/destination coords, không credentials).

**Modified:**
- `ridex/apps/backend/src/app.module.ts` — conditional import `TestingModule`.
- `ridex/docs/FRONTEND_PLAN.md` — thêm entry T024 done.

---

## Phase 1 — Backend seed + Maestro skeleton

### Task 1: Tạo TestingModule + DTO

**Files:**
- Create: `ridex/apps/backend/src/testing/testing.module.ts`
- Create: `ridex/apps/backend/src/testing/dto/seed-driver-offer-request.dto.ts`
- Create: `ridex/apps/backend/src/testing/dto/seed-driver-offer-response.dto.ts`

- [ ] **Step 1: Tạo request DTO**

```ts
// dto/seed-driver-offer-request.dto.ts
import { IsLatitude, IsLongitude, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class LatLngDto {
  @IsLatitude() lat!: number;
  @IsLongitude() lng!: number;
}

export class SeedDriverOfferRequestDto {
  @IsOptional() @IsString() @MaxLength(64) testRunId?: string;
  @ValidateNested() @Type(() => LatLngDto) pickup!: LatLngDto;
  @ValidateNested() @Type(() => LatLngDto) destination!: LatLngDto;
}
```

- [ ] **Step 2: Tạo response DTO**

```ts
// dto/seed-driver-offer-response.dto.ts
export interface SeedDriverOfferResponseDto {
  driver: { userId: string; email: string; accessToken: string; refreshToken: string };
  customer: { userId: string; email: string };
  rideId: string;
  offerId: string;
}
```

- [ ] **Step 3: Tạo skeleton TestingModule (chưa register vào app)**

```ts
// testing.module.ts
import { Module } from "@nestjs/common";
import { E2ESeedController } from "./e2e-seed.controller";
import { E2ESeedService } from "./e2e-seed.service";
import { AuthModule } from "../auth/auth.module";
import { DriversModule } from "../drivers/drivers.module";
import { RidesModule } from "../rides/rides.module";
import { MatchingModule } from "../matching/matching.module";
import { LocationModule } from "../location/location.module";

@Module({
  imports: [AuthModule, DriversModule, RidesModule, MatchingModule, LocationModule],
  controllers: [E2ESeedController],
  providers: [E2ESeedService]
})
export class TestingModule {}
```

- [ ] **Step 4: Commit**

```bash
git add ridex/apps/backend/src/testing/
git commit -m "feat(024): TestingModule skeleton + seed DTOs"
```

---

### Task 2: NODE_ENV gating test FIRST (TDD)

**Files:**
- Create: `ridex/apps/backend/src/testing/e2e-seed.controller.spec.ts`
- Create: `ridex/apps/backend/src/testing/e2e-seed.controller.ts` (stub sau)

- [ ] **Step 1: Viết failing test**

```ts
// e2e-seed.controller.spec.ts
import { Test } from "@nestjs/testing";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TestingModule as NestTestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";

describe("E2ESeedController gating", () => {
  async function buildApp(nodeEnv: string): Promise<INestApplication> {
    // Helper: dynamically include TestingModule only when NODE_ENV !== "production"
    // mirroring app.module.ts logic.
    const { AppModule } = await import("../app.module");
    process.env.NODE_ENV = nodeEnv;
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = mod.createNestApplication();
    await app.init();
    return app;
  }

  it("returns 404 when NODE_ENV === 'production'", async () => {
    const app = await buildApp("production");
    const res = await request(app.getHttpServer())
      .post("/testing/seed-driver-offer")
      .send({ pickup: { lat: 10.77, lng: 106.70 }, destination: { lat: 10.78, lng: 106.71 } });
    expect(res.status).toBe(404);
    await app.close();
  });

  it("returns 200/201 when NODE_ENV === 'test'", async () => {
    const app = await buildApp("test");
    const res = await request(app.getHttpServer())
      .post("/testing/seed-driver-offer")
      .send({ pickup: { lat: 10.77, lng: 106.70 }, destination: { lat: 10.78, lng: 106.71 } });
    expect([200, 201]).toContain(res.status);
    expect(res.body).toMatchObject({ rideId: expect.any(String), offerId: expect.any(String) });
    await app.close();
  });
});
```

- [ ] **Step 2: Chạy test, expect FAIL**

```bash
pnpm --filter @ridex/backend test -- e2e-seed.controller.spec
```

Expected: cả 2 fail vì controller chưa có.

- [ ] **Step 3: Implement controller stub + service stub đủ pass gating test**

```ts
// e2e-seed.controller.ts
import { Body, Controller, Post } from "@nestjs/common";
import { Public } from "../auth/guards/public.decorator"; // verify exact path; có thể là @SkipAuth tùy convention
import { SeedDriverOfferRequestDto } from "./dto/seed-driver-offer-request.dto";
import type { SeedDriverOfferResponseDto } from "./dto/seed-driver-offer-response.dto";
import { E2ESeedService } from "./e2e-seed.service";

@Controller("testing")
export class E2ESeedController {
  constructor(private readonly seed: E2ESeedService) {}

  @Public()
  @Post("seed-driver-offer")
  async seedDriverOffer(@Body() body: SeedDriverOfferRequestDto): Promise<SeedDriverOfferResponseDto> {
    return this.seed.seedDriverOffer(body);
  }
}
```

```ts
// e2e-seed.service.ts (stub — full body trong Task 3)
import { Injectable } from "@nestjs/common";
import type { SeedDriverOfferRequestDto } from "./dto/seed-driver-offer-request.dto";
import type { SeedDriverOfferResponseDto } from "./dto/seed-driver-offer-response.dto";

@Injectable()
export class E2ESeedService {
  async seedDriverOffer(_input: SeedDriverOfferRequestDto): Promise<SeedDriverOfferResponseDto> {
    return {
      driver: { userId: "stub", email: "stub", accessToken: "stub", refreshToken: "stub" },
      customer: { userId: "stub", email: "stub" },
      rideId: "stub",
      offerId: "stub"
    };
  }
}
```

- [ ] **Step 4: Wire conditional import trong app.module.ts**

```ts
// app.module.ts — thêm vào imports[]
...(process.env.NODE_ENV !== "production" ? [TestingModule] : []),
```

Mở `ridex/apps/backend/src/app.module.ts`, locate `imports: [` array, thêm dòng trên ở cuối array. Import `TestingModule` ở top of file.

- [ ] **Step 5: Chạy test lại, expect PASS**

```bash
pnpm --filter @ridex/backend test -- e2e-seed.controller.spec
```

Expected: cả 2 test pass.

- [ ] **Step 6: Commit**

```bash
git add ridex/apps/backend/src/testing/ ridex/apps/backend/src/app.module.ts
git commit -m "feat(024): NODE_ENV-gated seed endpoint with 404 in production"
```

---

### Task 3: Implement E2ESeedService — tạo driver+customer+offer thật

**Files:**
- Modify: `ridex/apps/backend/src/testing/e2e-seed.service.ts`

- [ ] **Step 1: Đọc các facade hiện có để biết signature**

```bash
ls ridex/apps/backend/src/auth/auth.facade.ts ridex/apps/backend/src/drivers/ ridex/apps/backend/src/matching/matching.facade.ts ridex/apps/backend/src/rides/
```

Nắm rõ:
- `AuthFacade.register(...)` cho cả CUSTOMER + DRIVER role — nếu register chưa support DRIVER (per "Deferred items from Task 002"), seed service phải gọi `UsersService` trực tiếp + tạo `Driver` record qua repo, sau đó issue token qua AuthService.
- `LocationFacade.acceptLocation(driverUserId, lat, lng)` để index H3 và đặt driver online (hoặc gọi `DriversService.goOnline` trực tiếp).
- `RidesFacade.requestRide(customerUserId, pickup, destination)` → trả ride với status REQUESTED.
- `MatchingFacade` event-driven: gọi trên `ride.requested`. Nếu cần force-dispatch, dùng method tương đương `dispatchOfferToDriver(rideId, driverUserId)`.

- [ ] **Step 2: Implement full service**

```ts
// e2e-seed.service.ts
import { Injectable, BadRequestException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { AuthFacade } from "../auth/auth.facade";
import { DriversFacade } from "../drivers/drivers.facade";
import { LocationFacade } from "../location/location.facade";
import { RidesFacade } from "../rides/rides.facade";
import { MatchingFacade } from "../matching/matching.facade";
import { Role } from "../users/dto/role.enum";
import type { SeedDriverOfferRequestDto } from "./dto/seed-driver-offer-request.dto";
import type { SeedDriverOfferResponseDto } from "./dto/seed-driver-offer-response.dto";

@Injectable()
export class E2ESeedService {
  constructor(
    private readonly auth: AuthFacade,
    private readonly drivers: DriversFacade,
    private readonly location: LocationFacade,
    private readonly rides: RidesFacade,
    private readonly matching: MatchingFacade
  ) {}

  async seedDriverOffer(input: SeedDriverOfferRequestDto): Promise<SeedDriverOfferResponseDto> {
    if (process.env.NODE_ENV === "production") {
      // Defense-in-depth: ngay cả khi TestingModule lọt vào prod, vẫn từ chối.
      throw new BadRequestException("seed disabled in production");
    }

    const runId = input.testRunId ?? randomUUID().slice(0, 8);
    const driverEmail = `e2e-driver-${runId}@ridex.test`;
    const customerEmail = `e2e-customer-${runId}@ridex.test`;
    const password = "E2eMaestroTest!2026";

    const driver = await this.auth.registerDriver({
      email: driverEmail,
      password,
      fullName: `E2E Driver ${runId}`,
      // vehicle info đáp ứng schema constraint:
      vehiclePlate: `E2E-${runId.toUpperCase()}`,
      vehicleModel: "Test Honda Wave"
    });

    const customer = await this.auth.register({
      email: customerEmail,
      password,
      fullName: `E2E Customer ${runId}`,
      role: Role.CUSTOMER
    });

    // Online driver tại pickup để H3 discovery pick được.
    await this.drivers.goOnline(driver.user.userId);
    await this.location.acceptLocation(driver.user.userId, input.pickup.lat, input.pickup.lng);

    const ride = await this.rides.requestRide(customer.user.userId, {
      pickup: input.pickup,
      destination: input.destination
    });

    // Force dispatch để Maestro không phải race với event-loop async.
    const offer = await this.matching.dispatchOfferToDriver(ride.id, driver.user.userId);

    return {
      driver: {
        userId: driver.user.userId,
        email: driverEmail,
        accessToken: driver.tokens.accessToken,
        refreshToken: driver.tokens.refreshToken
      },
      customer: { userId: customer.user.userId, email: customerEmail },
      rideId: ride.id,
      offerId: offer.id
    };
  }
}
```

**Note nếu method tên khác:** Codex phải verify exact signature trong facade files; nếu `AuthFacade.registerDriver` chưa tồn tại (Task 002 deferred), Codex chọn 1 trong 2:
1. Bổ sung method vào AuthFacade (KÈM unit test) — preferable.
2. Dùng `UsersService.create` + `DriversService.createProfile` + `AuthService.issueTokens` trực tiếp trong service này.
Document choice trong PR summary.

- [ ] **Step 3: Update gating test để check seed thật trả non-stub rideId/offerId**

Trong `e2e-seed.controller.spec.ts` test "test mode" case, assert `rideId !== "stub"` và format UUID-ish.

- [ ] **Step 4: Chạy test**

```bash
pnpm --filter @ridex/backend test -- e2e-seed
```

Expected: PASS. Nếu fail vì missing facade method, lùi về Step 2 note để chọn approach.

- [ ] **Step 5: Smoke test thủ công với Postgres+Redis local**

```bash
cd ridex && pnpm --filter @ridex/backend start:dev
# Trong shell khác:
curl -X POST http://localhost:3000/api/v1/testing/seed-driver-offer \
  -H "Content-Type: application/json" \
  -d '{"pickup":{"lat":10.77,"lng":106.70},"destination":{"lat":10.78,"lng":106.71}}'
```

Expected: 200/201 với rideId + offerId hợp lệ. Verify trong DB có driver + customer + ride + offer rows.

- [ ] **Step 6: Commit**

```bash
git add ridex/apps/backend/src/testing/e2e-seed.service.ts ridex/apps/backend/src/testing/e2e-seed.controller.spec.ts
git commit -m "feat(024): seed real driver+customer+offer via existing facades"
```

---

### Task 4: Maestro skeleton + README

**Files:**
- Create: `ridex/apps/mobile-driver/.maestro/config.yaml`
- Create: `ridex/apps/mobile-driver/.maestro/README.md`
- Create: `ridex/apps/mobile-driver/.maestro/fixtures/seed.json`

- [ ] **Step 1: Tạo config.yaml**

```yaml
# .maestro/config.yaml
appId: com.ridex.driver
env:
  API_BASE_URL: http://10.0.2.2:3000/api/v1
  SEED_PICKUP_LAT: "10.77"
  SEED_PICKUP_LNG: "106.70"
  SEED_DEST_LAT: "10.78"
  SEED_DEST_LNG: "106.71"
```

(`10.0.2.2` là alias localhost cho Android emulator. iOS skip per spec.)

- [ ] **Step 2: Tạo fixtures**

```json
// .maestro/fixtures/seed.json
{
  "pickup": { "lat": 10.77, "lng": 106.70 },
  "destination": { "lat": 10.78, "lng": 106.71 }
}
```

- [ ] **Step 3: Tạo README**

```markdown
# Mobile-Driver Maestro E2E

## Prereq

### macOS
\`\`\`bash
brew tap mobile-dev-inc/tap
brew install maestro
\`\`\`

### Linux
\`\`\`bash
curl -Ls "https://get.maestro.mobile.dev" | bash
\`\`\`

### Windows (PowerShell)
\`\`\`powershell
iwr -useb https://get.maestro.mobile.dev/windows | iex
\`\`\`
(Yêu cầu JDK 17+ và Android SDK platform-tools trong PATH.)

## Build dev client (one-time)

\`\`\`bash
cd ridex/apps/mobile-driver
pnpm expo prebuild --platform android
pnpm expo run:android
\`\`\`

## Backend setup

\`\`\`bash
cd ridex
NODE_ENV=development pnpm --filter @ridex/backend start
\`\`\`

Verify gating:
\`\`\`bash
curl -X POST http://localhost:3000/api/v1/testing/seed-driver-offer \\
  -H "Content-Type: application/json" -d @apps/mobile-driver/.maestro/fixtures/seed.json
\`\`\`

## Run flows

\`\`\`bash
cd ridex/apps/mobile-driver
maestro test .maestro/offer-leak-on-offline.yaml
maestro test .maestro/complete-ride-redirect.yaml
\`\`\`

## Cleanup test data

Hiện tại: dữ liệu seed dùng email `e2e-driver-*@ridex.test`. Cleanup thủ công:
\`\`\`sql
DELETE FROM users WHERE email LIKE 'e2e-%@ridex.test';
\`\`\`
(Cascade xóa driver/ride/offer rows.)

## CI

Defer to T025. Local-only cho Phase 1.
```

- [ ] **Step 4: Commit**

```bash
git add ridex/apps/mobile-driver/.maestro/config.yaml ridex/apps/mobile-driver/.maestro/README.md ridex/apps/mobile-driver/.maestro/fixtures/
git commit -m "feat(024): Maestro skeleton + README"
```

---

### Task 5: Update FRONTEND_PLAN.md

**Files:**
- Modify: `ridex/docs/FRONTEND_PLAN.md`

- [ ] **Step 1: Tìm section roadmap/task status**

```bash
grep -n -E "T022|T023|Task 02" ridex/docs/FRONTEND_PLAN.md | head -20
```

- [ ] **Step 2: Thêm entry T024**

Sau entry T022, chèn:

```markdown
- **T024 — Driver E2E Maestro** ✅ DONE
  - Mục đích: cover 2 race condition residual của T019/T020 bằng Maestro flow.
  - Files: `apps/mobile-driver/.maestro/{offer-leak-on-offline,complete-ride-redirect}.yaml`.
  - Backend: `POST /testing/seed-driver-offer` (NODE_ENV-gated).
  - CI defer: T025.
```

- [ ] **Step 3: Commit**

```bash
git add ridex/docs/FRONTEND_PLAN.md
git commit -m "docs(024): record T024 in FRONTEND_PLAN"
```

**🛑 CHECKPOINT — kết thúc Phase 1. Ask reviewer (Claude) trước khi sang Phase 2.**

---

## Phase 2 — Maestro flow YAML + negative verification

### Task 6: offer-leak-on-offline.yaml

**Files:**
- Create: `ridex/apps/mobile-driver/.maestro/offer-leak-on-offline.yaml`

- [ ] **Step 1: Viết flow**

```yaml
# offer-leak-on-offline.yaml
appId: com.ridex.driver
env:
  API_BASE_URL: http://10.0.2.2:3000/api/v1
---
- launchApp:
    clearState: true
- runScript:
    file: scripts/seed.js
    env:
      API_BASE_URL: ${API_BASE_URL}
# scripts/seed.js sẽ POST seed endpoint, lưu accessToken vào MAESTRO output.
# Maestro `runScript` chạy JS thông qua engine built-in; output truy cập qua `output.SEED_*`.
- assertVisible: "Đăng nhập"
- tapOn: "Email"
- inputText: ${output.SEED_DRIVER_EMAIL}
- tapOn: "Mật khẩu"
- inputText: "E2eMaestroTest!2026"
- tapOn: "Đăng nhập"
- assertVisible:
    text: "GO"
    timeout: 8000
- tapOn: "GO"
- assertVisible:
    text: "Chuyến mới"   # OfferScreen header
    timeout: 8000
- tapOn: "STOP"
- tapOn: "Xác nhận"      # Alert confirm offline
- assertNotVisible:
    text: "Chuyến mới"
    timeout: 3000
- tapOn: "GO"            # Online lại
- assertNotVisible:
    text: "Chuyến mới"   # Offer cũ KHÔNG được leak lại
    timeout: 5000
```

- [ ] **Step 2: Tạo `scripts/seed.js` để Maestro gọi seed endpoint**

```js
// .maestro/scripts/seed.js
const url = MAESTRO_ENV.API_BASE_URL + "/testing/seed-driver-offer";
const body = JSON.stringify({
  testRunId: "leak-" + Date.now(),
  pickup: { lat: 10.77, lng: 106.70 },
  destination: { lat: 10.78, lng: 106.71 }
});
const res = http.post(url, { body, headers: { "Content-Type": "application/json" } });
const data = json(res.body);
output.SEED_DRIVER_EMAIL = data.driver.email;
output.SEED_RIDE_ID = data.rideId;
output.SEED_OFFER_ID = data.offerId;
```

- [ ] **Step 3: Chạy flow trên Android emulator**

```bash
cd ridex/apps/mobile-driver
maestro test .maestro/offer-leak-on-offline.yaml
```

Expected: green, < 30s.

- [ ] **Step 4: Commit**

```bash
git add ridex/apps/mobile-driver/.maestro/offer-leak-on-offline.yaml ridex/apps/mobile-driver/.maestro/scripts/
git commit -m "feat(024): Maestro flow — offer leak on offline"
```

---

### Task 7: complete-ride-redirect.yaml

**Files:**
- Create: `ridex/apps/mobile-driver/.maestro/complete-ride-redirect.yaml`

- [ ] **Step 1: Viết flow**

```yaml
# complete-ride-redirect.yaml
appId: com.ridex.driver
env:
  API_BASE_URL: http://10.0.2.2:3000/api/v1
---
- launchApp:
    clearState: true
- runScript:
    file: scripts/seed.js
    env:
      API_BASE_URL: ${API_BASE_URL}
- tapOn: "Email"
- inputText: ${output.SEED_DRIVER_EMAIL}
- tapOn: "Mật khẩu"
- inputText: "E2eMaestroTest!2026"
- tapOn: "Đăng nhập"
- tapOn: "GO"
- assertVisible:
    text: "Chuyến mới"
    timeout: 8000
- tapOn: "Nhận chuyến"   # Accept button
- assertVisible:
    text: "Chuyến hiện tại"
    timeout: 5000
- tapOn: "Đã đến điểm đón"     # Arrived
- tapOn: "Bắt đầu chuyến"      # Start
- tapOn: "Hoàn thành"          # Complete
- extendedWaitUntil:
    visible:
      text: "Ước tính thu nhập"
    timeout: 5000
# Regression check: trước Alert, KHÔNG được flash empty state.
- assertNotVisible: "Bạn đang không có chuyến nào"
- tapOn: "Tiếp tục"
- assertVisible:
    text: "GO"           # Quay về home tab
    timeout: 3000
```

- [ ] **Step 2: Chạy flow**

```bash
maestro test .maestro/complete-ride-redirect.yaml
```

Expected: green.

- [ ] **Step 3: Commit**

```bash
git add ridex/apps/mobile-driver/.maestro/complete-ride-redirect.yaml
git commit -m "feat(024): Maestro flow — complete ride redirect"
```

---

### Task 8: Negative verification (acceptance gate)

Mục đích: confirm cả 2 flow thực sự cover regression. Nếu revert fix → flow phải fail.

- [ ] **Step 1: Revert fix #2 (offer leak)**

Trong `ridex/apps/mobile-driver/src/hooks/use-driver-offer.ts:53-60`, tạm comment block:
```ts
if (!enabled) {
  setOffer(null);
  void qc.invalidateQueries({ queryKey: offerKeys.current() });
  return;
}
```
Thay bằng `if (!enabled) return;` (giả lập state trước fix).

- [ ] **Step 2: Chạy offer-leak flow**

```bash
maestro test .maestro/offer-leak-on-offline.yaml
```

Expected: **FAIL** ở step `assertNotVisible: "Chuyến mới"` sau GO lại.

- [ ] **Step 3: Restore fix #2**

```bash
git checkout ridex/apps/mobile-driver/src/hooks/use-driver-offer.ts
```

- [ ] **Step 4: Revert fix #3 (COMPLETED redirect)**

Trong `ridex/apps/mobile-driver/app/ride/[id].tsx:42-58`, thay `useEffect` driven by `transition.data` bằng version cũ dùng `useDriverActiveRide()` (Codex tham chiếu git log commit T020 follow-up để biết version cũ).

- [ ] **Step 5: Chạy complete-ride flow**

```bash
maestro test .maestro/complete-ride-redirect.yaml
```

Expected: **FAIL** ở `assertNotVisible: "Bạn đang không có chuyến nào"` (empty state flash trước Alert).

- [ ] **Step 6: Restore fix #3**

```bash
git checkout ridex/apps/mobile-driver/app/ride/[id].tsx
```

- [ ] **Step 7: Final clean run cả 2 flow**

```bash
maestro test .maestro/offer-leak-on-offline.yaml && \
maestro test .maestro/complete-ride-redirect.yaml
```

Expected: cả 2 green.

- [ ] **Step 8: Document negative test trong PR summary**

Trong PR Phase 2, ghi rõ:
- Screenshot/recording green run cả 2 flow.
- Console output FAIL khi revert fix (Step 2 + Step 5) — proof regression coverage.

- [ ] **Step 9: Final commit nếu có chỉnh sửa flow file sau negative test**

```bash
git add ridex/apps/mobile-driver/.maestro/
git commit -m "test(024): verified flows fail on regression (manual)"
```

---

## Acceptance Checklist

Mỗi criterion trong spec đã ánh xạ ít nhất 1 task:

- [x] `maestro test offer-leak-on-offline.yaml` pass — Task 6 + 8
- [x] `maestro test complete-ride-redirect.yaml` pass — Task 7 + 8
- [x] Seed gated bởi NODE_ENV + jest test pass — Task 2
- [x] README cài đặt Windows/macOS/Linux + run commands — Task 4
- [x] FRONTEND_PLAN update — Task 5
- [x] Negative test (revert fix → fail) — Task 8
- [x] KHÔNG production credentials trong YAML — flow chỉ dùng `${output.SEED_DRIVER_EMAIL}` từ runtime seed.

---

## Notes for Codex

- **Facade method gaps**: nếu `AuthFacade.registerDriver` hoặc `MatchingFacade.dispatchOfferToDriver` chưa tồn tại, Codex bổ sung KÈM unit test mới — không bypass module boundaries.
- **Maestro on Windows**: README dùng `iwr | iex` cần PowerShell exec policy; nếu blocker, fallback hướng dẫn download zip thủ công.
- **Seed cleanup**: spec yêu cầu idempotent. Service hiện DELETE-by-pattern? KHÔNG — dùng unique `testRunId` mỗi run để tránh collision. Cleanup script `pnpm run e2e:teardown` defer (acceptable per spec "có thể là").
- **Public decorator**: Codex verify exact path trong `auth/guards/` — có thể là `@SkipAuth()`, `@Public()`, hoặc convention khác.
