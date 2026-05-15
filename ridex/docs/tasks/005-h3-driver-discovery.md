# Task 005: H3 Driver Discovery

## Task Name

Implement H3-based online driver discovery.

## Goal

Add H3 geospatial indexing so RideX can find nearby online drivers by expanding H3 rings around a pickup location.

## Context

The matching engine needs fast candidate discovery. Realtime location updates provide latest driver positions; this task indexes online drivers into Redis H3 sets.

## Scope

- Add H3 service.
- Convert latitude/longitude to H3 cells.
- Maintain Redis sets named `h3:drivers:r8:{cellId}` and `h3:drivers:r9:{cellId}`.
- Move drivers between sets when their cell changes.
- Remove drivers from sets when offline or expired.
- Find drivers by expanding H3 rings.
- Add unit tests for conversion, indexing, movement, removal, and discovery.

## Out of Scope

- Matching score calculation.
- OSRM distance or ETA.
- Ride offers.
- Driver location gateway changes beyond integration hooks.
- Surge pricing.
- Persistent geospatial history.

## Expected Files/Modules

- `geo` module.
- H3 service.
- Redis H3 repository/service.
- Integration hook from location update or driver availability service.
- Unit tests for H3 discovery.

## Functional Requirements

- Convert lat/lng to H3 cell at resolution 8 and resolution 9.
- Store online driver IDs in `h3:drivers:r8:{cellId}` and `h3:drivers:r9:{cellId}`.
- Remove a driver from previous H3 sets when the driver moves to a new cell.
- Discovery expands rings up to a configured max ring.
- Discovery returns unique driver IDs.
- Discovery can prefer resolution 9 for local precision and resolution 8 for wider fallback.

## Security Requirements

- Do not accept driver ID from untrusted client payloads.
- Index only authenticated online drivers.
- Do not expose raw driver discovery endpoints to customers unless protected by server-side ride/matching workflow.

## Database Requirements

- Redis sets are temporary discovery indexes.
- PostgreSQL remains the source of truth for driver identity and availability.
- No database migration is required unless driver availability schema is missing and this task explicitly needs it.

## API/WebSocket Changes

- No public REST API is required.
- No new public WebSocket event is required.
- Internal service method for matching may be added.

## Business Rules

- Only online drivers are discoverable.
- Offline drivers must be removed from H3 sets.
- A driver should appear only once in discovery results.
- Discovery radius must be bounded by configuration.

## Edge Cases

- Invalid lat/lng.
- H3 library conversion failure.
- Driver moves across cells.
- Driver goes offline.
- Redis set contains stale driver IDs.
- Empty rings.
- Duplicate driver ID across resolution/ring queries.

## Tests Required

- Lat/lng to H3 cell conversion.
- Add driver to resolution 8 and 9 sets.
- Move driver removes old cell membership.
- Offline removal.
- Ring expansion returns expected unique IDs.
- Empty discovery returns empty list.

## Acceptance Criteria

- H3 service exists.
- Redis set keys match `h3:drivers:r8:{cellId}` and `h3:drivers:r9:{cellId}`.
- Driver discovery by expanding H3 rings works.
- Unit tests cover H3 discovery behavior.
- Matching and OSRM are not implemented in this task.

## Prompt for Codex

Implement Task 005 only. Add H3 service methods for lat/lng conversion, Redis set maintenance using `h3:drivers:r8:{cellId}` and `h3:drivers:r9:{cellId}`, online-driver indexing, removal, and ring-expansion discovery. Do not implement matching scoring, OSRM, ride offers, surge pricing, or frontend. Add unit tests for H3 discovery behavior. Finish with Summary, Changed files, Tests run, and Notes/Risks.
