---
layout: default
title: Архитектура
description: Компоненты и потоки данных WASH PRO CRM
---

## Общая схема

```
Контроллеры постов
       │
       ▼
   RabbitMQ  (wash.exchange / wash.telemetry)
       │
       ▼
 Message Processor ──► Dynamic API ──► MongoDB
                            ▲
Dashboard (React) ──────────┤ nginx /api proxy
                            │
         pyorch-bridge ─────┤ (Telegram, Admin)
              ▲             │
              │             │
       PyOrchestrator ──────┘ (опц.)
              │
    backup / service account
```

## Сервисы Docker Compose

### Основной стек (`docker-compose.yml`)

| Сервис | Контейнер | Назначение | Внешний доступ |
|--------|-----------|------------|----------------|
| `mongodb` | wash-mongodb | База CRM (Dynamic API) | ❌ |
| `dynamic-api` | wash-dynamic-api | REST API | ✅ `:3001` |
| `dynamic-api-panel` | wash-dynamic-api-panel | Панель Dynamic API | ✅ `:8080` |
| `dashboard` | wash-dashboard | CRM Dashboard | ✅ `:80` |
| `init-seed` | wash-init-seed | Одноразовая инициализация CRM | ❌ |
| `rabbitmq` | wash-rabbitmq | Очередь телеметрии | ❌* |
| `rabbitmq-init` | wash-rabbitmq-init | Создание пользователя RabbitMQ | ❌ |
| `message-processor` | wash-message-processor | RabbitMQ → API | ❌ |
| `backup` | wash-backup | mongodump + HTTP файлов | ❌ |

\* Порт `:5672` — через `docker-compose.controllers.yml` (`RABBITMQ_EXTERNAL_PORT`).

### Опциональные сервисы

| Сервис | Условие | Назначение |
|--------|---------|------------|
| `redis` | `REDIS_ENABLED=true` + `docker-compose.redis.yml` | Кеш (profile `redis`) |
| **PyOrchestrator stack** | `PYORCHESTRATOR_ENABLED=true` | См. таблицу ниже |

### PyOrchestrator (`docker-compose.pyorchestrator.yml`)

| Сервис | Внешний доступ | Назначение |
|--------|----------------|------------|
| `pyorch-backend` | ✅ `:8000` | FastAPI |
| `pyorchestrator-panel` | ✅ `:8090` | Control Plane UI |
| `pyorch-mcp` | ✅ `:8010` | MCP для AI-агентов |
| `pyorch-bridge` | ❌ (через Dashboard) | Telegram-боты CRM |
| `pyorch-runtime` | ❌ | Python sandbox |
| `pyorch-scheduler` | ❌ | Расписания |
| `pyorch-postgres` | ❌ | Метаданные |
| `pyorch-redis` | ❌ | Очередь jobs |
| `pyorch-minio` | ❌ | Workspace |
| `pyorch-prometheus/grafana/loki/promtail` | профиль `pyorch-observability` | Метрики и логи |

Подробнее: [Встроенные сервисы](embedded-services.md).

## Сети Docker

| Сеть | Тип | Назначение |
|------|-----|------------|
| `wash-internal` | internal | MongoDB, RabbitMQ, bridge, runtime, backup |
| `wash-external` | bridge | Dashboard, API, панели |

MongoDB и RabbitMQ **не публикуются** наружу по умолчанию.

## Поток телеметрии

1. Контроллер публикует JSON в `wash.exchange`, routing key `telemetry.#`.
2. `message-processor` читает `wash.telemetry`.
3. По `postSerial` находится пост в `/api/crm/posts`.
4. Данные пишутся в CRM endpoints (`post-states`, `cards`, статистика…).
5. Ошибки → DLQ `wash.dlq`.

Типы сообщений: `mode`/`state`, `card`, `statistics`, `finance`, `equipment`, `event`, `settings`.

## Инициализация (init-seed)

- **11** CRM endpoint groups, **52** endpoints
- RBAC: Administrator, Operator, Viewer, Service
- Валюта RUB, типы скидок 1–5, настройки backup/archive/telegram
- Идемпотентен — безопасен для повторного запуска

```bash
./scripts/run-init-seed.sh
```

## Volumes

| Volume | Данные |
|--------|--------|
| `wash_mongodb_data` | MongoDB CRM |
| `wash_backup_data` | Файлы бэкапов |
| `wash_rabbitmq_data` | RabbitMQ |
| `wash_pyorch_*` | PostgreSQL, Redis, MinIO PyOrchestrator *(опц.)* |

## Dynamic API Platform (vendored v1.5.13)

Vendored-копия [Dynamic API Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform) с патчами WASH.

| В WASH | Upstream-only |
|--------|---------------|
| Runtime engine для `/api/crm/*` | K8s / MongoDB replica set deploy |
| Панель `:8080` (embedded build) | Standalone in-app updater |
| Обновление: `./scripts/update-dynamic-api.sh` | `npm run k8s:deploy` |

In-app updater **отключён**: `UPDATE_EXECUTOR_ENABLED=false`.

## PyOrchestrator (vendored v0.1.10)

Vendored-копия [PyOrchestrator](https://github.com/PyOrchestrator/PyOrchestrator).

По умолчанию в `.env.example`: `PYORCHESTRATOR_ENABLED=true`, но стек стартует только если переменная `true` в **вашем** `.env` и `./scripts/start.sh` подключает overlay.

Обновление:

```bash
./scripts/update-pyorchestrator.sh
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build
```
