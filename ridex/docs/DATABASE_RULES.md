# Database Rules

## Source of Truth

PostgreSQL is the source of truth for transactional data. Redis is for realtime state, temporary state, cache, distributed locks, rate limits, and queues.

Do not store long-term business-critical records only in Redis.

## When to Add a Column

Add a column when the data:

- Belongs directly to one existing row.
- Is a simple attribute.
- Has a one-to-one lifecycle with the parent row.
- Does not need independent history, status, ownership, or query patterns.

Example: `users.phone` can be a column.

## When to Split a Table

Create a separate table when the data:

- Has multiple records per parent.
- Has its own lifecycle or status.
- Needs history or auditability.
- Needs independent permissions.
- Will be queried, filtered, indexed, or aggregated independently.

Examples:

- Promotions should use tables such as `promo_codes`, `user_promo_codes`, and `ride_promotions`.
- Chat should use `conversations` and `messages`.
- Payments should use `payments`, `wallets`, and `transactions`.
- Ride matching offers should use a separate table if offer history must be audited or analyzed.

## Migration Rules

- Do not change the database manually.
- Every schema change must have a migration.
- Add nullable columns first when deploying to existing data.
- Backfill old rows in a controlled step.
- Add constraints and indexes after backfill.
- Avoid destructive changes in the same deployment that introduces replacement fields.
- Use expand-and-contract for drop or rename operations.
- Make migrations deterministic and reviewable.
- Keep data migrations idempotent where practical.

## Expand-and-Contract Example

1. Add a new nullable column.
2. Write code that supports both old and new columns.
3. Backfill existing data.
4. Add validation and constraints.
5. Switch reads to the new column.
6. Remove old column in a later migration after verification.

## Cross-Module Database Rules

Để giữ modular monolith sẵn sàng cho việc tách microservice trong tương lai, các rule sau là bắt buộc:

- **Cấm SELECT trực tiếp từ table thuộc module khác.** Truy cập dữ liệu cross-module phải qua facade/service của module sở hữu (xem Table Ownership Map trong `ARCHITECTURE.md`).
- **Cấm cross-module foreign keys với CASCADE delete.** Nếu cần liên kết cross-module, dùng FK với `ON DELETE RESTRICT` hoặc reference logic-only (lưu UUID không enforce constraint).
- **Cross-module JOIN trong SQL chỉ được phép trong read-only admin/analytics queries**, và phải được document rõ là exception. Mọi flow write/critical-read phải đi qua facade.
- **Migration cho table chỉ được đặt trong module sở hữu.** Module khác không được tạo/sửa migration cho table không thuộc về mình.
- **Không tạo "shared tables".** Nếu nhiều module cần dữ liệu chung, dữ liệu thuộc module gốc; các module khác cache local copy qua domain event nếu cần.

## Indexing Rules

- Add indexes for foreign keys used in joins.
- Add indexes for common filters, sort keys, and lookup fields.
- Add composite indexes for query patterns, not individual columns by habit.
- Add unique constraints for business uniqueness, such as idempotency keys within a scope.
- Consider partial indexes for status-specific queries, such as active rides.
- Review index cost for high-write tables like location, payments, and messages.

## Transaction Rules

- Use transactions for multi-table writes that must commit together.
- Use row locks or safe concurrency patterns for wallet balances, ride acceptance, and driver assignment.
- Avoid long-running transactions around network calls.
- Do not call OSRM, AI services, or WebSocket delivery while holding database locks unless unavoidable.

## Financial Data

- Store all monetary amounts as **integer minor units** (e.g., cents for USD, xu for VND). Never use float or decimal string for money.
- The unit convention must be documented in a comment on every financial column.
- Conversion to display format (e.g., dividing by 100) happens in the response/serialization layer only, never in business logic or persistence.

## Timestamps and IDs

- All timestamps must be stored in UTC.
- Every entity must have `created_at` and `updated_at` columns managed by the ORM or database default.
- Use UUID v4 for IDs of entities exposed in public API responses (rides, users, drivers, payments, wallets).
- Use serial/bigint for high-volume internal tables (audit_logs, transactions, messages, location_events) unless the ID is exposed externally.

## Soft Delete

RideX does not use soft deletes by default. If a specific entity requires a `deleted_at` column, the task must document the reason. Do not add `deleted_at` to all tables preemptively.

## JSONB Rules

- Use JSONB for flexible metadata, integration payload snapshots, and audit context.
- Do not use JSONB to avoid modeling core business entities.
- Add constraints or validation when JSONB fields affect business logic.
- Add JSONB indexes only for proven query paths.
