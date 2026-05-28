# Task 024 — Driver E2E Maestro

## Task Name

Bootstrap Maestro for mobile-driver and cover the offer + in-ride race conditions that survived T019/T020 review.

## Goal

T019/T020 review tìm thấy 3 race condition (xem `docs/reviews/020-driver-offer-flow-r1.md`). 1 trong số đó (TIMEOUT vs ALREADY_FINALIZED ack) đã có unit test ở `packages/socket-client`. 2 race còn lại — offer state leak khi driver offline, và COMPLETED redirect — là React effect lifecycle bugs, không thể unit-test sạch trong workspace pnpm multi-React-version hiện tại. Maestro E2E là phương án verify được approved trong `docs/FRONTEND_PLAN.md` ("Test | Mobile: Jest + Maestro").

Task này bootstrap Maestro infrastructure cho `apps/mobile-driver` và cover 2 flow tối thiểu, để các regression tương lai bị catch trước merge.

## Context

- 3 race condition đã fix trong nhánh `feat/015-mapbox-integration` (commits T019/T020 follow-up):
  1. ✅ `withAckTimeout` — covered by `packages/socket-client/src/__tests__/offer.test.ts`.
  2. ❌ `useDriverOffer({ enabled: false })` phải clear offer + invalidate cache — chưa có test.
  3. ❌ In-ride page detect `COMPLETED` từ `transition.data?.status` (mutation result), không phải từ `useDriverActiveRide()` query — chưa có test.
- Mobile-driver hiện tại chỉ có jest unit test cho pure modules. `apps/mobile-driver/jest.config.js` comment giải thích "native UI covered by Maestro E2E in T024" — task này là cái T024 đó.
- Repo chưa có `.maestro/`, chưa có Maestro CLI binary, chưa có seed script tạo offer cho driver. Mọi thứ phải bootstrap.

## Scope

- Cài Maestro CLI vào dev setup (document cách cài, không commit binary).
- Tạo cấu trúc `apps/mobile-driver/.maestro/` với 2 flow YAML:
  - `offer-leak-on-offline.yaml` — verify fix #2.
  - `complete-ride-redirect.yaml` — verify fix #3.
- Tạo backend seed/utility để tạo deterministic test data: 1 driver account + 1 customer account + ability để programmatically push 1 ride offer tới driver. Có thể là CLI script hoặc admin-only HTTP endpoint chỉ enabled khi `NODE_ENV !== "production"`.
- Document hướng dẫn chạy ở `apps/mobile-driver/.maestro/README.md`: prereq, lệnh chạy local, lệnh chạy CI.
- Update `docs/FRONTEND_PLAN.md`: chính thức ghi T024 vào roadmap.

## Out of Scope

- Maestro Cloud integration (chỉ local + future CI).
- iOS Simulator setup (Android emulator đủ cho thesis; iOS để future task).
- Full coverage của tất cả driver flow — chỉ 2 flow cho 2 regression cụ thể.
- Customer-side E2E (riêng task khác).
- Performance / load testing.

## Expected Files/Modules

- `apps/mobile-driver/.maestro/offer-leak-on-offline.yaml` — new.
- `apps/mobile-driver/.maestro/complete-ride-redirect.yaml` — new.
- `apps/mobile-driver/.maestro/config.yaml` — Maestro project config (appId, env vars).
- `apps/mobile-driver/.maestro/README.md` — setup + run instructions.
- `apps/mobile-driver/.maestro/fixtures/` — fixture JSON cho seed (nếu cần).
- `apps/backend/src/testing/e2e-seed.controller.ts` (hoặc CLI script `apps/backend/scripts/seed-e2e.ts`) — programmatic test data setup, gated by `NODE_ENV !== "production"`.
- `apps/backend/src/testing/e2e-seed.controller.spec.ts` — unit test cho gating.
- `docs/FRONTEND_PLAN.md` — add T024 entry.
- `.github/workflows/` — optional E2E job (defer nếu CI runner chưa hỗ trợ Android emulator).

## Functional Requirements

**Flow 1: `offer-leak-on-offline.yaml`**

1. Launch app, đã login sẵn (via Maestro `launchApp` + `clearState` + seeded auth token in storage, hoặc qua login flow).
2. Tap "GO" để online.
3. Trigger backend seed: tạo offer cho driver này.
4. Assert: OfferScreen modal hiển thị với pickup/destination info.
5. Tap "STOP" (xác nhận trên Alert).
6. Assert: OfferScreen biến mất trong < 2s.
7. Online lại — assert OfferScreen KHÔNG xuất hiện lại với offer cũ (cache đã invalidate).

**Flow 2: `complete-ride-redirect.yaml`**

1. Launch app, login, online.
2. Trigger seed: tạo offer + auto-accept (hoặc tap Accept trong Maestro).
3. Đợi điều hướng tới `/ride/[id]` screen.
4. Maestro tap qua chain: Arrived → Start → Complete (3 transition button taps).
5. Assert: Alert "Hoàn thành" xuất hiện với payout estimate text.
6. Tap "Tiếp tục" trên Alert.
7. Assert: app điều hướng về home tab (StatusPill visible) trong < 3s.
8. Assert: home không hiển thị "Bạn đang không có chuyến nào" trước khi Alert show (regression: trước fix, user sẽ thấy empty state flash trước khi Alert xuất hiện).

## Security Requirements

