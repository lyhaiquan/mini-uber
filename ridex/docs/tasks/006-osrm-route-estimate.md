# Task 006: OSRM Route Estimate

## Task Name

Integrate OSRM route estimation.

## Goal

Add an OSRM integration that estimates route distance, duration, and polyline for pickup-to-destination routes, with a safe fallback when OSRM is unavailable.

## Context

Ride requests and pricing need distance and duration estimates. Matching may later use OSRM Table API, but this task only adds route estimation.

## Scope

- Add OSRM client/service.
- Call OSRM route API.
- Return distance, duration, and route polyline.
- Validate coordinates before calling OSRM.
- Add timeout and safe fallback behavior when OSRM is unavailable.
- Add tests for success, invalid coordinates, timeout/failure, and fallback.

## Out of Scope

- Full matching engine.
- OSRM Table API for multiple drivers.
- Pricing formula.
- Route persistence unless already required by existing ride creation.
- Frontend map rendering.

## Expected Files/Modules

- `routing` or `geo` integration module.
- OSRM client/service.
- Config entries for OSRM base URL and timeout.
- Route estimate DTO/types.
- Unit tests with mocked OSRM responses.

## Functional Requirements

- Given pickup and destination coordinates, return estimated distance in meters.
- Return estimated duration in seconds.
- Return route polyline or encoded geometry when OSRM provides it.
- Apply a configured timeout to OSRM calls.
- If OSRM is unavailable, return a safe fallback estimate or a typed fallback result.
- Do not block core app startup when OSRM is down.

## Security Requirements

- Validate lat/lng ranges before calling OSRM.
- Do not expose internal OSRM error payloads to clients.
- OSRM base URL must come from configuration.
- Do not send unnecessary user PII to OSRM.

## Database Requirements

- No database schema changes are required.
- If a route estimate is persisted by existing ride code, add a migration only for explicit schema changes.

## API/WebSocket Changes

- Internal route estimate service is required.
- Public REST endpoint is optional only if already planned by existing ride/request flow.
- No WebSocket changes.

## Business Rules

- Server estimates route distance and duration.
- Client-provided distance or duration must not be trusted for pricing or matching.
- Fallback estimates must be clearly marked so downstream pricing/matching can handle lower confidence.

## Edge Cases

- Invalid pickup coordinate.
- Invalid destination coordinate.
- Same pickup and destination.
- OSRM timeout.
- OSRM 4xx/5xx response.
- OSRM returns no route.
- Network failure.

## Tests Required

- Successful OSRM route response mapping.
- Invalid coordinate validation.
- Timeout/failure fallback behavior.
- No-route response handling.
- Configuration validation for OSRM base URL if config validation exists.

## Acceptance Criteria

- Route estimation service returns distance, duration, and polyline/geometry.
- OSRM failures are handled safely.
- Fallback behavior is tested.
- Full matching is not implemented in this task.

## Prompt for Codex

Implement Task 006 only. Add OSRM route API integration for pickup-to-destination distance, duration, and polyline/geometry with coordinate validation, timeout, and fallback behavior. Do not implement full matching, OSRM Table API, pricing, or frontend map rendering. Add mocked tests for OSRM success and failure cases. Finish with Summary, Changed files, Tests run, and Notes/Risks.
