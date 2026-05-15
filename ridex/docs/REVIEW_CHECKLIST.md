

# Review Checklist

Use this checklist when reviewing Codex changes.

## Correctness

- The implementation satisfies the task requirements.
- Edge cases from the task are handled.
- Error behavior is explicit and safe.
- The code follows existing repository patterns.

## Business Rules

- Ride state transitions are explicit and valid.
- Matching does not offer the same ride to invalid or duplicate candidates.
- Driver online/offline rules are enforced.
- Pricing is calculated server-side.
- Payment retries are idempotent.

## Security

- Authentication is enforced where required.
- RBAC is enforced.
- Object-level authorization is enforced.
- Client-provided role, ownership, amount, fare, assignment, and status are ignored or rejected.
- Sensitive values are not logged.

## Database and Migration

- Every schema change includes a migration.
- Constraints and indexes match query and business requirements.
- Redis is not used as the only long-term source of truth.
- Destructive migrations use expand-and-contract.

## Transaction Safety

- Multi-step writes use database transactions.
- Wallet, payment, ride assignment, and ride acceptance flows are concurrency-safe.
- External network calls are not made while holding critical locks.

## Payment Idempotency

- Idempotency key scope is clear.
- Duplicate requests return the original result.
- Double charge is prevented.
- Transaction logs are written.

## Realtime and WebSocket

- Socket connection is authenticated.
- Room membership is authorized.
- Event payloads are validated.
- Events do not leak ride, driver, customer, or admin data to unauthorized users.

## Testing

- Important business logic has unit tests.
- API or integration behavior is tested where needed.
- Security and authorization failures are tested.
- Payment retry and duplicate request cases are tested.
- Realtime events are tested when changed.

## Maintainability

- Code is cohesive and readable.
- No broad unrelated refactor is included.
- New constants are named and documented when needed.
- New abstractions remove real complexity.

## Observability

- Important failures are logged with safe context.
- Metrics or traces are added for operationally important paths when relevant.
- Correlation/request IDs are preserved.

## Extraction Readiness

Đảm bảo code giữ được khả năng tách microservice trong tương lai. Không phải mọi PR đều áp dụng tất cả mục — chỉ check khi PR động đến cross-module surface.

- Module chỉ import `<other-module>.facade.ts` của module khác — không import service, repository, entity trực tiếp.
- Cross-module method nhận và trả DTO, không phơi bày entity/ORM model.
- Không có cross-module SQL JOIN trong critical path (admin read-only queries được khoanh vùng riêng).
- Không có cross-module foreign key với `CASCADE` delete.
- Side effects cross-module dùng domain event (NestJS EventEmitter hoặc BullMQ), không gọi facade trong critical path nếu có thể async.
- Multi-module writes dùng outbox pattern hoặc saga — không cross-module DB transaction.
- Table mới được khai báo rõ thuộc về module nào (cập nhật Table Ownership Map trong `ARCHITECTURE.md` nếu cần).
- Migration cho table mới đặt trong module sở hữu, không đặt trong module khác.

## Unrelated Changes

- The diff does not alter files outside task scope.
- Formatting churn is limited.
- Dependencies are not added without explicit approval.
