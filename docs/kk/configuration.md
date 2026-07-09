---
layout: default
title: Конфигурация
description: .env орта айнымалылары
---

Барлық баптаулар `.env` ішінде (үлгі — `.env.example`).

## Dashboard

| Айнымалы | Әдепкі | Сипаттама |
|----------|--------|----------|
| `DASHBOARD_PORT` | `80` | CRM Dashboard порты |
| `APP_VERSION` | `1.1.0` | Қосымша нұсқасы |

## Dynamic API

| Айнымалы | Әдепкі | Сипаттама |
|----------|--------|----------|
| `DYNAMIC_API_PORT` | `3001` | REST API порты |
| `DYNAMIC_API_PANEL_PORT` | `8080` | Dynamic API панель порты |
| `CORS_ORIGIN` | localhost URLs | Үтірмен бөлінген origin |
| `JWT_SECRET` | — | Access token (≥32 таңба) |
| `JWT_REFRESH_SECRET` | — | Refresh token |
| `CSRF_SECRET` | — | CSRF |
| `ADMIN_LOGIN` | `admin` | Әкімші логині |
| `ADMIN_EMAIL` | `admin@wash-pro-crm.local` | Email |
| `ADMIN_PASSWORD` | `Admin123!` | Пароль |
| `UPDATE_EXECUTOR_ENABLED` | `true` | `update-bridge` арқылы автожаңарту (GitHub → Docker) |
| `CRM_GITHUB_REPO` | `WASH-PRO/WASH-PRO-CRM` | Релиздерді тексеру үшін CRM репозиторийі |
| `DYNAMIC_API_GITHUB_REPO` | `Dynamic-API-Platform/Dynamic-API-Platform` | Upstream Dynamic API |
| `PYORCHESTRATOR_GITHUB_REPO` | `PyOrchestrator/PyOrchestrator` | Upstream PyOrchestrator |
| `# DYNAMIC_API_VERSION` | package.json-нан | Мәжбүрлі нұсқа (әдетте қажет емес) |

Ағымдағы vendored-нұсқа: **v1.5.13** (`dynamic-api/backend/package.json`).

## Service account

| Айнымалы | Әдепкі | Сипаттама |
|----------|--------|----------|
| `SERVICE_LOGIN` | `service` | message-processor, backup, pyorch-bridge есебі |
| `SERVICE_PASSWORD` | — | Пароль |

## MQTT

| Айнымалы | Әдепкі | Сипаттама |
|----------|--------|----------|
| `MQTT_USER` | `system` | CRM есебі (message-processor); посттарға тағайындамаңыз |
| `MQTT_PASSWORD` | `.env.example` ішінде `washpro` | Бірінші іске қосудағы пароль; кейін — **Баптаулар → MQTT (CRM)** |
| `MQTT_EXTERNAL_PORT` | `1883` | Хосттағы MQTT порты (LAN-нан қолжетімді) |
| `MQTT_BIND` | бос | `127.0.0.1` — тек localhost, LAN жоқ |
| `MQTT_DEVICE_PREFIX` | `washpro` | Шығыс `set/*` топиктерінің `dt_pref` префиксі |
| `MQTT_TOPICS` | — | Processor жазылу топиктері (үтірмен) |
| `MQTT_DEVICE_TOPIC` | `+/+/#` | WASH-PRO native протокол |

### message-processor (ішкі HTTP)

| Айнымалы | Әдепкі | Сипаттама |
|----------|--------|----------|
| `PROCESSOR_HTTP_PORT` | `3022` | Баға және командалар HTTP API (прокси: `/api/crm/post-device/`) |

## Redis (опционалды)

| Айнымалы | Әдепкі | Сипаттама |
|----------|--------|----------|
| `REDIS_ENABLED` | `false` | + `docker-compose.redis.yml` |
| `REDIS_PASSWORD` | бос | Пароль |

## Telegram (PyOrchestrator)

Telegram-боттар **Dashboard → Telegram** және `pyorch-bridge` → PyOrchestrator арқылы басқарылады. Қызметкерлердің қолжетімділігі — **Пайдаланушылар → Telegram user_id** және RBAC топтары (бот баптауларындағы admin ID тізімі емес). Қараңыз [Telegram-боттар](telegram.md) және [Кіріктірілген сервистер](embedded-services.md).

## Backup

| Айнымалы | Әдепкі | Сипаттама |
|----------|--------|----------|
| `BACKUP_RETENTION_COUNT` | `7` | N көшірмені сақтау |
| `BACKUP_CRON` | `0 2 * * *` | mongodump кестесі |

## PyOrchestrator (опционалды)

| Айнымалы | Әдепкі | Сипаттама |
|----------|--------|----------|
| `PYORCHESTRATOR_ENABLED` | `.env.example` ішінде `true` | Стек тек **сіздің** `.env` ішінде `true` болса қосылады |
| `PYORCHESTRATOR_VERSION` | `0.1.13` | Vendored-нұсқа |
| `PYORCH_BACKEND_PORT` | `8000` | FastAPI |
| `PYORCH_PANEL_PORT` | `8090` | Control Plane UI |
| `PYORCH_MCP_PORT` | `8010` | MCP server |
| `PYORCH_CORS_ORIGINS` | localhost | CORS |
| `PYORCH_JWT_SECRET` | — | PyOrchestrator JWT |
| `PYORCH_SECRET_MASTER_KEY` | — | Secrets шифрлеу |
| `PYORCH_INTERNAL_API_KEY` | — | runtime ↔ backend |
| `PYORCH_POSTGRES_*` | example қараңыз | PostgreSQL |
| `PYORCH_MINIO_*` | example қараңыз | MinIO workspace |
| `PYORCH_DASHBOARD_EMAIL` | `admin@pyorchestrator.local` | bridge → PyOrch логині |
| `PYORCH_DASHBOARD_PASSWORD` | `admin` | bridge парольі |
| `PYORCH_MCP_EMAIL` / `PYORCH_MCP_PASSWORD` | admin@… / admin | MCP auth |
| `PYORCH_OBSERVABILITY_ENABLED` | `false` | Prometheus/Grafana/Loki; `true` болса Dashboard-та Observability блогы |
| `PYORCH_GRAFANA_PUBLIC_URL` | бос | Grafana сілтемесі (observability кезінде auto) |
| `MINIO_CONSOLE_ENABLED` | WASH-та `false` | Dashboard System ішіндегі MinIO веб-консоль сілтемесін жасыру |

## Production `.env` мысалы

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
