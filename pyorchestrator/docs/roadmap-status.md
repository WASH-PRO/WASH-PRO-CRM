# PyOrchestrator — Development Roadmap (status)

## Completed in v0.1.13

| Item | Status |
|------|--------|
| Backend deps: uvicorn, alembic, python-jose, psutil | ✅ |
| Documentation and wiki sync | ✅ |

## Completed in v0.1.12

| Item | Status |
|------|--------|
| Script code update via PUT API | ✅ |
| Script delete with notification history | ✅ |
| Runtime Redis reconnect and resilient log publishing | ✅ |
| Dependency updates (backend, frontend, CI) | ✅ |

## Completed in v0.1.11

| Item | Status |
|------|--------|
| OTA updates via GitHub Releases | ✅ |
| Optional Grafana observability block in UI | ✅ |
| Optional MinIO web console (`MINIO_CONSOLE_ENABLED`) | ✅ |

## Completed in v0.1.0

| Phase | Status | Notes |
|-------|--------|-------|
| MVP-0 Foundation | ✅ | Compose, DB auto-migrate, health, Prometheus/Grafana/Loki, CI |
| MVP-1 Script CRUD + Run | ✅ | CRUD, run/stop, logs WS, import/export, templates |
| MVP-2 Scheduler + Dashboard | ✅ | Cron/interval schedules, KPI dashboard, webhook hooks |
| MVP-3 Editor + RBAC | ✅ | Monaco editor, JWT auth, 4 roles, groups |
| Production-1 | ✅ | Secrets vault, notifications, backups |
| Production-2 | ✅ | OTA updates, UpdateProvider, multi-runtime compose prod file, metrics |

See original plan in sections below.

---
