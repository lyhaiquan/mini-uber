# Task 009: Payment Idempotency

## Task Name

Implement wallet/payment simulation with idempotency.

## Goal

Add wallet tables/entities, payment intent handling, idempotency keys, database transactions, transaction logs, and double-charge prevention.

## Context

RideX payment is a simulation, but it must model production-grade idempotency and ledger behavior. Retried payment requests must not charge twice.

## Scope

- Add wallet tables/entities.
- Add payment intent model.
- Require idempotency key for payment creation/confirmation.
- Use database transaction for payment and wallet mutations.
- Write transaction log entries.
- Prevent double charge on repeated payment requests.
- Add tests for repeated payment requests and transaction safety.

## Out of Scope

- Real external payment gateway.
- Refund workflow unless required for rollback handling.
- Promotions/vouchers.
- Complex accounting exports.
- Admin manual adjustment UI.

## Expected Files/Modules

- `payments` module.
- Wallet entity/table.
- Payment entity/table.
- Transaction ledger entity/table.
- Payment service.
- Payment controller/DTOs if API exists.
- Idempotency helper/repository.
- Migrations.
- Unit and integration tests.

## Functional Requirements

- Customer can create or confirm payment for their own payable ride.
- Payment amount comes from server-side pricing snapshot.
- Idempotency key is required for mutating payment requests.
- Repeated request with same key returns original result.
- Wallet balance and transaction log update atomically.
- Failed payment attempts are recorded where useful.
- Payment status transitions are explicit.

## Security Requirements

- Do not trust amount from client.
- Do not trust ride owner from client.
- Customer can pay only for their own ride.
- Admin payment operations require admin role and audit events.
- Do not log sensitive token or payment-like identifiers.
- Validate idempotency key format and length.

## Database Requirements

- Add migrations for wallets, payments, and transactions.
- Store money in integer minor units.
- Add unique constraint for idempotency key within a clear scope, such as customer and endpoint/action.
- Use transactions for wallet debit, payment state update, and ledger insert.
- Use row locking or equivalent concurrency control for wallet balance updates.
- Add indexes for customer payment history and ride payment lookup.

## API/WebSocket Changes

- Payment intent endpoint if API layer exists.
- Payment confirm endpoint requiring `Idempotency-Key` header or explicit idempotency field.
- No WebSocket changes required.

## Business Rules

- A ride can be charged only once for the same payable amount.
- Repeated idempotent requests return the original payment response.
- Insufficient wallet balance must not create a successful payment.
- Payment state must not move from terminal failure/success to pending without explicit controlled flow.
- Ledger entries are append-only.

## Edge Cases

- Same idempotency key repeated with same payload.
- Same idempotency key repeated with conflicting payload.
- Concurrent duplicate payment requests.
- Insufficient balance.
- Payment for another customer's ride.
- Payment for already paid ride.
- Missing pricing snapshot.
- Database error during ledger insert.

## Tests Required

- Successful payment debits wallet and writes ledger.
- Repeated request with same idempotency key returns same result.
- Conflicting payload with same idempotency key is rejected.
- Concurrent duplicate request does not double charge.
- Insufficient balance failure.
- Unauthorized ride payment denied.
- Transaction rollback behavior.

## Acceptance Criteria

- Wallet, payment, and transaction tables/entities exist.
- Payment amount is server-side only.
- Idempotency key prevents double charge.
- Payment mutations are transaction-safe.
- Transaction log is written.
- Tests cover repeated payment request behavior.

## Prompt for Codex

Implement Task 009 only. Add wallet/payment simulation with wallet, payment, and transaction ledger persistence, idempotency key enforcement, server-side payment amount, database transaction safety, and double-charge prevention. Do not integrate a real payment gateway, promotions, refunds, or admin adjustment UI. Add migrations and tests for repeated payment requests, conflicting idempotency payloads, concurrency, insufficient balance, and authorization. Finish with Summary, Changed files, Tests run, and Notes/Risks.
