# Review: Task 001 — Setup Backend Foundation (Round 2)

**Task file:** `docs/tasks/001-setup-backend.md`
**Previous review:** Round 1 (in-conversation, đã yêu cầu sửa MF-1 → MF-5 + SI-3)
**Round:** 2 (post-fix verification)
**Reviewed by:** Claude (architect/reviewer)

---

## Verdict: **PASS** ✅

Task 001 đã hoàn tất. Sẵn sàng merge và chuyển sang Task 002.

---

## Summary

Codex đã apply đầy đủ 5 must-fix + SI-3 từ round 1:

| Fix | Status | Verification |
|---|---|---|
| MF-1 — Dockerfile reproducibility | ✅ | `COPY pnpm-lock.yaml ./` + `--frozen-lockfile` |
| MF-2 — Remove `"info"` khỏi LogLevel | ✅ | `LOG_LEVEL_VALUES` chỉ còn 5 giá trị, type `LogLevel` aligned với NestJS `LoggerService` |
| MF-3 — LOG_LEVEL implementation | ✅ | StructuredLogger inject `ConfigService`, có `LOG_LEVEL_PRIORITY` map, `shouldWrite()` filter |
| MF-4 — Exclude `/health` khỏi RequestLoggingMiddleware | ✅ | `app.module.ts` tách 2 middleware, exclude health |
| MF-5 — `CORS_ORIGINS` multi-origin | ✅ | `readCorsOrigins()` parse comma-separated, validate từng URL |
| SI-3 — Middleware integration tests | ✅ | 2 spec files mới: correlation-id + request-logging |

**Bonus:** Codex còn thêm `structured-logger.spec.ts` (chưa được yêu cầu trong round 1) — cover LOG_LEVEL filtering behavior. Tốt.

---

## Test Results

```
Unit tests:  7 suites, 20 tests passed
E2E tests:   1 suite, 2 tests passed
Lint:        clean (0 errors, 0 warnings)
```

Test breakdown:
- `env.validation.spec.ts` — 5 tests
- `request-context.spec.ts` — 4 tests
- `correlation-id.middleware.spec.ts` — 2 tests (NEW)
- `request-logging.middleware.spec.ts` — 1 test (NEW)
- `structured-logger.spec.ts` — 2 tests (NEW, bonus)
- `all-exceptions.filter.spec.ts` — 2 tests
- `validation-pipe.factory.spec.ts` — 3 tests
- `app.e2e-spec.ts` — 2 tests (health envelope + 404 safety)

---

## Blockers

Không có.

## Must Fix

Không có.

## Should Improve

Không có cho task 001. Các điểm sau **defer sang task 002+** (không phải fix bây giờ):

- `CommonModule` để export StructuredLogger gọn gàng — sẽ cần khi business modules join (task 002).
- Graceful shutdown handler — sẽ cần khi DB connection xuất hiện (task 002).

## Nice to Have

- `.dockerignore` (defer Phase 8 — DevOps).
- Helmet headers (defer Phase 8 — security hardening).
- Prometheus metrics endpoint (defer Phase 9 — observability).

---

## Security Notes

- ✅ Stack trace không leak (verified qua `all-exceptions.filter.spec.ts` case 500: "database password leaked in provider error" → không xuất hiện trong response).
- ✅ Validation pipe `forbidNonWhitelisted` + `transform` strict.
- ✅ Correlation ID input được sanitize (length ≤ 128, charset `[A-Za-z0-9._:-]`).
- ✅ `.env.example` không chứa secret thật.
- ✅ CORS giờ là multi-origin nhưng vẫn require valid http/https URL.

## Database Notes

N/A — task 001 không tạo DB connection (đúng scope).

## Test Notes

- ✅ Test coverage tốt cho foundation: env, middleware integration, filter, pipe, e2e.
- ✅ `structured-logger.spec.ts` test cả filter behavior và proper console output channel (`console.warn` vs `console.error`).
- ✅ Edge cases được cover: unsafe correlation ID, validation pipe rejecting extra fields.
- ⚠️ Chưa có test cho `LOG_LEVEL=verbose` (lowest level) — minor, không bắt buộc.

## Observability Notes

- ✅ Correlation ID pipeline đầy đủ: header → middleware → request → logger → exception filter → response header.
- ✅ Request logging có structured fields (`event`, `correlationId`, `method`, `path`, `statusCode`, `durationMs`).
- ✅ Health endpoint không bị flood log nữa (excluded).
- ✅ LOG_LEVEL config thực sự có tác dụng (priority-based filtering).

---

## Extraction Readiness

Task 001 chưa có business module nên facade pattern chưa áp dụng. Tuy nhiên:

- ✅ `common/` đã được tách thành sub-folders (`filters`, `logging`, `middleware`, `pipes`) — chuẩn bị tốt cho structure.
- ⚠️ `StructuredLogger` được register trực tiếp trong `AppModule` providers. Khi business modules cần inject, có 2 lựa chọn: (1) tạo `CommonModule` exports, hoặc (2) giữ ở AppModule level (NestJS global DI vẫn hoạt động).

**Quyết định kiến trúc cho task 002+:** Khi user/driver/ride module đầu tiên xuất hiện, Codex nên tạo `common.module.ts` để export `StructuredLogger` + shared utilities. Đây là setup cho facade pattern.

---

## Exact Instructions for Codex

Không có. Task 001 PASS, không cần fix thêm.

**Next action:** Bắt đầu **Task 002 — Auth JWT Refresh** (`docs/tasks/002-auth-jwt-refresh.md`).

Trước khi bắt đầu task 002, Codex cần:

1. Đọc `docs/tasks/002-auth-jwt-refresh.md`.
2. Đọc `docs/SECURITY_RULES.md` (JWT TTL defaults, refresh token rotation, token family invalidation, audit events).
3. Đọc `docs/DATABASE_RULES.md` (migration rules, UUID/timestamp conventions, cross-module rules).
4. Đọc `docs/CODING_STANDARDS.md` (Module Boundaries — Facade Pattern: task 002 sẽ tạo business modules đầu tiên, cần `auth.facade.ts`, `users.facade.ts`).
5. Đọc `docs/ARCHITECTURE.md` (Table Ownership Map: `refresh_tokens` thuộc `auth`, `users` thuộc `users` module).

Lưu ý task 002 sẽ là task **đầu tiên** có business logic + database, nên:

- Tạo `CommonModule` để export `StructuredLogger` (sẽ cần inject vào auth/users services).
- Setup migration tooling (TypeORM hoặc Prisma — task chưa specify, Codex chọn và document).
- Tạo `auth.facade.ts` và `users.facade.ts` ngay từ đầu — không refactor sau.
- Tuân thủ JWT TTL defaults: `ACCESS_TOKEN_TTL=15m`, `REFRESH_TOKEN_TTL=7d`.
- Tuân thủ rule: cross-module reference (auth → users) chỉ qua facade, không qua repository.

---

**Reviewer signature:** Claude (architect)
**Date:** 2026-05-15
**Status:** ✅ PASS — Move to Task 002
