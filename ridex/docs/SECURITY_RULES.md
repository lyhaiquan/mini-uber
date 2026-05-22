# Security Rules

## Authentication

- Use Argon2id or bcrypt for password hashing.
- Never store plaintext passwords.
- Use JWT access tokens with short expiration. Default: `ACCESS_TOKEN_TTL = 15 minutes`. Must be configurable via environment variable.
- Issue refresh tokens with rotation. Default: `REFRESH_TOKEN_TTL = 7 days`. Must be configurable via environment variable.
- Store refresh tokens only as hashes.
- Revoke refresh tokens on logout.
- On revoked refresh token reuse detection: invalidate all tokens in the token family immediately and emit a security audit event. Do not silently ignore reuse.
- Add account lockout or throttling for repeated failed login attempts.

## Local dev cookie scope

- Web auth uses the shared `ridex_refresh` cookie name across customer, driver, and admin apps; local dev ports isolate those cookies by host/port.
- Production deployments on a shared domain must separate hostnames or paths before enabling all surfaces to avoid refresh-cookie collisions.

## Authorization

- Use RBAC for role-level access.
- Use object-level authorization for every user-owned resource.
- Customers can view and mutate only their own rides, payments, wallet records, conversations, and profile data.
- Drivers can access and operate only rides assigned or offered to them.
- Admin actions must be guarded and audited.
- Never trust client-provided role, user ID, driver ID, ride owner, ride status, or assignment fields.

## API Security

- Validate every external payload with DTOs or schemas.
- Reject unknown unsafe fields to prevent mass assignment.
- Apply rate limiting to auth, ride request, location update, payment, and admin-sensitive endpoints.
- Use Helmet or equivalent secure HTTP headers.
- Do not leak stack traces, SQL details, framework internals, secrets, or provider error payloads to clients.
- Use correlation IDs for traceability.

## WebSocket Security

- Authenticate sockets on connect.
- Disconnect or reject unauthenticated sockets.
- Validate every event payload.
- Authorize room join operations.
- Drivers can emit location only for themselves.
- Customers can subscribe only to rides they own.
- Drivers can receive offers only intended for them.
- Admin realtime views require admin role and audit-sensitive handling.

## Payment Security

- Calculate fare and payment amount server-side.
- Do not trust amount, currency, promotion, fee, or discount values from clients.
- Require idempotency keys for payment and wallet operations.
- Use database transactions for wallet balance, payment state, and ledger writes.
- Write transaction logs for every wallet/payment mutation.
- Prevent double charge under retries, timeouts, and duplicate requests.

## Data Protection

- Do not log passwords, access tokens, refresh tokens, reset tokens, or secrets.
- Mask phone and email values in normal logs.
- Keep environment secrets out of Git.
- Do not commit `.env` files with real values.
- Apply least privilege to database and service credentials.
- Encrypt sensitive data at rest when required by the deployment context.

## Audit Events

Audit these events at minimum:

- Login success and failure for all roles (customer, driver, admin).
- Admin user lookup or ride lookup.
- Admin changes to user, driver, ride, payment, or pricing data.
- Failed authorization attempts on sensitive resources.
- Ride cancellation by admin.
- Manual payment adjustment.
- Refresh token reuse detection.
- Account lockout.
- Driver assignment override.
- Security configuration changes.

## Audit Event Schema

Every audit event must contain:

| Field | Type | Description |
|---|---|---|
| `actor_id` | UUID \| null | User performing the action. Null for unauthenticated events. |
| `actor_role` | enum | `CUSTOMER`, `DRIVER`, `ADMIN`, or `SYSTEM` |
| `action` | string | Constant name, e.g. `RIDE_CANCELLED`, `PAYMENT_ADJUSTED`, `LOGIN_FAILED` |
| `resource_type` | string | e.g. `ride`, `payment`, `user`, `driver` |
| `resource_id` | UUID \| null | Affected record ID |
| `before` | JSONB \| null | State snapshot before change (omit for read events) |
| `after` | JSONB \| null | State snapshot after change (omit for read events) |
| `ip_address` | string \| null | Request IP where available |
| `request_id` | string | Correlation ID from the request |
| `created_at` | timestamp UTC | When the event occurred |

Rules:
- Audit events are append-only. Never update or delete audit records.
- Persist audit events in PostgreSQL (`audit_logs` table). Log files alone are not sufficient.
- Sensitive fields (passwords, tokens) must never appear in `before`/`after` snapshots.
