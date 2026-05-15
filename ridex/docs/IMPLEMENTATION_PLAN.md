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
