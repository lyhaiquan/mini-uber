# Task 002: Auth JWT Refresh

## Task Name

Implement authentication with JWT access tokens and refresh token rotation.

## Goal

Add secure registration, login, refresh token rotation, logout revoke behavior, and base RBAC structure for customers, drivers, and admins.

## Context

RideX requires secure role-based access before ride, driver, payment, and admin workflows are implemented. This task builds the auth foundation.

## Scope

- Register user accounts.
- Login with password verification.
- Hash passwords with Argon2id or bcrypt.
- Issue short-lived JWT access tokens.
- Issue refresh tokens with rotation.
- Store refresh tokens as hashes.
- Revoke refresh token on logout.
- Add base role enum and RBAC guard/decorator structure.
- Add tests for failed login, refresh token rotation, logout revoke, and role guard.

## Out of Scope

- Social login.
- Password reset.
- Email or phone verification.
- Admin dashboard.
- Ride ownership authorization.
- Payment security beyond auth guards.

## Expected Files/Modules

- `auth` module, controller, service, DTOs, guards, strategies.
- `users` entity/model or persistence abstraction.
- Refresh token persistence model/table.
- Role enum and role guard/decorator.
- Auth migrations if database schema is introduced.
- Auth unit and integration tests.

## Functional Requirements

- Users can register with validated credentials.
- Users can login with valid credentials.
- Invalid login attempts are rejected safely.
- Passwords are stored only as secure hashes.
- Access token contains minimal required claims.
- Refresh token rotation invalidates the previous refresh token.
- Logout revokes the active refresh token.
- Role guard can restrict endpoints by role.

## Security Requirements

- Use Argon2id or bcrypt.
- Never store plaintext passwords or refresh tokens.
- Do not log passwords or tokens.
- Validate all auth DTOs.
- Add throttling or account lockout placeholder for repeated failed login if full implementation is not in scope.
- Access token secret and refresh token secret must come from environment/config.
- Do not allow clients to choose their own role unless the task explicitly defines a safe registration rule.

## Database Requirements

- Add migrations for users and refresh token storage if database persistence is introduced.
- Refresh tokens must be stored as hashes.
- Add unique indexes for account identifiers such as email or phone.
- Add indexes for refresh token lookup fields.
- Consider token family or rotation metadata for reuse detection.

## API/WebSocket Changes

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- No WebSocket changes in this task.

## Business Rules

- A user cannot login with an invalid password.
- A revoked refresh token cannot be reused.
- Refresh token rotation must return a new refresh token and invalidate the old one.
- Role checks must be enforced by server-side user identity, not client input.

## Edge Cases

- Duplicate registration identifier.
- Wrong password.
- Unknown user.
- Expired refresh token.
- Revoked refresh token.
- Refresh token reuse after rotation.
- Missing or malformed bearer token.
- Role guard denies insufficient role.

## Tests Required

- Register success and duplicate registration.
- Login success and wrong password failure.
- Refresh token success and old token rejection after rotation.
- Logout revoke behavior.
- Role guard allows/denies expected roles.
- DTO validation failures.

## Acceptance Criteria

- Auth endpoints work according to the API conventions.
- Password and refresh token storage is secure.
- Refresh rotation prevents reuse of old tokens.
- Logout revokes active refresh token.
- RBAC base guard/decorator exists and is tested.
- No ride, payment, matching, or admin dashboard logic is implemented.

## Prompt for Codex

Implement Task 002 only. Add register/login, password hashing, JWT access tokens, refresh token rotation, logout revoke, and base RBAC guard/decorator structure. Add migrations if schema changes are required. Do not implement ride ownership, payments, matching, admin dashboard, or frontend. Add tests for wrong login, refresh rotation, logout revoke, and role guard. Finish with Summary, Changed files, Tests run, and Notes/Risks.
