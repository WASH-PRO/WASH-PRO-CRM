---
layout: default
title: Architecture
description: WASH PRO CRM architecture: Dashboard, Dynamic API, MongoDB, MQTT controllers, Telegram bots, and optional PyOrchestrator data flows.
---

## Overview

```
Post controllers
       │
       ▼
   Mosquitto  (wash/telemetry/#  and  +/+/#)
       │
       ▼
 Message Processor ◄── HTTP :3022 (commands/prices from Dashboard)
       │
       ▼
 Dynamic API ──► MongoDB
       ▲
Dashboard (React) ──────────┤ nginx /api proxy
                            │  /api/crm/post-device/ → processor
                            │
         pyorch-bridge ─────┤ (Telegram, Admin)
              ▲             │
              │             │
       PyOrchestrator ──────┘ (opt.)
              │
    modules-bridge ─────────┤ (Modules catalog, v1.1.30)
              │
    backup / service account
```

## Docker Compose Services

### Main stack (`docker-compose.yml`)

| Service | Container | Purpose | External access |
|---------|-----------|---------|-----------------|
| `mongodb` | wash-mongodb | CRM database (Dynamic API) | ❌ |
| `dynamic-api` | wash-dynamic-api | REST API | ✅ `:3001` |
| `dynamic-api-panel` | wash-dynamic-api-panel | Dynamic API Panel | ✅ `:8080` |
| `dashboard` | wash-dashboard | CRM Dashboard | ✅ `:80` |
| `init-seed` | wash-init-seed | One-time CRM initialization | ❌ |
| `mosquitto` | wash-mosquitto | MQTT telemetry broker | ✅ `:1883` (LAN) |
| `mosquitto-init` | wash-mosquitto-init | `system` + ACL template | ❌ |
| `message-processor` | wash-message-processor | MQTT ↔ API, sync passwd/ACL, HTTP `:3022` | ❌ |
| `modules-bridge` | wash-modules-bridge | Module catalog, lifecycle, UI proxy | ❌ *(localhost `:3024`)* |
| `backup` | wash-backup | mongodump + HTTP files; optional full bundle (settings + module data) *(v1.1.44)* | ❌ |

### Optional services

| Service | Condition | Purpose |
|---------|-----------|---------|
| `redis` | `REDIS_ENABLED=true` + `docker-compose.redis.yml` | Cache (profile `redis`) |
| **PyOrchestrator stack** | `PYORCHESTRATOR_ENABLED=true` | See table below |

### PyOrchestrator (`docker-compose.pyorchestrator.yml`)

| Service | External access | Purpose |
|---------|-----------------|---------|
| `pyorch-backend` | ✅ `:8000` | FastAPI |
| `pyorchestrator-panel` | ✅ `:8090` | Control Plane UI |
| `pyorch-mcp` | ✅ `:8010` | MCP for AI agents |
| `pyorch-bridge` | ❌ (via Dashboard) | CRM Telegram bots |
| `pyorch-runtime` | ❌ | Python sandbox |
| `pyorch-scheduler` | ❌ | Schedules |
| `pyorch-postgres` | ❌ | Metadata |
| `pyorch-redis` | ❌ | Job queue |
| `pyorch-minio` | ❌ | Workspace |
| `pyorch-prometheus/grafana/loki/promtail` | profile `pyorch-observability` | Metrics and logs |

Details: [Embedded services](embedded-services.md).

## Docker Networks

| Network | Type | Purpose |
|---------|------|---------|
| `wash-internal` | internal | MongoDB, message-processor, backup (no internet access) |
| `wash-external` | bridge | Dashboard, API, **Mosquitto** (port 1883 for LAN) |

MongoDB is **not published** externally. MQTT (`:1883`) is available on the local network for post controllers.

## Telemetry Flow

### Inbound (post → CRM)

