---
layout: default
title: Configuration
description: .env environment variables
---

All settings are defined in `.env` (template — `.env.example`).

## Data directory

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_DIR` | `./data` | **Host** directory for MongoDB, MQTT, backups, PyOrchestrator, and `update-bridge` cache. Bind mount — survives `docker compose down` / `--build` |
| `WASH_HOST_PROJECT_ROOT` | *(auto)* | Absolute project path on the host; used by `update-bridge` for compose and auto-updates |
| `WASH_BUILD_ROOT` | *(auto)* | Build context path inside the container (`/deploy`); rarely set manually |

**Production:** any host path **outside** the container `/deploy` mount is valid, for example:

```env
DATA_DIR=/var/lib/wash-pro-crm
# or a dedicated disk:
DATA_DIR=/mnt/hdd/data
```

The **Integrity and repair** wizard *(v1.1.19+)* warns only when `DATA_DIR` mistakenly points **inside** `/deploy`. See [data/README.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/data/README.md).

## Dashboard

| Variable | Default | Description |
|----------|---------|-------------|
| `DASHBOARD_PORT` | `80` | CRM Dashboard port |
| `APP_VERSION` | `1.1.37` | Application version |

## Dynamic API

| Variable | Default | Description |
|----------|---------|-------------|
| `DYNAMIC_API_PORT` | `3001` | REST API port |
| `DYNAMIC_API_PANEL_PORT` | `8080` | Dynamic API Panel port |
| `CORS_ORIGIN` | localhost URLs | Comma-separated origins |
| `JWT_SECRET` | — | Access token (≥32 characters) |
| `JWT_REFRESH_SECRET` | — | Refresh token |
| `CSRF_SECRET` | — | CSRF |
| `ADMIN_LOGIN` | `admin` | Administrator login |
| `ADMIN_EMAIL` | `admin@wash-pro-crm.local` | Email |
| `ADMIN_PASSWORD` | `Admin123!` | Password |
| `UPDATE_EXECUTOR_ENABLED` | `true` | Auto-update via `update-bridge` (GitHub → Docker) |
| `CRM_GITHUB_REPO` | `WASH-PRO/WASH-PRO-CRM` | CRM repo for release checks |
| `DYNAMIC_API_GITHUB_REPO` | `Dynamic-API-Platform/Dynamic-API-Platform` | Upstream Dynamic API |
| `PYORCHESTRATOR_GITHUB_REPO` | `PyOrchestrator/PyOrchestrator` | Upstream PyOrchestrator |
| `# GITHUB_TOKEN` | — | **Optional.** Release notes and 5000 req/h; without token versions use `git ls-remote` *(v1.1.18+)* |
| `# DYNAMIC_API_VERSION` | from package.json | Force version (usually not needed) |

Current vendored version: **v1.5.13** (`dynamic-api/backend/package.json`).

