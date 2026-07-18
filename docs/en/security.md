---
layout: default
title: Security
description: Secure WASH PRO CRM deployments — RBAC roles, network exposure, secrets management, and production hardening recommendations.
---

## Principles

1. **Minimal attack surface** — externally exposed: Dashboard, Dynamic API, platform panels
2. **No direct MongoDB access** — only via API with JWT
3. **Isolated network** `wash-internal` for DB and queues
4. **RBAC** — Dynamic API groups + Admin sections in Dashboard

## CRM roles (init-seed)

| Group | Permissions | Dashboard |
|-------|-------------|-----------|
| **Administrator** | view, create, update, delete, manage_users, manage_api, view_logs | Full access + System (admin) |
| **Operator** | view, create, update | CRM without admin sections |
| **Viewer** | view | Read-only |
| **Service** | view (+ API for automation) | Internal services |

Dashboard admin sections (users, groups, backups, Telegram, logs…) require `manage_users` **or** `view_logs` in JWT.

Management: **Dashboard → Users / Groups & permissions** or **Dynamic API Panel → Users / Groups**.

## Secrets (must change)

- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CSRF_SECRET`
- `ADMIN_PASSWORD`, `SERVICE_PASSWORD`, `MQTT_PASSWORD`
- `PYORCH_JWT_SECRET`, `PYORCH_SECRET_MASTER_KEY`, `PYORCH_INTERNAL_API_KEY` *(if PyOrch)*

`.env` in `.gitignore`.

## CORS

```env
CORS_ORIGIN=http://localhost,http://localhost:3001,http://localhost:8080,https://crm.example.com
```

## pyorch-bridge and Telegram bots

- Available only via Dashboard nginx `/api/telegram-bots/`
- Validates CRM JWT + admin permissions
- Stores PyOrchestrator credentials in env (`PYORCH_DASHBOARD_*`)
- **Bot authorization** — by user CRM `telegramUserId` (`GET /api/users/telegram/{id}/auth`); permissions from RBAC groups
- Unknown Telegram IDs get only "Private bot" message without CRM data
- Bot template v2.7: token lock, deduplication, legacy PyOrchestrator script stop

See [Telegram bots](telegram.md).

## Post control (post-device API)

- Path `/api/crm/post-device/` proxied to `message-processor:3022` (not published as separate port)
- Valid user JWT required (validated via `/api/profile`)
- Command and price sending available to roles with **create** / **update** (Operator, Administrator)
- Any MQTT `set/command` publication runs without additional broker-level confirmation — restrict network and CRM accounts

## MQTT

Port **1883** open on all host interfaces — posts on local network connect to `<server-IP>:1883` with login/password from post card. Mosquitto passwd allows only **system** (CRM) and post accounts; anonymous access forbidden.

`system` password changed in **Settings → MQTT (CRM)**. On first deployment set `MQTT_PASSWORD` in `.env`. Do not assign posts logins `system`, `superadmin`, or `wash`.

**Post isolation:** on MQTT sync ACL is generated — each post only in topics `washpro/{serial}/#`. Serial spoofing in JSON does not affect others' statistics.

## Audit

Dashboard → **Logs** (Admin) and Dynamic API Panel → Audit Logs.

## Dynamic API Platform

Rate limiting, login lockout, Helmet, network access rules — see [upstream security](https://dynamic-api-platform.github.io/Dynamic-API-Platform/security/) and `dynamic-api/docs/`.

## PyOrchestrator

JWT, RBAC (Administrator/Developer/Operator/Viewer), encrypted script secrets — see [PyOrchestrator security](https://pyorchestrator.github.io/PyOrchestrator/security/).

## Backup

Files in `DATA_DIR/backups` (bind mount). Test `./scripts/restore.sh` on staging.