- E2E seed endpoint/script PHẢI gated bởi `NODE_ENV !== "production"`. Phải có unit test verify endpoint trả 404 khi `NODE_ENV === "production"`.
- Test accounts chỉ tồn tại trong dev/test database — KHÔNG seed vào production migration.
- KHÔNG hard-code production credentials trong YAML flow hoặc README.
- Auth token cho test driver phải short-lived (≤ 1h TTL) và rotated mỗi test run.

## Database Requirements

- KHÔNG cần migration mới. Seed script dùng existing schema.
- Seed phải idempotent: chạy nhiều lần không fail (DELETE existing test rows trước INSERT).
- Phải clean up sau test (xóa test driver/customer/ride rows). Có thể là `afterAll` hook trong Maestro hoặc script riêng `pnpm run e2e:teardown`.

## API/WebSocket Changes

- (Tùy chọn) New endpoint `POST /testing/seed-offer` — admin/system role only, gated bởi `NODE_ENV`. Body: `{ driverUserId, pickup, destination }`. Response: `{ offerId, rideId }`. Đẩy offer event qua existing matching pipeline.
- Alternative: standalone Node script `pnpm --filter @ridex/backend seed-e2e` không thông qua HTTP — gọi service trực tiếp.
- KHÔNG thay đổi existing API contracts.

## Business Rules

- Test data PHẢI dùng same ride state machine + matching engine như production code path (no test-only shortcuts mà bypass validation).
- Test driver PHẢI có valid `Driver` record (KYC fields, vehicle info) thỏa current schema constraint.

## Edge Cases

- App đang offline khi Maestro tap "STOP" — flow vẫn phải pass (offline call may fail, nhưng OfferScreen vẫn phải clear local-side).
- Backend trigger seed nhưng driver socket chưa connect — flow phải retry / wait với explicit timeout (Maestro `waitForAnimationToEnd` + `extendedWaitUntil`).
- Network latency giữa transition `mutate` và `Alert.alert` — flow phải dùng `extendedWaitUntil` với 5s timeout, không dùng fixed sleep.
- Maestro flaky retry: cấu hình max 3 retries per flow trong CI; local single-run.

## Tests Required

- 2 Maestro flow YAML chạy được local trên Android emulator.
- 1 jest unit test cho seed endpoint/script: assert returns/exits non-zero khi `NODE_ENV === "production"`.
- README phải verify được bằng cách follow step-by-step trên máy mới.

## Acceptance Criteria

- [ ] `maestro test apps/mobile-driver/.maestro/offer-leak-on-offline.yaml` pass trên Android emulator.
- [ ] `maestro test apps/mobile-driver/.maestro/complete-ride-redirect.yaml` pass trên Android emulator.
- [ ] Seed endpoint/script gated bởi `NODE_ENV`; jest test cho gating pass.
- [ ] README có lệnh exact để cài Maestro CLI (Windows + macOS + Linux), build dev client, chạy flow, cleanup data.
- [ ] `docs/FRONTEND_PLAN.md` ghi T024 done với link tới flow files.
- [ ] Cả 2 flow phải fail nếu revert 1 trong 2 fix (manual verify: tạm revert fix #2 hoặc #3, chạy flow, confirm fail; sau đó restore fix).
- [ ] KHÔNG có production credentials hoặc bypass auth trong flow files.

## Prompt for Codex

```
Implement Task 024 (Driver E2E Maestro) per docs/tasks/024-driver-e2e-maestro.md.

Constraints:
- Read the task spec end-to-end first. Do not deviate.
- Phase 1 (do this first, stop, ask for review):
  1. Bootstrap `.maestro/` directory structure + config.yaml + README.md (skeleton only, document install/run).
  2. Add seed endpoint OR script (your choice — argue trade-off in PR summary).
  3. Add jest test for NODE_ENV gating.
  4. Update FRONTEND_PLAN.md.
  STOP and ask for review before writing flow YAML.
- Phase 2 (after Phase 1 approved):
  5. Write offer-leak-on-offline.yaml.
  6. Write complete-ride-redirect.yaml.
  7. Run both locally on Android emulator, attach screenshots/recording.
  8. Manually verify each flow fails when its corresponding fix is reverted (acceptance criterion).

Out of scope reminders:
- No iOS, no Maestro Cloud, no customer flows, no schema migrations.
- Seed must be NODE_ENV-gated; refusal to gate = blocker.

Deliverable format:
- One PR per phase.
- PR summary: command-by-command setup steps, screenshots of green Maestro runs, evidence of negative test (fix reverted → flow fails).
```

## Notes / Open Questions

- **Maestro on Windows**: Maestro CLI requires JDK + Android SDK platform-tools. README phải document Scoop install hoặc manual JDK setup.
- **CI integration**: Defer cho task riêng (T025?). GitHub-hosted Linux runners không có Android emulator pre-installed; cần self-hosted runner hoặc service như BrowserStack. Phase 1 chỉ local.
- **Seed strategy choice**: endpoint vs script — Codex chọn dựa trên: (a) endpoint dễ trigger từ Maestro (HTTP call qua `evalScript`) nhưng tăng attack surface; (b) script cần Maestro chạy shell qua `runScript` (cross-platform khó). Recommend endpoint với strong gating.
- **Test data lifecycle**: nếu nhiều test chạy parallel cần unique driver per test run (UUID suffix) để tránh collision. Phase 1 single-run OK; multi-run defer.
