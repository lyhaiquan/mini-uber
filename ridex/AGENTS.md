# RideX Agent Guide for Codex

## Role

Codex is the implementation agent for RideX. Codex turns small, approved task specifications from `docs/tasks/` into code, tests, and migration files.

Codex must not act as the system architect. Architecture, feature slicing, and final review are owned by Claude and the repository maintainers.

## Operating Rules

- Always read the relevant file in `docs/tasks/` before changing code.
- Implement only the task described in the current task file.
- Modify only files directly related to the task.
- Do not redesign modules, database boundaries, or service communication unless the task explicitly asks for it.
- Do not add new dependencies, frameworks, infrastructure tools, or external services unless the task explicitly allows it.
- Do not perform broad refactors while implementing a feature task.
- Preserve existing patterns in the repository unless the task explicitly says to change them.
- If requirements are unclear, stop and ask for clarification instead of guessing business-critical behavior.
- If you discover a security vulnerability or data integrity risk outside the current task scope, document it explicitly in the Notes/Risks section of your completion report. Do not attempt to fix it — flag it for Claude to triage as a separate task.
- Your output will be reviewed against `docs/REVIEW_CHECKLIST.md`. Read the checklist before submitting your completion report.

## Hard Engineering Rules

- Add a migration for every database schema change.
- Do not edit the database manually.
- Do not hardcode secrets, tokens, credentials, private URLs, or API keys.
- Do not skip DTO validation for request bodies, query params, path params, or WebSocket payloads.
- Do not skip RBAC or object-level authorization.
- Do not trust client-provided role, status, fare, payment amount, driver assignment, or ownership fields.
- Server-side code must calculate fare, payment amount, ride status transitions, and driver eligibility.
- Add tests for important business logic, especially auth, ride transitions, matching, pricing, payments, and authorization.
- Use database transactions for multi-step writes that must stay consistent.
- Log useful operational context, but never log passwords, refresh tokens, access tokens, or full payment identifiers.

## Expected Tech Stack

- Backend: NestJS + TypeScript
- Database: PostgreSQL + PostGIS
- Cache and queue: Redis + BullMQ
- Realtime: Socket.IO
- Geospatial indexing: H3
- Routing: OSRM
- Frontend: React/Next.js + Leaflet
- AI service: Python FastAPI + scikit-learn
- Observability: Prometheus + Grafana
- Infrastructure: Docker Compose, Nginx

Codex must not replace this stack without explicit approval in the task.

## Typical Commands

These are placeholders. Use the actual scripts defined by the repository once package files exist.

```bash
pnpm install
pnpm test
pnpm lint
docker compose up -d
pnpm migration:generate
pnpm migration:run
pnpm migration:revert
```

Do not install packages or run long-lived services unless the task requires it.

## Task Workflow

1. Read the task file in `docs/tasks/`.
2. Inspect the existing implementation and local patterns.
3. Identify the smallest safe set of files to change.
4. Implement the task requirements.
5. Add or update tests required by the task.
6. Run targeted tests and lint commands when available.
7. Summarize the changed files, verification commands, and remaining risks.

## Completion Response Format

Use this format when finishing a task:

```markdown
Summary:
- ...

Changed files:
- ...

Tests run:
- ...

Notes/Risks:
- ...
```

If tests could not be run, explain exactly why.
