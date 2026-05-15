# Task 003: Ride State Machine

## Task Name

Implement ride status enum and state transition rules.

## Goal

Create a strict ride state machine that blocks invalid transitions and enforces role-based transition permissions.

## Context

Ride lifecycle correctness is central to RideX. Later matching, tracking, pricing, payment, and admin features depend on valid ride states.

## Scope

- Define ride status enum.
- Define allowed transition map.
- Implement transition validation service.
- Enforce role-based transition checks.
- Add object-level checks where user/driver ownership data exists.
- Add audit event placeholder for transition events.
- Add unit tests for valid and invalid transitions.

## Out of Scope

- Full ride booking API if not already present.
- Matching engine.
- Payment workflow.
- WebSocket ride status broadcasting.
- Admin override UI.
- Full audit persistence if audit module is not available.

## Expected Files/Modules

- `rides` module.
- Ride status enum.
- Ride transition service.
- Ride entity/model updates if required.
- Audit placeholder or interface.
- Unit tests for transition rules.
- Migration if ride status schema is added or changed.

## Functional Requirements

- Ride statuses are represented by an enum or equivalent typed constant.
- Allowed transitions are explicit.
- Invalid transitions throw a safe domain error.
- Transition service checks actor role.
- Transition service rejects unauthorized customer or driver actions.
- Audit event placeholder is called for valid transition attempts where practical.

## Security Requirements

- Do not trust client-provided ride status.
- Do not trust client-provided role or user ID.
- Customer can transition only rides they own.
- Driver can transition only assigned or offered rides as appropriate.
- Admin transitions must require admin role and produce an audit event.

## Database Requirements

- Add a migration if ride status column/table changes.
- Store canonical ride status in PostgreSQL, not only Redis.
- Use constraints or enum type where appropriate.
- Avoid destructive changes without expand-and-contract.

## API/WebSocket Changes

- Add or update ride transition endpoint only if the ride module already has an API surface.
- No WebSocket broadcasting is required in this task.
- API errors should use clear codes such as `RIDE_INVALID_STATE` or `RIDE_FORBIDDEN_TRANSITION`.

## Business Rules

- A ride cannot move from terminal states back to active states.
- Only allowed roles can perform each transition.
- Only the assigned driver can perform driver-only transitions.
- Customer cancellation must be allowed only before configured cutoff states.
- Admin override, if present, must be explicit and audited.

## Edge Cases

- Transition from `completed` to any active state.
- Transition from `cancelled` to any active state.
- Driver tries to start a ride assigned to another driver.
- Customer tries to mutate another customer's ride.
- Unknown status value from database or input.
- Concurrent transition attempts.

## Tests Required

- Valid transition matrix tests.
- Invalid transition matrix tests.
- Customer role allowed/denied tests.
- Driver role allowed/denied tests.
- Admin override/audit placeholder test if implemented.
- Terminal state immutability tests.

## Acceptance Criteria

- Ride status enum exists.
- Transition map is explicit and tested.
- Invalid transitions are blocked.
- Role-based transition checks are enforced.
- Database migration exists if schema changed.
- Audit event placeholder is integrated without requiring full audit module.

## Prompt for Codex

Implement Task 003 only. Add the ride status enum, allowed transition map, role-based transition validation, invalid transition errors, and an audit event placeholder. Add migrations only if schema changes are needed. Do not implement matching, payment, route estimation, or WebSocket broadcasting. Add unit tests for valid and invalid transitions. Finish with Summary, Changed files, Tests run, and Notes/Risks.
