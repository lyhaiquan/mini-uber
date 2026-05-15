# RideX

RideX is an enterprise ride-hailing platform simulation inspired by Grab/Uber. The project focuses on backend architecture, security, realtime location tracking, driver matching, pricing, payment idempotency, observability, and AI operations.

This repository currently contains the planning and agent documentation used to guide implementation.

## Documentation

- [Project brief](docs/PROJECT_BRIEF.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Codex agent guide](AGENTS.md)
- [Claude guide](CLAUDE.md)
- [Task list](docs/tasks/)

## Intended Stack

- Backend: NestJS + TypeScript
- Database: PostgreSQL + PostGIS
- Cache and queue: Redis + BullMQ
- Realtime: Socket.IO
- Geo: H3
- Routing: OSRM
- Frontend: React/Next.js + Leaflet
- AI service: Python FastAPI + scikit-learn
- Observability: Prometheus + Grafana
- Infrastructure: Docker Compose, Nginx
