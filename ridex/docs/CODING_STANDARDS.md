# Coding Standards

## TypeScript

- Use TypeScript strict mode.
- Prefer explicit types for public service methods, DTOs, entities, and exported functions.
- Avoid `any` except at trusted integration boundaries where the data is immediately validated or normalized.
- Model domain concepts with enums, value objects, or typed constants instead of raw strings.

## Module Structure

- Keep modules cohesive and business-oriented.
- Controllers handle transport concerns only.
- Services own business logic and orchestration.
- Repositories or ORM models own persistence details.
- Shared utilities must be small, stable, and genuinely reusable.

## Module Boundaries (Facade Pattern)

Để giữ modules có thể tách thành microservice trong tương lai, **mọi cross-module access phải qua Facade**:

- Mỗi module phải có một file `<module>.facade.ts` (ví dụ: `rides.facade.ts`, `pricing.facade.ts`) là **PUBLIC API duy nhất** của module đó.
- Các module khác **CHỈ được import facade**. KHÔNG import service, repository, entity, hoặc internal type của module khác trực tiếp.
- Facade method **nhận DTO input và trả về DTO output**. Không phơi bày entity hoặc ORM model qua biên module.
- Internal services, repositories, entities là **private** — không export ra ngoài module.
- Khi cần dữ liệu cross-module: gọi facade. Khi cần side effect cross-module: emit domain event (xem `ARCHITECTURE.md` — Domain Events).

Ví dụ đúng:
```typescript
// matching.service.ts
constructor(private readonly ridesFacade: RidesFacade) {}
const ride: RideSummaryDto = await this.ridesFacade.getRideSummary(rideId);
```

Ví dụ sai:
```typescript
// matching.service.ts — VIOLATION
constructor(private readonly rideRepository: RideRepository) {} // ❌ truy cập repo của module khác
const ride: RideEntity = await this.rideRepository.findOne(rideId); // ❌ trả entity cross-module
```

Mục tiêu: khi tách microservice, chỉ cần thay implementation facade từ in-process call → HTTP/gRPC client. Caller code không đổi.

## Controllers

- Keep controllers thin.
- Validate all incoming body, query, param, and WebSocket payload data.
- Do not implement business rules in controllers.
- Do not trust user identity or role fields sent by the client.
- Use request context from authenticated guards.

## Services

- Put business logic in services.
- Make state transitions explicit.
- Keep multi-step writes transaction-safe.
- Return domain-level results rather than transport-specific responses where practical.

## DTO Validation

- Every external input must have a DTO or equivalent schema validation.
- Reject unknown or unsafe fields to avoid mass assignment.
- Validate lat/lng ranges, IDs, enum values, amounts, pagination, and date ranges.
- Do not accept server-owned fields such as role, fare, payment amount, ride status, or owner IDs from public clients.

## Exceptions

- Use framework-specific exception types consistently.
- Do not leak stack traces, SQL errors, or provider internals to API clients.
- Map integration failures to safe, meaningful errors.

## Naming

- Use clear names that reflect domain meaning.
- Use `camelCase` for variables, properties, and functions.
- Use `PascalCase` for classes, DTOs, entities, guards, and services.
- Use `UPPER_SNAKE_CASE` for environment variable names.
- Use consistent suffixes: `Controller`, `Service`, `Module`, `Guard`, `Dto`, `Entity`, `Repository`.

## Logging

- Log request IDs or correlation IDs where available.
- Include useful operational context: user ID, ride ID, driver ID, job ID.
- Do not log passwords, tokens, secrets, full payment identifiers, or raw sensitive payloads.
- Mask phone numbers and emails in logs unless full values are required for a secure admin-only audit record.

## Constants

- Avoid magic numbers.
- Put timeout values, TTLs, surge caps, retry limits, and scoring weights in named constants or configuration.
- Keep security-sensitive defaults conservative.

## Refactoring

- Do not perform unrelated refactors inside feature tasks.
- Keep formatting-only changes out of business logic commits unless the task is specifically about formatting.
- Preserve existing local patterns unless the task asks for a change.

## Tests

- Use **Jest** as the test runner. This is already included in the NestJS default setup.
- Unit test files: `*.spec.ts`, co-located with the source file (e.g., `ride.service.spec.ts`).
- E2E test files: `*.e2e-spec.ts` under a `test/` directory at the app root.
- Add unit tests for business rules and state machines.
- Add integration tests for auth, database, payment, and API workflows when behavior crosses module boundaries.
- Add WebSocket tests for auth, room permission, payload validation, and event emission when realtime behavior changes.
- Test both success and failure paths.
- Include regression tests for bugs.

## NestJS Patterns

- Use **singleton scope** for all providers unless the task explicitly requires request or transient scope.
- Controllers handle transport only — no business logic.
- Services own business logic — no direct HTTP response manipulation.
- Use `@Injectable()` on every service and repository class.
- Use NestJS `ConfigService` for all environment variable access inside modules — no raw `process.env` in business logic.
