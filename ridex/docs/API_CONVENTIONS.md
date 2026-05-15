# API Conventions

## Communication Choices

- Use REST for request-response workflows.
- Use WebSocket for realtime ride updates, driver location, offers, and chat.
- Use BullMQ queues for background jobs, retries, timeouts, notifications, and async matching.
- Use internal HTTP for AI service and OSRM integration.
- Expose a metrics endpoint for Prometheus.

## REST Endpoint Naming

- Use plural nouns for resources: `/rides`, `/drivers`, `/payments`.
- Use nested routes only when ownership is clear: `/rides/{rideId}/messages`.
- Use action routes sparingly for domain actions: `/rides/{rideId}/cancel`, `/drivers/me/online`.
- Use `/me` for the authenticated user's own resource.
- Keep admin endpoints under `/admin`.

## Success Response Format

Use a consistent envelope unless a framework-specific convention is chosen later.

```json
{
  "data": {},
  "meta": {
    "requestId": "req_123"
  }
}
```

## Error Response Format

```json
{
  "error": {
    "code": "RIDE_INVALID_STATE",
    "message": "Ride cannot transition from completed to accepted.",
    "details": {}
  },
  "meta": {
    "requestId": "req_123"
  }
}
```

Error messages must be safe for clients and must not expose stack traces, SQL details, secrets, or provider internals.

## Pagination Format

Request:

```text
GET /rides?limit=20&cursor=abc
```

Response:

```json
{
  "data": [],
  "page": {
    "limit": 20,
    "nextCursor": "def",
    "hasMore": true
  },
  "meta": {
    "requestId": "req_123"
  }
}
```

Use cursor pagination for high-volume or frequently changing data. Offset pagination may be acceptable for small admin lists.

## WebSocket Event Naming

Use namespaced event names:

- `driver.location.updated`
- `ride.offer.created`
- `ride.offer.accepted`
- `ride.status.updated`
- `ride.tracking.updated`
- `chat.message.created`
- `admin.metrics.updated`

Every event must define:

- Required auth role.
- Room authorization rule.
- Payload schema.
- Error event behavior.

## Correlation ID

- Accept `x-correlation-id` from trusted clients when appropriate.
- Generate a request ID if none exists.
- Include the ID in logs, responses, job metadata, and downstream calls.
- Propagate the ID to OSRM and AI service calls when useful.

## WebSocket Rooms and Namespaces

- Use the default Socket.IO namespace (`/`).
- Rooms:
  - Driver location room: `driver:{driverId}`
  - Ride room (customer + assigned driver): `ride:{rideId}`
  - Admin dashboard room: `admin:dashboard`
- A driver joins `driver:{driverId}` on authenticated connect.
- On ride match, driver is admitted to `ride:{rideId}`.
- Customer joins `ride:{rideId}` after ride creation.
- Admin users join `admin:dashboard` on authenticated connect.
- No cross-room broadcasts. Events are scoped to the smallest required room.
- Rate limit response: HTTP 429 with `Retry-After` header (seconds). WebSocket equivalent: emit `error` event with code `RATE_LIMITED` and `retryAfter` field, then disconnect if persistent.

## Versioning

- Start with `/api/v1`.
- Do not break existing contracts without a versioned migration path.
- Prefer additive changes for response fields.
