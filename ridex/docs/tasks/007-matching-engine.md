# Task 007: Matching Engine

## Task Name

Implement driver matching engine with scoring, offers, timeout, and retry.

## Goal

Match a requested ride to the best available driver using H3 discovery, OSRM Table API or fallback distance, scoring, WebSocket ride offers, timeout, retry, duplicate-offer prevention, and failure handling.

## Context

Previous tasks provide ride state, realtime driver location, H3 discovery, and OSRM route estimation. This task orchestrates them into a matching workflow.

## Scope

- Use H3 discovery to fetch candidate drivers near pickup.
- Estimate driver-to-pickup distance/ETA with OSRM Table API or fallback distance.
- Compute matching score from distance/ETA, driver availability, and configurable weights.
- Send ride offer via WebSocket to selected driver.
- Add offer timeout job.
- Retry next driver on timeout or rejection.
- Prevent duplicate simultaneous offers for the same ride/driver.
- Mark ride failed when no candidates remain.
- Add tests for candidate selection, scoring, timeout, retry, duplicate prevention, and no-candidate failure.

## Out of Scope

- Pricing formula.
- Payment workflow.
- Frontend driver app.
- Advanced ML-based matching.
- Long-term analytics pipeline.
- Production push notification integration.

## Expected Files/Modules

- `matching` module.
- Matching service.
- Matching queue/jobs using BullMQ.
- `ride_offers` table in PostgreSQL (fields: `id`, `ride_id`, `driver_id`, `status`, `offered_at`, `expires_at`, `responded_at`).
- WebSocket event publisher.
- OSRM Table API client method or fallback distance helper.
- Tests for matching workflow.
- Migration if offer persistence is added.

## Functional Requirements

- Matching starts for a valid requested ride.
- Candidate drivers come from H3 discovery.
- Candidate scoring is deterministic and configurable.
- Best candidate receives `ride.offer.created`.
- Offer timeout triggers retry to the next candidate.
- Driver rejection triggers retry to the next candidate.
- Accepted offer assigns driver and updates ride state atomically.
- No available candidates marks the ride failed.
- Duplicate active offers for the same ride are prevented.

## Security Requirements

- Only authenticated drivers can accept or reject offers addressed to them.
- Driver ID must come from authenticated identity.
- Customer cannot choose the matched driver directly in this workflow.
- Ride assignment must verify ride is still matchable.
- WebSocket room/event authorization is required.

## Database Requirements

- Persist ride assignment in PostgreSQL.
- Persist offer state in the `ride_offers` table in PostgreSQL. Redis (BullMQ) is used only for the offer timeout job — not as the authoritative offer record.
- Add migrations for `ride_offers` and any assignment columns on the `rides` table.
- Prevent two drivers accepting the same ride using `SELECT FOR UPDATE` on the ride record during acceptance, combined with a check that the ride is still in matchable state.
- Redis may cache the active offer ID for fast lookup, but the source of truth is PostgreSQL.

## API/WebSocket Changes

- WebSocket event: `ride.offer.created`.
- Driver action endpoint or event: `ride.offer.accepted`.
- Driver action endpoint or event: `ride.offer.rejected`.
- Optional internal endpoint/job to start matching.
- Customer status updates may be emitted only if existing ride status events exist.

## Business Rules

- Only online eligible drivers can receive offers.
- A ride can have only one active offer at a time unless the architecture explicitly supports parallel offers.
- A driver cannot accept an expired offer.
- First valid accepted offer wins.
- A ride with no candidates or exhausted candidates becomes failed.
- Retry count and offer timeout must be bounded by configuration.

## Edge Cases

- No nearby drivers.
- H3 returns stale offline driver IDs.
- OSRM Table API unavailable.
- Candidate becomes offline before offer.
- Offer timeout fires after driver already accepted.
- Two drivers attempt to accept.
- Same driver appears in multiple rings.
- Ride cancelled during matching.

## Tests Required

- Candidate discovery and unique filtering.
- Scoring order.
- Offer creation.
- Timeout retry.
- Rejection retry.
- Duplicate offer prevention.
- Atomic accept and assignment.
- No-candidate failure.
- Unauthorized accept/reject denied.

## Acceptance Criteria

- Matching can select and offer a ride to a driver.
- Timeout and rejection retry the next eligible driver.
- Duplicate offers are prevented.
- Ride assignment is transaction-safe.
- Ride is marked failed when no candidates remain.
- Tests cover critical matching behavior.

## Prompt for Codex

Implement Task 007 only. Build the matching engine using H3 discovery, OSRM Table API or fallback distance, configurable scoring, ride offers over WebSocket, timeout/retry, duplicate-offer prevention, and no-candidate failure. Do not implement pricing, payment, frontend, or ML matching. Add migrations if offer persistence or assignment schema changes are needed. Add tests for scoring, timeout/retry, duplicate prevention, authorization, and no-candidate failure. Finish with Summary, Changed files, Tests run, and Notes/Risks.
