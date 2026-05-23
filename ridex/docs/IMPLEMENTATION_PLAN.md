# Implementation Plan

## Phase 0: Project Foundation

### Goal

Create repository structure, documentation, local conventions, and agent workflow.

### Main Tasks

- Add agent guides and project docs.
- Define task and review templates.
- Decide initial package layout.
- Set up basic Git and CI expectations.

### Deliverables

- Markdown documentation.
- Initial task list.
- Basic repository conventions.

### Done Criteria

- Codex and Claude have clear operating instructions.
- Tasks are small enough to implement and review.

## Phase 1: Core Backend + Database

### Goal

Create the NestJS backend foundation and database connection.

### Main Tasks

- Initialize backend app.
- Add health check.
- Add config validation.
- Add global validation pipe and exception filter.
- Add PostgreSQL connection.
- Add migration tooling.

### Deliverables

- Running backend service.
- Health endpoint.
- Database connection and migration workflow.

### Done Criteria

- App starts locally.
- Health check returns success.
- Config errors fail fast.
- Empty migration workflow is verified.

## Phase 2: Auth + Users + Drivers

### Goal

Implement secure identity foundation for customers, drivers, and admins.

### Main Tasks

- Register/login.
- Password hashing.
- JWT access token.
- Refresh token rotation.
- Logout revoke.
- User and driver profile basics.
- RBAC guards.

### Deliverables

- Auth module.
- User and driver modules.
- Guard and decorator foundation.

### Done Criteria

- Login, refresh, logout, and role guard tests pass.
- Refresh tokens are stored hashed.
- Invalid credentials and revoked tokens are rejected.

## Phase 3: Ride Lifecycle

### Goal

Implement ride requests and the ride state machine.

### Main Tasks

- Ride entity/table.
- Ride creation.
- Ride status enum.
- Allowed transition map.
- Role-based transition checks.
- Audit event placeholders.

### Deliverables

- Ride module.
- Transition service.
- Tests for valid and invalid transitions.

### Done Criteria

- Invalid transitions are blocked.
- Customers and drivers can perform only allowed actions.
- Ride ownership checks exist.

## Phase 4: Realtime Location + H3

### Goal

Support authenticated driver location updates and geospatial indexing.

### Main Tasks

- Socket.IO gateway.
- Driver location event.
- Redis latest-location cache.
- GPS validation and jump detection.
- H3 cell conversion.
- Redis H3 driver sets.

### Deliverables

- Location gateway.
- H3 service.
- Driver discovery primitives.

### Done Criteria

- Offline drivers cannot update location.
- Invalid lat/lng is rejected.
- Driver sets are updated by H3 cell.

## Phase 5: Matching Engine + OSRM

### Goal

Match ride requests to nearby drivers using H3 and OSRM.

### Main Tasks

- OSRM route and table client.
- Candidate discovery.
- Scoring formula.
- Ride offer events.
- Timeout and retry jobs.
- Duplicate-offer prevention.

### Deliverables

- Matching module.
- OSRM integration.
- Offer lifecycle.

### Done Criteria

- Best candidate receives an offer.
- Timed-out offers retry the next driver.
- No-candidate rides fail cleanly.

## Phase 6: Pricing + Payment + Wallet

### Goal

Implement server-side fare calculation and idempotent wallet/payment simulation.

### Main Tasks

- Fare formula.
- H3 supply/demand surge.
- Surge cap.
- Wallet tables.
- Payment intent.
- Idempotency key.
- Transaction ledger.

### Deliverables

- Pricing module.
- Payment module.
- Wallet ledger.

### Done Criteria

- Fare cannot be supplied by the client.
- Duplicate payment requests do not double charge.
- Wallet mutations are transaction-safe.

## Phase 7: Chat + Notification + Admin

### Goal

Add support workflows around rides and operations.

### Main Tasks

- Ride chat conversation.
- Chat message events.
- Notification abstractions.
- Admin dashboard endpoints.
- Admin-only guard.

### Deliverables

- Chat module.
- Notification module foundation.
- Basic admin dashboard.

### Done Criteria

- Only ride participants can access ride chat.
- Admin endpoints require admin role.
- Admin actions are auditable.

## Phase 8: Security Hardening + Testing

> **Note:** Security hardening in this phase is a sweep and audit, not the first application of security rules. Every phase from Phase 2 onward must apply the rules in `docs/SECURITY_RULES.md` incrementally. Phase 8 reviews what was built, closes gaps, and adds regression tests — it does not introduce security for the first time.

### Goal

Improve security posture and broaden verification.

### Main Tasks

- Rate limiting.
- Helmet.
- Object-level authorization review.
- Security regression tests.
- Integration tests for critical flows.
- Error response hardening.

