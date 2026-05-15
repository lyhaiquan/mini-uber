# Task 004: Driver Location Realtime

## Task Name

Implement authenticated realtime driver location updates.

## Goal

Add a Socket.IO gateway that allows online drivers to publish validated location updates and stores latest location in Redis with a TTL.

## Context

Realtime driver location is required for tracking and later H3 driver discovery. This task focuses only on secure ingestion of driver location updates.

## Scope

- Set up Socket.IO gateway.
- Authenticate sockets on connect.
- Add driver location update event.
- Validate latitude, longitude, heading, speed, and timestamp where present.
- Reject updates from offline drivers.
- Store latest driver location in Redis with TTL.
- Add basic GPS jump detection.
- Add tests for auth, validation, offline rejection, and jump detection where practical.

## Out of Scope

- H3 driver discovery sets.
- Matching engine.
- Customer tracking subscription.
- Persistent location history.
- Frontend map.
- OSRM route matching.

## Expected Files/Modules

- `location` module.
- Socket.IO gateway.
- Location DTO/schema.
- Redis service or cache abstraction.
- Driver availability lookup integration.
- GPS jump detection helper.
- WebSocket tests or gateway unit tests.

## Functional Requirements

- Socket connection requires a valid authenticated driver.
- `driver.location.update` accepts validated location payloads.
- Latitude must be between -90 and 90.
- Longitude must be between -180 and 180.
- Offline drivers cannot update location.
- Latest location is stored in Redis with a defined TTL.
- Suspicious GPS jumps are rejected or flagged according to the implementation design.

## Security Requirements

- Authenticate socket on connect.
- Driver ID must come from authenticated socket identity, not payload.
- Validate event payload.
- Rate limit or throttle location updates if project infrastructure supports it.
- Do not leak driver location to unauthorized clients in this task.

## Database Requirements

- No long-term location history table is required.
- Redis may store latest location as temporary realtime state.
- Do not store source-of-truth driver status only in Redis unless an approved existing design already does.

## API/WebSocket Changes

- Add Socket.IO authentication.
- Add event: `driver.location.update`.
- Optional ack/error response for rejected location updates.
- No REST endpoint required.

## Business Rules

- Only authenticated drivers can emit driver location.
- A driver must be online to update location.
- Location updates must be plausible enough to avoid obvious GPS jump errors.
- Server controls the driver identity associated with the update.

## Edge Cases

- Missing token.
- Expired token.
- Authenticated customer tries to emit driver location.
- Invalid lat/lng.
- Offline driver.
- Very old timestamp.
- Impossible jump from previous location.
- Redis unavailable.

## Tests Required

- Socket auth success and failure.
- Role rejection for non-driver socket.
- Valid location update stores latest location.
- Invalid lat/lng rejected.
- Offline driver rejected.
- GPS jump detection test.
- Redis failure behavior if the abstraction supports testing it.

## Acceptance Criteria

- Authenticated online drivers can send valid location updates.
- Invalid or unauthorized updates are rejected.
- Latest location is stored in Redis with TTL.
- Basic GPS jump detection exists.
- No H3 discovery or matching is implemented in this task.

## Prompt for Codex

Implement Task 004 only. Add authenticated Socket.IO driver location updates with payload validation, online-driver check, Redis latest-location storage with TTL, and basic GPS jump detection. Do not implement H3 discovery, matching, customer tracking, persistent location history, or frontend. Add targeted tests for auth, validation, offline rejection, and jump detection. Finish with Summary, Changed files, Tests run, and Notes/Risks.
