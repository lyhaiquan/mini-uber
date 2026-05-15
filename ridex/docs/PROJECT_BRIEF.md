# Project Brief

## Project Name

RideX - Enterprise Ride-Hailing Platform Simulation

## Goal

RideX simulates a production-grade ride-hailing platform with enterprise backend concerns: secure user access, realtime driver tracking, geospatial discovery, route estimation, matching, pricing, wallet/payment simulation, admin operations, observability, and AI-assisted operations.

The project is not a simple CRUD application. It models state machines, realtime events, geospatial search, asynchronous jobs, idempotent payments, role-sensitive workflows, and operational monitoring.

## Primary Users

### Customer

- Registers and logs in.
- Requests a ride from pickup to destination.
- Tracks assigned driver location in realtime.
- Pays through wallet/payment simulation.
- Uses in-app chat for an active ride.

### Driver

- Registers and logs in.
- Switches online/offline.
- Sends realtime location updates.
- Receives ride offers.
- Accepts or rejects offers.
- Progresses assigned ride through allowed states.

### Admin

- Views operational dashboard data.
- Reviews active rides, online drivers, simulated revenue, and risk alerts.
- Performs administrative actions with audit logging.

## Core Features

- Customer, driver, and admin roles.
- JWT authentication and refresh token rotation.
- RBAC and object-level authorization.
- Ride booking and ride state machine.
- Driver online/offline state.
- Realtime driver location updates.
- H3 geospatial indexing for driver discovery.
- OSRM route, ETA, and distance estimation.
- Matching engine with scoring, timeout, retry, and failure handling.
- Dynamic surge pricing by supply and demand per H3 cell.
- Wallet/payment simulation with idempotency.
- In-app chat.
- Admin dashboard.

## Advanced Features

- Prometheus, Grafana, Loki, Tempo, and OpenTelemetry observability.
- Rate limiting, audit logs, and security hardening.
- Demand forecasting.
- Fraud detection.
- ETA prediction.
- AI admin summary.
- Docker Compose, GitHub Actions, Nginx, Terraform, and Ansible.

## Non-Goals for MVP

- Real card payment processing.
- Real SMS or email delivery.
- Production mobile applications.
- Full multi-region deployment.
- True microservice extraction.
- Marketplace-grade promotion engine.
- Advanced ML model training pipelines.

## Why This Is Different From Normal CRUD

RideX includes workflows where correctness depends on timing, state, roles, and consistency:

- A ride cannot move through arbitrary statuses.
- A driver can receive only valid ride offers.
- Payments must not double charge under retry.
- Location updates must be authenticated and bounded.
- Matching depends on geospatial indexing and route estimation.
- Pricing must be calculated server-side.
- Admin actions need auditability.
