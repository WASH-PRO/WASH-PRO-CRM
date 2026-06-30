# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-27

Первый публичный выпуск PyOrchestrator.

### Added

- Docker Compose stack: backend, frontend, runtime, scheduler, PostgreSQL, Redis, MinIO, Prometheus, Grafana, Loki, MCP
- FastAPI control plane: scripts CRUD, multi-file editor API, runs, schedules, webhooks, secrets, backups, notifications
- React control plane UI: dashboard with Recharts, Monaco editor, RBAC (4 roles), groups, i18n (ru/en)
- Runtime sandbox: subprocess + venv + rlimits, Redis job queue, live logs via WebSocket
- APScheduler service: cron, interval, webhook triggers
- MCP server with 24+ tools for AI agents (HTTP + stdio)
- Encrypted per-script secrets vault
- Manual and scheduled backups with restore
- OTA update framework stub (`UpdateProvider`, `GitHubUpdateProvider`)
- GitHub Pages documentation site (`docs/`) — русский язык, sidebar с live-лентой Issues
- CI: backend compile, frontend build, Docker Compose build
- Login page redesign (split layout), project banners for README and docs

### Fixed

- MinIO integration: real health check, `ensure_bucket()`, `minio-init` service, correct System panel status
- Schedule delete FK violation (`runs.schedule_id` → `ON DELETE SET NULL`)
- Script stop for queued/cancelled runs and async notification lazy-load
- Dashboard asset mix label cleanup, MetricsStrip typography

[0.1.0]: https://github.com/Developer-RU/pyorchestrator/releases/tag/v0.1.0
