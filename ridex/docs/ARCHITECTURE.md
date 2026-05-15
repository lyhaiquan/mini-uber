# Architecture

## Approach

RideX starts as a modular monolith and stays microservices-ready. The first implementation should keep clear module boundaries, explicit interfaces, isolated business logic, and well-defined data ownership without adding distributed system complexity too early.

Future service extraction should be possible for matching, location, payments, AI, and observability-related workloads.

## Backend Modules

- `auth`: login, registration, JWT access tokens, refresh token rotation, guards.
- `users`: customer/admin user profile and account data.
- `drivers`: driver profile, availability, online/offline state.
- `rides`: ride requests, ride state machine, ownership checks.
- `location`: realtime driver location updates and latest-location cache.
- `geo`: H3 conversion, cell expansion, spatial helpers.
- `matching`: candidate discovery, scoring, ride offers, timeout, retry.
- `pricing`: fare formula, surge calculation, pricing snapshots.
- `payments`: wallet, payment intent, idempotency, transaction ledger.
- `notifications`: system notifications and delivery abstractions.
- `chat`: ride conversation and messages.
- `admin`: operational dashboard and admin-only actions.
- `audit`: audit events for security-sensitive and admin actions.
- `security`: rate limiting, authorization utilities, request context.
- `ai`: integration with AI service for forecasting, fraud, ETA, summaries.
- `monitoring`: health checks, metrics, tracing hooks.

## Main Request Flows

### Customer Request Ride

1. Customer sends pickup and destination through REST API.
2. API authenticates customer and validates DTO.
3. Server calls pricing and route estimation.
4. Server creates ride in a pending/requested state.
5. Matching job starts asynchronously.
6. Customer receives status updates through WebSocket.

### Matching Flow

1. Matching module reads ride pickup location.
2. Geo module converts pickup to H3 cells.
3. Driver discovery expands H3 rings to find online drivers.
4. Matching estimates driver-to-pickup distance/ETA using OSRM Table API when available. Fallback when OSRM is unavailable: Haversine great-circle distance in kilometers. Fallback ETA: `(distance_km / 30) * 60` seconds, where 30 km/h is the default urban speed estimate. Both fallback values are named constants, not magic numbers.
5. Matching computes a score for each candidate.
6. Best candidate receives a ride offer through WebSocket.
7. If the offer times out or is rejected, the next candidate is tried.
8. If no candidate remains, the ride is marked failed.

### Payment Flow

1. Server calculates fare and stores pricing snapshot.
2. Customer confirms payment with an idempotency key.
3. Payment module validates ownership and payable ride state.
4. Wallet/payment changes run inside a database transaction.
5. A transaction ledger entry is written.
6. Repeated idempotency keys return the original result without double charge.

### Realtime Tracking Flow

1. Driver socket authenticates on connection.
2. Driver sends validated location updates.
3. Server verifies driver is online and update belongs to the authenticated driver.
4. Latest location is stored in Redis with TTL.
5. Location module updates H3 driver sets.
6. Assigned customer receives authorized ride-location events.

## Communication Types

- REST API: request-response workflows, admin dashboard, account operations.
- WebSocket: realtime driver location, ride status updates, ride offers, chat.
- Queue/BullMQ: matching retries, offer timeout, notifications, async operations.
- Internal HTTP: AI service and OSRM integration.
- Metrics endpoint: Prometheus scraping.

## Data Storage Roles

- PostgreSQL: source of truth for transactional data.
- PostGIS: spatial data support when persistent geo queries are needed.
- Redis: realtime state, cache, socket coordination, BullMQ queues, temporary H3 driver sets.
- ClickHouse: future analytics and event exploration.
- MinIO/S3: future object storage for exports or media.
- Qdrant: future vector search for AI operations.

## Module Dependency Rules

Allowed import directions. Circular dependencies are forbidden.

| Module | May import from |
|---|---|
| `rides` | `pricing` (read snapshot), `geo` (H3 pickup cell) |
| `matching` | `rides` (read ride, write assignment), `geo` (H3 discovery), `location` (cached driver positions) |
| `payments` | `rides` (read fare snapshot), `wallets` |
| `chat` | `rides` (verify ride ownership before message) |
| `admin` | all modules (read-only aggregation — never mutates via other module internals) |
| `audit` | none (all modules emit to audit; audit depends on nothing) |
| `location` | `geo` (H3 cell conversion), `drivers` (online state check) |
| `pricing` | `geo` (H3 surge cell) |
| `notifications` | none (receives events, delivers outward) |

If data from a module would create a cycle, use an event (BullMQ) or extract a shared type to `common/`.

## Table Ownership Map

Mỗi table thuộc về một và chỉ một module. Module sở hữu là module duy nhất được mutate table đó. Module khác đọc dữ liệu phải qua facade của module sở hữu.

