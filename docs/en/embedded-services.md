---
layout: default
title: Embedded services
description: Dynamic API Platform and PyOrchestrator in WASH PRO CRM
---

WASH PRO CRM includes two platforms as **vendored copies** with separate management panels. The main interface for operators is the **Dashboard** (`:80`). Platforms are available to administrators via the **Resources** block in the sidebar and direct URLs.

| Service | Vendored version | Panel | API |
|---------|------------------|-------|-----|
| **Dynamic API Platform** | v1.5.13 (`dynamic-api/backend/package.json`) | http://localhost:8080 | http://localhost:3001 |
| **PyOrchestrator** *(opt.)* | v0.1.13 (`pyorchestrator/CHANGELOG.md`) | http://localhost:8090 | http://localhost:8000 |

> Full upstream documentation: [Dynamic API Platform](https://dynamic-api-platform.github.io/Dynamic-API-Platform/) · [PyOrchestrator](https://pyorchestrator.github.io/PyOrchestrator/)

---

## Who uses what

| Capability | Operator / Viewer | Administrator (Dashboard) | Panel `:8080` | Panel `:8090` |
|------------|-------------------|---------------------------|---------------|---------------|
| CRM/SCADA data | ✅ Dashboard | ✅ Dashboard | — | — |
| Users and RBAC groups | ❌ | ✅ Dashboard → System | ✅ Users / Groups | ✅ Users / Groups |
| Endpoints, schemas, cron, webhooks | ❌ | 🔗 Resources link | ✅ | — |
| Telegram bots (multiple) | ❌ | ✅ Dashboard → Telegram *(PyOrch)* | — | ✅ Scripts (full editor) |
| Python scripts, schedules | ❌ | 🔗 Resources link | — | ✅ |
| MongoDB CRM backups | ❌ | ✅ Dashboard → Backups | — | — |
| Audit logs | ❌ | ✅ Dashboard → Logs | ✅ Audit Logs | — |

---

## Dynamic API Platform

### Role in WASH PRO CRM

- **Sole backend** for CRM: all `/api/crm/*` data stored in MongoDB via the runtime engine.
- **JWT + RBAC** for Dashboard and internal service accounts (`message-processor`, `backup`, `pyorch-bridge`).
- **`init-seed`** creates 11 endpoint groups and 52 CRM routes on first launch.

Dashboard proxies `/api/` → `dynamic-api:3001` (nginx in the `dashboard` container).

### Confirmed platform capabilities (v1.5.13)

Available in the **Dynamic API** panel (`:8080`), unless noted otherwise:

| Category | Capabilities |
|----------|--------------|
| **Dynamic API Engine** | REST endpoints GET/POST/PUT/PATCH/DELETE via UI; **routes active immediately after save**; JSON schema; path params; `reference` + `?populate=`; optional record TTL; path change with data migration; built-in API tester |
| **Automation** | Cron (javascript / http / endpoint); outbound webhooks (HMAC); API keys; MCP server (`POST /api/mcp`); JavaScript handlers `async function handler(req, db)`; versioning `/api/v1/...` |
| **Security** | JWT + refresh; RBAC (5 system groups + custom); network access (domains/IP); rate limiting; login lockout; audit logs; Helmet, CORS, CSRF |
| **Admin Panel** | Dashboard KPI; endpoints & groups; **API Schema** (ER diagram); **Database Explorer**; users/groups; audit logs; 4 UI themes; OpenAPI/Swagger; project export/import |
| **DevOps (upstream)** | Standalone Docker, MongoDB replica set, Kubernetes — **not used in standard WASH compose**, but manifests exist in `dynamic-api/` |

### Disabled or limited in WASH

| Feature | Status in WASH |
|---------|----------------|
| **In-app Software Updates** (GitHub Releases) | ❌ `UPDATE_EXECUTOR_ENABLED=false` — update via `./scripts/update-dynamic-api.sh` |
| **Standalone MongoDB stack** Dynamic API | ❌ shared `wash-mongodb` is used |
| **Direct operator access to endpoint-builder** | ❌ only via `:8080` (admin) |

### Updating Dynamic API in WASH

```bash
./scripts/update-dynamic-api.sh
docker compose up -d --build dynamic-api dynamic-api-panel
./scripts/run-init-seed.sh   # if CRM schema changed
```

WASH patches: `patches/dynamic-api-wash.patch`. Embedded UI: `patches/wash-embedded/`.

---

## PyOrchestrator

### Role in WASH PRO CRM

PyOrchestrator is **optional**. Enabled when `.env` contains:

```env
PYORCHESTRATOR_ENABLED=true
```

Script `./scripts/start.sh` attaches `docker-compose.pyorchestrator.yml`.

| WASH component | Purpose |
|----------------|---------|
| `pyorch-backend` | FastAPI REST + WebSocket |
| `pyorchestrator-panel` | React Control Plane (`:8090`) |
| `pyorch-runtime` | Isolated Python subprocesses (no container per script) |
| `pyorch-scheduler` | Cron / interval / webhook triggers |
| `pyorch-bridge` | HTTP bridge CRM ↔ PyOrchestrator for Telegram bots |
| `pyorch-postgres`, `pyorch-redis`, `pyorch-minio` | Metadata, queue, workspace |
| `pyorch-mcp` | MCP for AI agents (`:8010`, optional) |
| `pyorch-prometheus`, `pyorch-grafana`, `pyorch-loki`, `pyorch-promtail` | Observability (profile `pyorch-observability`, off by default) |

### Confirmed PyOrchestrator capabilities (v0.1.13)

Available in the **PyOrchestrator** panel (`:8090`):

| Category | Capabilities |
|----------|--------------|
| **Scripts** | CRUD; multi-file workspace (Monaco); groups; type `bot`; secrets (AES-GCM); hot reload via Redis |
| **Runs** | Start/stop; queue; history; live logs via WebSocket `ws://.../ws/runs/{run_id}` |
| **Schedules** | Cron and interval |
| **Webhooks** | Inbound HTTP `POST /hooks/{token}` |
| **Backups** | Create/restore in UI |
| **Dashboard** | KPI and timeseries in Control Plane |
| **Security** | JWT; roles Administrator / Developer / Operator / Viewer |
| **MCP** | 24 tools on `:8010/mcp` (scripts, runs, schedules, secrets…) |
| **Observability** | Prometheus + Grafana + Loki *(profile `pyorch-observability`)* |

### **Not** implemented (do not claim as ready)

| Feature | Status |
|---------|--------|
| In-app OTA updates in panel `:8090` | ❌ disabled in WASH (`UPDATE_EXECUTOR_ENABLED=false`) — `./scripts/update-pyorchestrator.sh` |
| OTA updates (`GitHubUpdateProvider`) upstream | Stub / backlog |
| Audit logs UI | Table exists; UI on roadmap |
| Production multi-runtime scaling | Only in upstream `docker-compose.prod.yml`, not in WASH overlay |

### Dashboard integration: Telegram bots

With PyOrchestrator enabled, administrators manage bots in **Dashboard → System → Telegram** without mandatory login to panel `:8090`. Full documentation: [Telegram bots](telegram.md).

```
Dashboard  →  /api/telegram-bots/*  →  pyorch-bridge  →  PyOrchestrator API
                                                      ↓
                              Dynamic API  GET /api/users/telegram/{id}/auth
```

| Bridge endpoint | Action |
|-----------------|--------|
| `GET /health` | PyOrchestrator availability check |
| `GET /bots` | List WASH Telegram bots |
| `POST /bots` | Create bot (script_type `bot` + secrets) |
| `PUT/DELETE /bots/:id` | Update / delete |
| `POST /bots/:id/start\|stop` | Start / stop |
| `GET /bots/:id/link` | QR code and `t.me/...` link |
| `POST /bots/refresh` | Sync templates + restart all bots |

**Bot types:** Management (full RBAC), Service (monitoring + post commands), **Information** (public: news, prices, occupancy, promotions from CRM).

**Information bot (v1.9):** content from **Dashboard → Automation → Publications**; broadcast to subscribers in **private chats**; images in one message (photo + caption); correct post occupancy.

**Isolation (v1.1.11+):** bots respond only in private messages — each user does not see others' dialogs.

### Dashboard integration: Modules

CRM extensions from separate GitHub repositories: **Dashboard → Automation → Modules**. Documentation: [Modules](modules.md).

```
Dashboard  →  /api/crm/modules/*  →  modules-bridge  →  git + PyOrchestrator
                                              ↓
                              Dynamic API  http://dynamic-api:3001
```

| Bridge endpoint | Action |
|-----------------|--------|
| `GET /health` | Health (+ PyOrch) |
| `GET /catalog` | Module catalog |
| `POST /install/:id` | Install from GitHub |
| `POST /installed/:id/start\|stop\|update` | Lifecycle |
| `DELETE /installed/:id` | Full uninstall |
| `GET /ui/:id/` | Module settings UI |

Developer template: [wash-module-starter](https://github.com/WASH-PRO/wash-module-starter).

### MCP in Dashboard (v1.1.12)

**Dashboard → Automation → MCP server** (`/mcp`):

- switcher **Dynamic API** / **PyOrchestrator**;
- HTTP URL and ready **Cursor** config (no build required);
- table of registered tools;
- nginx proxy: `/api/mcp`, `/api/pyorch-mcp/mcp`.

Separate stdio server for agents: `services/crm-mcp` (see [docs/mcp.md](mcp.md)).

**Staff access:** **Telegram user_id** field in **Dashboard → Users** + RBAC group. Viewer — reports only; Operator — create sites and post commands; Administrator — full access. Admin Telegram IDs field in bot form **removed** (since v1.1.0).

Bridge → PyOrchestrator credentials: `PYORCH_DASHBOARD_EMAIL` / `PYORCH_DASHBOARD_PASSWORD` (default `admin@pyorchestrator.local` / `admin`).

### Updating PyOrchestrator in WASH

```bash
./scripts/update-pyorchestrator.sh
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build pyorch-backend pyorchestrator-panel pyorch-bridge
```

WASH patches: `patches/pyorchestrator-wash/`. Embedded panel: `services/pyorchestrator-panel/Dockerfile`, `VITE_WASH_EMBEDDED=true`.

---

## Resources block in Dashboard

At the bottom of the Dashboard sidebar:

| Item | Description |
|------|-------------|
| **Dynamic API** | Link to `:8080` + online/offline indicator (`GET /api/health`) |
| **PyOrchestrator** | Link to `:8090` + indicator (`GET /api/telegram-bots/health` → bridge → PyOrch) |
| **Documentation** | GitHub Pages |
| **GitHub** | Project repository |

---

## Default credentials

| Interface | Login | Password | `.env` variables |
|-----------|-------|----------|------------------|
| Dashboard + Dynamic API Panel | `admin` | `Admin123!` | `ADMIN_LOGIN`, `ADMIN_PASSWORD` |
| PyOrchestrator Panel | `admin@pyorchestrator.local` | `admin` | created on PyOrch seed |
| Service account (internal) | `service` | `ServiceInternal123!` | `SERVICE_LOGIN`, `SERVICE_PASSWORD` |

Change all passwords and secrets before production.