## Service account

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVICE_LOGIN` | `service` | Account for message-processor, backup, pyorch-bridge |
| `SERVICE_PASSWORD` | — | Password |

## MQTT

| Variable | Default | Description |
|----------|---------|-------------|
| `MQTT_USER` | `system` | CRM account (message-processor); do not assign to posts |
| `MQTT_PASSWORD` | `washpro` in `.env.example` | Password on first launch; then — **Settings → MQTT (CRM)** |
| `MQTT_EXTERNAL_PORT` | `1883` | MQTT port on host (LAN access) |
| `MQTT_BIND` | empty | `127.0.0.1` — localhost only, no LAN |
| `MQTT_DEVICE_PREFIX` | `washpro` | Topic prefix `dt_pref` for outbound `set/*` |
| `MQTT_TOPICS` | — | Processor subscription topic list (comma-separated) |
| `MQTT_DEVICE_TOPIC` | `+/+/#` | WASH-PRO native protocol |

### message-processor (internal HTTP)

| Variable | Default | Description |
|----------|---------|-------------|
| `PROCESSOR_HTTP_PORT` | `3022` | HTTP API for prices and commands (proxy: `/api/crm/post-device/`) |

## Redis (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_ENABLED` | `false` | + `docker-compose.redis.yml` |
| `REDIS_PASSWORD` | empty | Password |

## Telegram (PyOrchestrator)

Telegram bots are managed via **Dashboard → Telegram** and `pyorch-bridge` → PyOrchestrator. Staff access — via **Users → Telegram user_id** and RBAC groups (not via admin ID list in bot settings). See [Telegram bots](telegram.md) and [Embedded services](embedded-services.md).

## Backup

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKUP_RETENTION_COUNT` | `7` | Keep N copies |
| `BACKUP_CRON` | `0 2 * * *` | mongodump schedule |

## PyOrchestrator (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `PYORCHESTRATOR_ENABLED` | `true` in `.env.example` | Stack enabled only when `true` in your `.env` |
| `PYORCHESTRATOR_VERSION` | `0.1.13` | Vendored version |
| `PYORCH_BACKEND_PORT` | `8000` | FastAPI |
| `PYORCH_PANEL_PORT` | `8090` | Control Plane UI |
| `PYORCH_MCP_PORT` | `8010` | MCP server |
| `PYORCH_CORS_ORIGINS` | localhost | CORS |
| `PYORCH_JWT_SECRET` | — | PyOrchestrator JWT |
| `PYORCH_SECRET_MASTER_KEY` | — | Secrets encryption |
| `PYORCH_INTERNAL_API_KEY` | — | runtime ↔ backend |
| `PYORCH_POSTGRES_*` | see example | PostgreSQL |
| `PYORCH_MINIO_*` | see example | MinIO workspace |
| `PYORCH_DASHBOARD_EMAIL` | `admin@pyorchestrator.local` | Bridge → PyOrch login |
| `PYORCH_DASHBOARD_PASSWORD` | `admin` | Bridge password |
| `PYORCH_MCP_EMAIL` / `PYORCH_MCP_PASSWORD` | admin@… / admin | MCP auth |
| `PYORCH_OBSERVABILITY_ENABLED` | `false` | Prometheus/Grafana/Loki; when `true` — Observability block on Dashboard |
| `PYORCH_GRAFANA_PUBLIC_URL` | empty | Grafana link (auto with observability) |
| `MINIO_CONSOLE_ENABLED` | `false` in WASH | Hide MinIO web console link in System |

## Production `.env` example

```env
DASHBOARD_PORT=80
JWT_SECRET=your-very-long-random-secret-at-least-32-chars
JWT_REFRESH_SECRET=another-long-random-secret
ADMIN_PASSWORD=StrongP@ssw0rd!
SERVICE_PASSWORD=StrongServiceP@ss!
MQTT_PASSWORD=secure-mqtt-password
PYORCHESTRATOR_ENABLED=true
PYORCH_JWT_SECRET=change-me-in-production
PYORCH_SECRET_MASTER_KEY=change-me-in-production-32chars!!
```

## Server-local overrides (v1.1.18+)

For host-specific changes (CPU without AVX → MongoDB 4.4, vendored patches), **do not edit** tracked git files — auto-update `git pull` will fail.

| File | Purpose |
|------|---------|
| `docker-compose.override.yml` | Service overrides (see `docker-compose.override.yml.example`); loaded by `scripts/start.sh` and updater via `scripts/compose-files.sh` |
| `local/apply-server-patches.sh` | Post-pull script (see `local/apply-server-patches.sh.example`); invoked by `update-bridge` |

Both files are **not committed** — keep them on the server only.

## Software updates (Dashboard)

- **Settings → Software updates** — CRM, Dynamic API, PyOrchestrator via `update-bridge`
- **Check now** — force GitHub check (or git fallback without token)
- Page load and job progress polling — from cache in `DATA_DIR/update-bridge/state.json`
- Update banner — Dashboard header (administrator)

See [Troubleshooting](troubleshooting.md).
