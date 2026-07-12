---
layout: default
title: Database schema
description: CRM endpoints and MongoDB collections
---

Data is stored in **MongoDB** via [Dynamic API Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform) **v1.5.13**.

User and group management: `/api/users`, `/api/groups` (management API) — UI in Dashboard → System or panel `:8080`.

## Dynamic API system collections

| Collection | Purpose |
|------------|---------|
| `users` | Dashboard users (`telegramUserId` — Telegram binding for bot) |
| `groups` | RBAC groups (Administrator, Operator, Viewer, Service) |
| `endpoints` | CRM API endpoint definitions |
| `endpointdatas` | All CRM business data |
| `logs` | Audit and system logs |
| `systemsettings` | Platform settings |

## Endpoint groups (Dynamic API Panel)

| Group | Endpoints |
|-------|-----------|
| Car washes | `/api/crm/washes` |
| Posts | `/api/crm/posts` |
| State and SCADA | `/api/crm/post-states` |
| Client cards | `/api/crm/cards` |
| Statistics | `/api/crm/usage-stats`, `/api/crm/finance-stats` |
| Currencies | `/api/crm/currencies` |
| Discount types | `/api/crm/discount-types` |
| Settings | `/api/crm/settings` |
| Notifications | `/api/crm/notifications` |
| Backup | `/api/crm/backups`, `/api/crm/archive-logs` |
| Telemetry | `/api/crm/telemetry` |

Total **52** CRM endpoint definitions (CRUD + lists). `init-seed` creates and updates them idempotently.

## CRM endpoints (data in `endpointdatas`)

| Resource | Path | Main fields |
|----------|------|-------------|
| Car washes | `/api/crm/washes` | name, description, address, registeredAt, cloudEnabled |
| Posts | `/api/crm/posts` | washId, postNumber, name, serialNumber, **settings** (see below) |
| Post states | `/api/crm/post-states` | postId, washId, mode, modeName, modeNumber, freePause, paidPause, balance, discount, modeTime, equipmentState, lastMessageAt, connected |
| Cards | `/api/crm/cards` | cardNumber, cardType (`regular`\|`service`\|`unlimited`\|`collection`), balance, discount, discountType (number 1–5), status (`success`\|`rejected`), washId, postId, createdAt, validFrom, validUntil |
| Usage statistics | `/api/crm/usage-stats` | washId, postId, period (`before_collection`\|`after_collection`), category (`regular`\|`service`\|`unlimited`), launchCount, usageTime, avgWashTime, clientCount, recordedAt |
| Finances | `/api/crm/finance-stats` | washId, postId, period, cash, cashless, discountOps, totalRevenue, avgCheck, recordedAt |
| Currencies | `/api/crm/currencies` | code, name, symbol, isDefault |
| Discount types | `/api/crm/discount-types` | number (1–5), name |
| Settings | `/api/crm/settings` | key (`backup`/`archive`/`telegram`/`notifications`/`branding`/…), value (JSON) |
| Notifications | `/api/crm/notifications` | type, severity, message, read, channels, washId, postId, createdAt |
| Backups | `/api/crm/backups` | filename, size, type (`manual`\|`auto`), status (`completed`\|`failed`\|`in_progress`), createdAt, error |
| Archive | `/api/crm/archive-logs` | action, recordsAffected, policyDays, groupKey |
| Telemetry | `/api/crm/telemetry` | washSerial, postSerial, messageType, payload, receivedAt |

### Default discount type reference

| # | Name |
|---|------|
| 1 | Taxi card |
| 2 | Regular customer |
| 3 | Corporate customer |
| 4 | Employee |
| 5 | Promotion |

In cards, `discountType` stores the number (`"1"` … `"5"`); Dashboard shows the name from reference.

### `posts.settings` field (JSON)

| Key | Description |
|-----|-------------|
| `firmwareVersion` | Firmware version (from device / manual) |
| `warrantyUntil` | Warranty end date |
| `maintenance` | Maintenance notes |
| `features` | Post capabilities description |
| `mqttPrefix` | MQTT prefix (`dt_pref`), default `washpro` |
| `mqttLogin` | MQTT login for post panel (default = `serialNumber`) |
| `mqttPassword` | MQTT password for post panel |
| `modePrices` | Mode prices: `{ "0": 50, "1": 80, … }` (rubles) |
| `pricesUpdatedAt` | Last price save time from CRM |
| `pricesSyncedAt` | Last price sync time from device |
| `lastCommand` | Last command (`soft_reset`, `credit_balance`, …) |
| `lastCommandAt` | Last command time |

Price and command management: Dashboard → post → **Device settings** or [MQTT HTTP API](mqtt.md).

## Cascade delete

`DELETE /api/crm/posts/:id` deletes the post and related records: states, cards, usage and finance statistics, notifications, MQTT telemetry (by `postId` and `postSerial`). Operation logged in archive log (`action: delete`).

`DELETE /api/crm/washes/:id` deletes the car wash, **all site posts** and their data (cascade as post delete), plus site notifications.

## RBAC

| Role | Dynamic API group | Permissions |
|------|-------------------|-------------|
| Administrator | Administrator | Full access |
| Operator | Operator | view, create, update |
| Viewer | Viewer | view |
| Service | Service | view, create, update, delete, manage_api (internal services) |

Internal service account used by message-processor, backup, and pyorch-bridge (JWT for `GET /api/users/telegram/{id}/auth`).

### Telegram auth API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users/telegram/:telegramUserId/auth` | User permissions by Telegram ID (for bot) |

## Backup

Files: bind mount `DATA_DIR/backups` → `/backups` in `wash-backup` container.  
Format: `mongodump --archive --gzip` → `wash-pro-crm-{timestamp}.archive.gz`

When **full bundle** is enabled in CRM settings (`backup.fullBundle`, default `true` since v1.1.44):

- Additional file: `wash-pro-crm-{timestamp}-extras.tar.gz`
- Contents: `settings/crm-settings.json` (all `/api/crm/settings` rows) and `modules-data/{moduleId}/` (from `modules/installed/*/data/`)
- `wash-backup` mounts host `modules/` read-only at `/modules`

Restore today: MongoDB archive via `./scripts/restore.sh` or Dashboard → Backups. Extras archive is for manual recovery of settings and module data.

### `branding` setting (v1.1.44)

| Field | Description |
|-------|-------------|
| `productName` | Display name (sidebar, login, welcome) |
| `tagline` | Subtitle under product name |
| `logoUrl` | Optional image URL (empty = default icon) |
| `supportUrl` | Support/issues link |
| `docsUrl` | Documentation base URL |

## Migrations and seed

On `init-seed` start:

- creates endpoint groups and CRM endpoints;
- configures RBAC;
- adds default settings, RUB currency, discount types 1–5, **`setup.complete: false`** for setup wizard;
- idempotent — safe to re-run (`./scripts/run-init-seed.sh`).
