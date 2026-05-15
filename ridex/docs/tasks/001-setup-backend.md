# Task 001: Setup Backend Foundation

## Task Name

Setup NestJS backend foundation.

## Goal

Create the initial backend foundation for RideX with health checks, configuration validation, request validation, exception handling, logging, and Docker Compose service definition.

## Context

RideX will use a NestJS modular monolith first. This task creates the minimum backend shell that later tasks can build on.

## Scope

- Initialize or configure the NestJS backend app.
- Add a health check endpoint.
- Add environment/config validation.
- Add a global validation pipe.
- Add a global exception filter.
- Add a basic structured logger or logging convention.
- Add Docker Compose backend service wiring.
- Add minimal smoke tests where practical.

## Out of Scope

- Authentication.
- Database schema and migrations.
- Ride, driver, matching, payment, or admin business logic.
- Frontend code.
- AI service implementation.
- Production deployment automation.

## Expected Files/Modules

- `apps/backend` or equivalent backend package.
- Backend app bootstrap file.
- App module.
- Health module/controller.
- Config module/schema.
- Global exception filter.
- Docker Compose files.
- Basic test files.

## Functional Requirements

- Backend app starts with the configured command.
- `GET /health` returns a simple success response.
- Missing or invalid required environment variables fail fast at startup.
- Global validation rejects invalid DTO input once DTOs are added.
- Global exception filter returns a safe consistent error shape.
- Logger includes request or correlation context where available.

## Security Requirements

- Do not hardcode secrets.
- Do not commit real `.env` values.
- Error responses must not expose stack traces or internal framework details.
- Configuration validation must make unsafe defaults visible.

## Database Requirements

- No database schema is required in this task.
- Do not add ride/auth/payment tables.
- If a database connection is introduced for health checks, it must be optional or clearly configured, but no schema changes should be made.

## API/WebSocket Changes

- Add `GET /health`.
- No WebSocket gateway in this task.
- Use the API response/error convention from `docs/API_CONVENTIONS.md` when practical.

## Business Rules

- No ride-hailing business rules are implemented in this task.
- This task only prepares the foundation for later modules.

## Edge Cases

- Missing environment variables.
- Invalid environment variable type or value.
- Unknown route should return safe 404 response.
- Unexpected exception should return safe 500 response without stack trace.

## Tests Required

- Health endpoint smoke test.
- Config validation test if the project test setup is available.
- Exception filter test if practical.

## Acceptance Criteria

- Backend can start locally.
- Health endpoint returns success.
- Invalid configuration fails startup.
- Global validation and exception handling are registered.
- Docker Compose includes a backend service placeholder or runnable service.
- No auth, database, ride, payment, or matching business logic is implemented.

## Prompt for Codex

Implement Task 001 only. Set up the NestJS backend foundation with health check, config validation, global validation pipe, global exception filter, basic logger, and Docker Compose backend service. Do not implement auth, database schema, ride logic, matching, payment, frontend, or AI service. Add minimal tests for the foundation. Finish with Summary, Changed files, Tests run, and Notes/Risks.
