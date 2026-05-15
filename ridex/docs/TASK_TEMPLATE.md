# Task Template

Use this structure when Claude writes an implementation task for Codex.

## Task Name

Short descriptive name.

## Goal

What this task should accomplish and why it matters.

## Context

Relevant project, architecture, business, or previous-task context.

## Scope

What Codex should implement in this task.

## Out of Scope

What Codex must not implement in this task.

## Expected Files/Modules

Likely files, folders, modules, tests, migrations, or docs to touch. This is guidance, not permission for broad refactors.

## Functional Requirements

- Requirement 1.
- Requirement 2.

## Security Requirements

- Authentication, authorization, validation, data protection, and audit requirements.

## Database Requirements

- Schema changes, migrations, indexes, transactions, locking, or Redis usage.

## API/WebSocket Changes

- REST endpoints, WebSocket events, request/response contracts, and error behavior.

## Business Rules

- Domain-specific rules that must be enforced.

## Edge Cases

- Failure modes, invalid inputs, retries, concurrency, timeout, and boundary cases.

## Tests Required

- Unit, integration, e2e, WebSocket, or migration tests required for acceptance.

## Acceptance Criteria

- Concrete checklist for done.

## Prompt for Codex

Copyable instruction for Codex that includes scope, constraints, and expected completion format.