### Deliverables

- Security middleware/configuration.
- Expanded test suite.
- Review of sensitive paths.

### Done Criteria

- Auth, authorization, payment, ride, and WebSocket failure paths are tested.
- Error responses do not leak internals.

## Phase 9: Observability

### Goal

Make system behavior visible for operations and debugging.

### Main Tasks

- Prometheus metrics endpoint.
- Grafana dashboard.
- Structured logging.
- OpenTelemetry traces.
- Loki and Tempo integration.
- Health and readiness checks.

### Deliverables

- Metrics endpoint.
- Local observability stack.
- Baseline dashboards.

### Done Criteria

- Key ride, matching, payment, and API metrics are visible.
- Logs and traces include correlation IDs.

## Phase 11: Frontend Foundation

### Goal

Bootstrap monorepo frontend với 3 web app + 2 mobile app, share packages cho types/api-client/socket/UI tokens.

### Main Tasks

- Workspace setup: pnpm + Turborepo.
- Shared packages: api-client, socket-client, shared-types, ui-tokens, ui-web, ui-mobile, eslint/tsconfig presets.
- Web shells trio: Next.js 15 + Tailwind + shadcn/ui cho Customer/Driver/Admin.
- Mobile shells: Expo + NativeWind + expo-router cho Customer/Driver.

### Deliverables

- 5 app skeletons chạy được `dev` cùng lúc.
- Lint + build sạch toàn workspace.

### Done Criteria

- pnpm + turbo task `build/lint/dev` chạy parallel xanh.
- Mỗi app render placeholder page.

## Phase 12: Auth + Network + Map

### Goal

Login/register UI hoạt động trên cả 5 surface; API client + WebSocket client share; Mapbox tích hợp web + mobile.

### Main Tasks

- Auth screens (login/register) cross-surface.
- Mapbox integration: web (mapbox-gl) + mobile (@rnmapbox/maps).
- TanStack Query setup với JWT refresh interceptor.
- Secure storage: httpOnly cookie (web), expo-secure-store (mobile).

### Deliverables

- User register + login + access protected page trên mọi surface.
- Map render với pickup/destination marker.

### Done Criteria

- Auth flow round-trip backend Task 002.
- Mapbox key load qua env, không hard-code.
- 401 từ backend → auto refresh access token một lần.

## Phase 13: Customer Flow

### Goal

Customer có thể request ride + theo dõi ride realtime.

### Main Tasks

- Request ride: pickup/destination picker, fare estimate (gọi backend mới `POST /rides/quote` nếu thêm; hoặc dùng pricing snapshot trả về cùng ride.created).
- Surge multiplier display.
- Ride tracking: state machine UI (REQUESTED → MATCHING → ACCEPTED → DRIVER_ARRIVED → IN_PROGRESS → COMPLETED).
- Live driver position via WS.

### Deliverables

- Customer flow end-to-end: từ chọn điểm đến nhìn xe tới.

### Done Criteria

- WS reconnect tự động.
- Hủy ride / no driver found được handle UI.

## Phase 14: Driver Flow + Admin UI

### Goal

Driver có thể go online, nhận offer, hoàn thành ride. Admin xem dashboard.

### Main Tasks

- Driver online toggle + location streaming WS.
- Offer modal với countdown 15s.
- In-ride screen với transition buttons.
- Admin dashboard consume Task 010 endpoint.

### Deliverables

- Driver flow end-to-end.
- Admin có UI thay cho curl.

### Done Criteria

- Driver có thể nhận đúng offer, accept → state ACCEPTED đúng.
- Admin chỉ access được nếu role ADMIN.

## Phase 15: Wallet + Polish

### Goal

Hoàn tất các surface phụ: wallet, payment history; polish accessibility, responsive, dark mode optional.

### Main Tasks

- Wallet UI (balance + transaction history).
- Payment history page.
- Backend addon: `GET /me/wallet`, `GET /me/payments`, `GET /me/rides`.
- Responsive breakpoints + dark mode.

### Deliverables

- Customer/driver xem được balance + lịch sử.

### Done Criteria

- Wallet UI khớp với double-entry ledger backend.
- Pagination + empty state.

## Phase 10: AI + DevOps Advanced

### Goal

Add AI operations and advanced deployment automation.

### Main Tasks

- Demand forecasting service.
- Fraud detection service.
- ETA prediction.
- AI admin summary.
- GitHub Actions pipeline.
- Nginx reverse proxy.
- Terraform and Ansible baseline.

### Deliverables

- Python FastAPI AI service.
- AI integration endpoints.
- CI pipeline.
- Infrastructure templates.

### Done Criteria

- AI features have safe fallbacks.
- CI runs tests and lint.
- Local infrastructure can be started through documented commands.