1. Controller publishes JSON to topic `{dt_pref}/{serial}/state/{suffix}` (native protocol) or `wash/telemetry/{type}` (legacy), QoS 1, with **post login** from CRM.
2. Mosquitto checks ACL: post can write only to topics of **its own** `serialNumber`.
3. `message-processor` (as `system`) subscribes to `wash/telemetry/#` and `+/+/#`.
4. Serial number for CRM is taken **from the topic** (payload with foreign serial is ignored).
5. Post is found by serial in `/api/crm/posts`.
6. Data is written to CRM endpoints (`post-states`, `cards`, statistics…).
7. Each message is duplicated to the log `/api/crm/telemetry`.
8. Processing errors → DLQ `wash/dlq`.

**MQTT sync:** on post save or `POST /api/crm/post-device/mqtt/sync-users`, message-processor recreates `passwd` and `acl` in `DATA_DIR/mosquitto/config/`. Mosquitto reloads files without restart.

Types: `mode`/`state`, `card`, `statistics`, `finance`, `equipment`, `event`, `settings`, `prices`, `command`.

### Outbound (CRM → post)

1. Dashboard → nginx `/api/crm/post-device/…` → HTTP `message-processor:3022`.
2. User JWT validated via `/api/profile`.
3. Publish to `{dt_pref}/{serial}/set/prices` or `set/command`.
4. Prices and command metadata saved in `posts.settings`.
5. Outbound messages logged to telemetry.

Details: [MQTT — post control](mqtt.md#set-prices).

## Initialization (init-seed)

- **11** CRM endpoint groups, **52** endpoints
- RBAC: Administrator, Operator, Viewer, Service
- RUB currency, discount types 1–5, backup/archive/telegram settings
- Idempotent — safe to re-run

```bash
./scripts/run-init-seed.sh
```

## Data directory (`DATA_DIR`)

Default `./data` on the host (bind mount). Rebuild and `docker compose down` do not delete these files.

Absolute host paths are valid (`/var/lib/wash-pro-crm`, `/mnt/hdd/data`). The integrity wizard *(v1.1.19+)* warns only when `DATA_DIR` points inside the container `/deploy` mount.

| Path | Data |
|------|------|
| `mongodb/` | CRM MongoDB |
| `backups/` | Backup files |
| `mosquitto/data/` | MQTT persistence |
| `mosquitto/config/` | MQTT passwd, ACL, mosquitto.conf |
| `pyorchestrator/` | PostgreSQL, Redis, MinIO, runtime *(opt.)* |

Details: [data/README.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/data/README.md).

## Dynamic API Platform (vendored v1.5.13)

Vendored copy of [Dynamic API Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform) with WASH patches.

| In WASH | Upstream-only |
|---------|---------------|
| Runtime engine for `/api/crm/*` | K8s / MongoDB replica set deploy |
| Panel `:8080` (embedded build) | Standalone in-app updater |
| Update: `./scripts/update-dynamic-api.sh` | `npm run k8s:deploy` |

In-app updater is **disabled**: `UPDATE_EXECUTOR_ENABLED=false`.

## MongoDB indexes (v1.1.48+)

Dynamic API syncs Mongoose indexes in the **background** after startup (`scheduleDatabaseIndexSync`) — does not block healthcheck during CRM auto-update.

Telemetry (`endpoint_data`) compound indexes for fast filtered lists:

| Index fields | Use |
|--------------|-----|
| `resourcePath`, `data.postSerial`, `data.receivedAt` | Post telemetry history |
| `resourcePath`, `data.postSerial`, `data.messageType`, `data.receivedAt` | Filtered by message type |
| `resourcePath`, `data.postId`, `data.lastMessageAt` | Post states lookup |

Post detail history and large MQTT logs use **`count=false`** on list API where total count is skipped for speed; «Load more» uses page size instead.

## PyOrchestrator (vendored v0.1.13)

Vendored copy of [PyOrchestrator](https://github.com/PyOrchestrator/PyOrchestrator).

Default in `.env.example`: `PYORCHESTRATOR_ENABLED=true`, but the stack starts only if the variable is `true` in **your** `.env` and `./scripts/start.sh` attaches the overlay.

Update:

```bash
./scripts/update-pyorchestrator.sh
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build
```