| Module | Tables sở hữu |
|---|---|
| `auth` | `refresh_tokens` |
| `users` | `users`, `user_profiles` |
| `drivers` | `drivers`, `vehicles` |
| `rides` | `rides`, `ride_events` |
| `location` | `driver_locations` (nếu persist), `location_events` (archival sau này) |
| `geo` | (không sở hữu table — pure compute + Redis sets) |
| `matching` | `ride_offers`, `ride_assignments` |
| `pricing` | `pricing_snapshots`, `pricing_configs` |
| `payments` | `payments`, `payment_intents` |
| `wallets` | `wallets`, `transactions` |
| `chat` | `conversations`, `messages` |
| `notifications` | `notifications`, `notification_deliveries` |
| `audit` | `audit_logs` |
| `ai` | `demand_forecasts`, `model_predictions`, `fraud_alerts` |
| `events` (cross-cutting) | `domain_event_outbox` |
| `promotions` (future) | `promo_codes`, `user_promo_codes`, `ride_promotions` |
| `penalties` (future) | `penalty_records` |

Quy tắc:
- Migration cho table chỉ được đặt trong module sở hữu.
- Khi tách microservice, table di chuyển cùng module — không có "shared tables".
- Nếu nhiều module cần đọc cùng dữ liệu, dùng facade của module sở hữu hoặc consume domain event.

## H3 Resolution

Driver indexing, demand heatmaps, and surge pricing use **H3 resolution 9** by default (cells ≈ 0.1 km², suitable for urban driver discovery).

- The resolution is a named constant `H3_DRIVER_INDEX_RESOLUTION = 9` in the `geo` module config.
- Do not hardcode the numeric resolution in business logic — reference the constant.
- If a feature requires a different resolution (e.g., coarser cells for city-level forecasting), define a separate named constant and document the reason.

## Domain Events & Outbox Pattern

Cross-module side effects phải emit **domain event** thay vì gọi trực tiếp module khác. Điều này giữ modules loosely coupled và sẵn sàng cho việc tách microservice trong tương lai.

### Event channels

- **In-process events** (cùng monolith): NestJS EventEmitter.
- **Cross-instance / future cross-service**: BullMQ topic queues.

### Event envelope chuẩn

```typescript
{
  eventId: string,         // UUID v4
  eventType: string,       // ví dụ: "ride.completed", "payment.refunded"
  aggregateType: string,   // ví dụ: "ride", "payment"
  aggregateId: string,     // UUID của entity bị affect
  payload: object,         // JSON-serializable
  correlationId: string,   // request ID xuyên suốt
  occurredAt: string,      // ISO 8601 UTC
  emittedBy: string        // tên module phát event
}
```

### Outbox pattern

Khi business write + emit event phải atomic (ví dụ: payment success phải kéo theo ride.paid event), dùng **outbox table** `domain_event_outbox`:

| Column | Type |
|---|---|
| `id` | bigint serial |
| `event_id` | uuid unique |
| `event_type`, `aggregate_type`, `aggregate_id` | text/uuid |
| `payload` | jsonb |
| `correlation_id` | text |
| `occurred_at` | timestamp UTC |
| `published_at` | timestamp UTC nullable |
| `attempts` | int default 0 |

Flow: Business code INSERT event vào outbox **trong cùng DB transaction**. Worker poll outbox → publish ra event bus → mark `published_at`. Đảm bảo at-least-once delivery; consumers phải idempotent.

Outbox **chưa implement ngay** ở Phase 1-3, nhưng schema được reserve. Áp dụng khi nào có cross-module write đầu tiên (sớm nhất ở task 007 hoặc task 009).

## Future Microservice Extraction

Modular monolith hiện tại **sẵn sàng** cho việc tách selective trong tương lai. Difficulty ranking dựa trên coupling, transactional integrity, và data ownership:

### 🟢 Easy to extract (~1 tuần / service)

| Service | Lý do |
|---|---|
| `ai-service` | Đã extracted (Python FastAPI), HTTP boundary có sẵn |
| `notification-service` | Downstream only — chỉ consume events, không có ai depend vào nó |
| `audit-service` | Append-only, không transactional dependency |
| `monitoring` | Prometheus pull-based, không coupling |

### 🟡 Medium (~2 tuần / service)

| Service | Khó khăn chính |
|---|---|
| `matching-service` | Cần đọc rides/drivers/location qua API thay vì SQL |
| `location-service` | Share Redis hoặc event bus cho location updates |
| `chat-service` | Storage riêng nhưng business logic isolated |
| `pricing-service` | Pricing config phải tách |

### 🔴 Hard (~3-4 tuần / service)

| Service | Vấn đề lớn |
|---|---|
| `auth-service` | Mọi service đều cần — phải design API gateway hoặc shared JWT |
| `rides-service` | Central entity touched by matching/payments/chat/admin |
| `payments-service` | Transactional integrity với rides — phải dùng Saga pattern |
| `admin-service` | Query xuyên modules — cần CQRS hoặc read replica |

### Strategy cho graduation project

1. Build modular monolith tốt, tuân thủ Module Dependency Rules + Table Ownership.
2. Khi muốn demo microservices: tách 2 service dễ nhất (AI + Notifications).
3. Document trong thesis lý do KHÔNG tách rides/payments/matching — đây là decision-making narrative tốt.
4. Code phải tuân thủ Extraction Readiness rules (xem `REVIEW_CHECKLIST.md`) để giữ cửa mở.

Mục tiêu: tách microservice phải là **deployment change**, không phải rewrite.
