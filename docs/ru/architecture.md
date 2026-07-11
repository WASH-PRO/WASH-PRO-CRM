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
   Mosquitto  (wash/telemetry/#  и  +/+/#)
       │
       ▼
 Message Processor ◄── HTTP :3022 (команды/цены из Dashboard)
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
| `mosquitto` | wash-mosquitto | MQTT-брокер телеметрии | ✅ `:1883` (LAN) |
| `mosquitto-init` | wash-mosquitto-init | `system` + шаблон ACL | ❌ |
| `message-processor` | wash-message-processor | MQTT ↔ API, sync passwd/ACL, HTTP `:3022` | ❌ |
| `backup` | wash-backup | mongodump + HTTP файлов | ❌ |

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
| `wash-internal` | internal | MongoDB, message-processor, backup (без доступа в интернет) |
| `wash-external` | bridge | Dashboard, API, **Mosquitto** (порт 1883 для LAN) |

MongoDB **не публикуется** наружу. MQTT (`:1883`) доступен из локальной сети для контроллеров постов.

## Поток телеметрии

### Входящие (пост → CRM)

1. Контроллер публикует JSON в топик `{dt_pref}/{serial}/state/{suffix}` (нативный протокол) или `wash/telemetry/{тип}` (legacy), QoS 1, с **логином поста** из CRM.
2. Mosquitto проверяет ACL: пост может писать только в топики **своего** `serialNumber`.
3. `message-processor` (как `system`) подписан на `wash/telemetry/#` и `+/+/#`.
4. Серийный номер для CRM берётся **из топика** (payload с чужим serial игнорируется).
5. По serial находится пост в `/api/crm/posts`.
6. Данные пишутся в CRM endpoints (`post-states`, `cards`, статистика…).
7. Каждое сообщение дублируется в журнал `/api/crm/telemetry`.
8. Ошибки обработки → DLQ `wash/dlq`.

**Синхронизация MQTT:** при сохранении поста или `POST /api/crm/post-device/mqtt/sync-users` message-processor пересоздаёт `passwd` и `acl` в `DATA_DIR/mosquitto/config/`. Mosquitto перезагружает файлы без рестарта.

Типы: `mode`/`state`, `card`, `statistics`, `finance`, `equipment`, `event`, `settings`, `prices`, `command`.

### Исходящие (CRM → пост)

1. Dashboard → nginx `/api/crm/post-device/…` → HTTP `message-processor:3022`.
2. Проверка JWT пользователя через `/api/profile`.
3. Публикация в `{dt_pref}/{serial}/set/prices` или `set/command`.
4. Цены и метаданные команд сохраняются в `posts.settings`.
5. Исходящие сообщения логируются в телеметрию.

Подробнее: [MQTT — управление постом](mqtt.md#set-prices).

## Инициализация (init-seed)

- **11** CRM endpoint groups, **52** endpoints
- RBAC: Administrator, Operator, Viewer, Service
- Валюта RUB, типы скидок 1–5, настройки backup/archive/telegram
- Идемпотентен — безопасен для повторного запуска

```bash
./scripts/run-init-seed.sh
```

## Каталог данных (`DATA_DIR`)

По умолчанию `./data` на хосте (bind mount). Пересборка и `docker compose down` не удаляют эти файлы.

Допустимы абсолютные пути на хосте (`/var/lib/wash-pro-crm`, `/mnt/hdd/data`). Мастер целостности *(v1.1.19+)* предупреждает только при `DATA_DIR` внутри mount контейнера `/deploy`.

| Путь | Данные |
|------|--------|
| `mongodb/` | MongoDB CRM |
| `backups/` | Файлы бэкапов |
| `mosquitto/data/` | MQTT persistence |
| `mosquitto/config/` | MQTT passwd, ACL, mosquitto.conf |
| `pyorchestrator/` | PostgreSQL, Redis, MinIO, runtime *(опц.)* |

Подробнее: [data/README.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/data/README.md).

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
