# Task 008: Pricing Surge

## Task Name

Implement server-side fare calculation and H3 surge pricing.

## Goal

Add a pricing module that calculates ride fare from base fare, distance fee, time fee, and dynamic surge based on H3 supply/demand, with a configured surge cap.

## Context

RideX must never trust fare or payment amount from clients. Pricing must be reproducible, server-side, and suitable for later payment idempotency.

## Scope

- Implement fare formula.
- Include base fare, distance fee, and time fee.
- Calculate dynamic surge by H3 demand/supply.
- Apply surge cap.
- Store or return a pricing snapshot for ride/payment use.
- Add tests for pricing edge cases.

## Out of Scope

- Payment capture or wallet charging.
- Promotions/vouchers.
- Real payment gateway integration.
- ML pricing model.
- Admin pricing UI.

## Expected Files/Modules

- `pricing` module.
- Pricing service.
- Pricing config/constants.
- Surge calculator.
- H3 demand/supply provider or abstraction.
- Pricing snapshot model/migration if persisted.
- Unit tests.

## Functional Requirements

- Fare equals base fare plus distance fee plus time fee, adjusted by surge.
- Distance input must come from server-side route estimate.
- Duration input must come from server-side route estimate.
- Surge uses supply/demand for the pickup H3 cell or configured nearby area.
- Surge multiplier cannot exceed configured cap.
- Output includes fare breakdown and final amount.
- Rounding rules are explicit and tested.

## Security Requirements

- Do not trust client-provided fare, distance, duration, surge, discount, or payment amount.
- Validate route estimate inputs.
- Keep pricing configuration server-side.
- Do not expose internal fraud or risk signals in customer-facing responses.

## Database Requirements

- Persist pricing snapshot if later payment needs immutable amount reference.
- Add migration for pricing snapshot columns/table if persisted.
- Use integer minor units for money where possible.
- Avoid floating point storage for final monetary amounts.

## API/WebSocket Changes

- Internal pricing service is required.
- Public fare estimate endpoint is optional if ride request flow needs it.
- No WebSocket changes.

## Business Rules

- Server is the source of truth for fare.
- Surge must be bounded by cap.
- Zero or very short trips still respect minimum/base fare rules.
- Pricing snapshot should not change after ride confirmation unless explicitly recalculated by a controlled flow.

## Edge Cases

- Zero distance.
- Zero duration.
- Very long distance.
- High demand with zero supply.
- Zero demand with high supply.
- Surge cap reached.
- OSRM fallback estimate.
- Rounding at currency boundaries.

## Tests Required

- Base fare only case.
- Distance and time fee calculation.
- Surge multiplier calculation.
- Surge cap.
- Zero supply handling.
- Rounding rules.
- Rejection of client-supplied amount if API surface exists.

## Acceptance Criteria

- Pricing service returns a fare breakdown and final amount.
- Surge is computed from H3 demand/supply and capped.
- Money calculations avoid unsafe floating point final storage.
- Tests cover pricing edge cases.
- No payment/wallet charging is implemented in this task.

## Prompt for Codex

Implement Task 008 only. Add server-side pricing with base fare, distance fee, time fee, dynamic H3 supply/demand surge, surge cap, explicit rounding, and tests for edge cases. Do not implement wallet charging, real payment gateway integration, promotions, admin pricing UI, or ML pricing. Add a pricing snapshot migration only if persistence is required by the existing ride/payment design. Finish with Summary, Changed files, Tests run, and Notes/Risks.
