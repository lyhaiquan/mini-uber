# Review Template

Use this structure when Claude reviews Codex output.

## Verdict

PASS | PASS WITH FIXES | BLOCKED

## Summary

Brief summary of what was reviewed.

## Blockers

- Issues that prevent merge or acceptance.

## Must Fix

- Required fixes before approval.

## Should Improve

- Important improvements that should be addressed soon or in this patch if small.

## Nice to Have

- Optional improvements that are not required for this task.

## Security Notes

- Authentication, authorization, sensitive data, validation, rate limiting, WebSocket security, payment security.

## Database Notes

- Migration quality, indexes, constraints, transactions, Redis usage, data consistency.

## Test Notes

- Tests reviewed, missing tests, manual verification gaps, regression risk.

## Observability Notes

- Metrics added or missing for operationally important paths.
- Structured log quality: correlation IDs present, sensitive data absent.
- Trace coverage if OpenTelemetry is relevant to the task.

## Exact Instructions for Codex

- Specific, actionable instructions Codex can follow without redesigning the task.
