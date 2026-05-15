# Task 010: Admin Dashboard Basic

## Task Name

Implement basic admin dashboard endpoints.

## Goal

Add admin-only dashboard endpoints for operational summary metrics: active rides count, online drivers count, simulated revenue, matching duration placeholder, and fraud alert placeholder.

## Context

Admins need visibility into system state. This task creates a basic backend dashboard API without building the frontend UI.

## Scope

- Add admin dashboard controller/service.
- Add admin-only guard to endpoints.
- Return active rides count.
- Return online drivers count.
- Return simulated revenue summary.
- Return matching duration placeholder.
- Return fraud alert placeholder.
- Add audit event for admin dashboard access if audit module exists.
- Add tests for admin access and non-admin denial.

## Out of Scope

- Frontend dashboard.
- Full analytics pipeline.
- ClickHouse integration.
- Real fraud detection model.
- Real revenue accounting reports.
- Admin mutation actions.

## Expected Files/Modules

- `admin` module.
- Admin dashboard controller.
- Admin dashboard service.
- Metrics query methods from rides, drivers, matching, and payments modules.
- Guard usage tests.
- Audit integration if available.

## Functional Requirements

- Admin can fetch dashboard summary.
- Non-admin users are denied.
- Active rides count comes from ride source of truth.
- Online drivers count comes from driver availability source.
- Revenue simulation comes from successful payment records or a clear placeholder if payments are not implemented yet.
- Matching duration can be a placeholder with a documented future source.
- Fraud alert can be a placeholder with a documented future source.

## Security Requirements

- Endpoints require authenticated admin role.
- Do not expose customer or driver PII in aggregate dashboard response.
- Audit admin access if audit module exists.
- Do not bypass RBAC for internal calls.

## Database Requirements

- No new schema is required unless dashboard snapshots are explicitly persisted.
- Queries should use indexed fields where available.
- Avoid expensive full table scans if existing schema supports better queries.

## API/WebSocket Changes

- Add `GET /admin/dashboard/summary` or equivalent.
- Response should include active rides, online drivers, simulated revenue, matching duration placeholder, and fraud alert placeholder.
- No WebSocket changes in this task.

## Business Rules

- Only admins can view dashboard metrics.
- Dashboard data is aggregate operational data, not raw user records.
- Placeholder fields must be clearly marked as placeholders so they are not mistaken for production analytics.

## Edge Cases

- No rides exist.
- No drivers online.
- Payments module not implemented yet.
- Matching metrics not implemented yet.
- Fraud module not implemented yet.
- Authenticated customer or driver requests dashboard.
- Unauthenticated request.

## Tests Required

- Admin can access dashboard summary.
- Customer/driver cannot access dashboard summary.
- Unauthenticated request is denied.
- Empty data returns zero counts or documented placeholders.
- Revenue placeholder or calculation behavior is tested.

## Acceptance Criteria

- Admin dashboard summary endpoint exists.
- Admin-only guard is enforced.
- Active rides and online drivers are returned.
- Revenue simulation, matching duration, and fraud alert placeholders are returned safely.
- Tests cover admin access control.
- No frontend dashboard is implemented.

## Prompt for Codex

Implement Task 010 only. Add basic admin dashboard backend endpoints with admin-only guard, active rides count, online drivers count, revenue simulation, matching duration placeholder, and fraud alert placeholder. Do not build frontend, full analytics, ClickHouse integration, real fraud model, or admin mutation actions. Add tests for admin access and non-admin denial. Finish with Summary, Changed files, Tests run, and Notes/Risks.
