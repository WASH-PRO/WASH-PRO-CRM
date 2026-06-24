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
              Telegram Bot / Backup
```

## Сервисы Docker Compose

| Сервис | Контейнер | Назначение | Внешний доступ |
|--------|-----------|------------|----------------|
| `mongodb` | wash-mongodb | База данных | ❌ |
| `dynamic-api` | wash-dynamic-api | REST API | ✅ порт 3001 |
| `dynamic-api-panel` | wash-dynamic-api-panel | Панель управления API | ✅ порт 8080 |
| `dashboard` | wash-dashboard | CRM интерфейс | ✅ порт 80 |
| `rabbitmq` | wash-rabbitmq | Очередь телеметрии | ❌* |
| `message-processor` | wash-message-processor | Обработка сообщений | ❌ |
| `init-seed` | wash-init-seed | Одноразовая инициализация | ❌ |
| `backup` | wash-backup | Резервное копирование | ❌ |
| `telegram-bot` | wash-telegram-bot | Telegram-бот | ❌ |
| `redis` | wash-redis | Кеш (опционально) | ❌ |

\* Для подключения контроллеров снаружи используйте `docker-compose.controllers.yml`.

## Сети Docker

| Сеть | Тип | Назначение |
|------|-----|------------|
| `wash-internal` | internal | MongoDB, RabbitMQ, внутренние сервисы |
| `wash-external` | bridge | Dashboard, Dynamic API — доступ с хоста |

MongoDB и RabbitMQ **не публикуются** наружу по умолчанию. Все CRM-запросы идут через Dynamic API с JWT и RBAC.

## Поток телеметрии

1. Контроллер поста публикует JSON в exchange `wash.exchange` с routing key `telemetry.#`.
2. `message-processor` читает очередь `wash.telemetry`.
3. По `postSerial` находится пост в `/api/crm/posts`.
4. Данные записываются в соответствующие CRM endpoints (`post-states`, `cards`, статистика и т.д.).
5. При ошибке сообщение попадает в DLQ `wash.dlq`.

## Инициализация (init-seed)

При старте `init-seed`:

- Создаёт CRM endpoint groups и 37 endpoints
- Настраивает RBAC (Administrator, Operator, Viewer, Service)
- Добавляет настройки по умолчанию (backup, archive, telegram, notifications)
- Идемпотентен — безопасно запускать повторно

## Volumes

| Volume | Данные |
|--------|--------|
| `wash_mongodb_data` | База MongoDB |
| `wash_backup_data` | Файлы резервных копий |
| `wash_rabbitmq_data` | Очереди RabbitMQ |

## Зависимость от Dynamic API

Проект включает `dynamic-api/` — vendored-копия [Dynamic API Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform) **v1.5.6** с локальными патчами (CORS, обработка 502, Safari email).

### Возможности платформы (актуально для панели `:8080`)

| Версия | Основное |
|--------|----------|
| **1.5.x** | In-app проверка обновлений (UI), авто-обновление в standalone Docker; в WASH — через скрипт (см. ниже) |
| **1.4.x** | KPI автоматизации на Dashboard, audit logs с `source`, K8s / replica set манифесты |
| **1.3.x** | Cron, Webhooks, MCP, API Keys, версионирование API |
| **1.2.x** | OpenAPI, экспорт/импорт проекта, JS handlers |
| **1.1.x** | Database Explorer, references, Network Access |

Полный changelog: `dynamic-api/CHANGELOG.md` и [релизы на GitHub](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/releases).

### Обновление в WASH-PRO-CRM

Встроенный **Update executor** отключён (`UPDATE_EXECUTOR_ENABLED=false`) — платформа встроена в репозиторий, а не развёрнута как отдельный clone. Обновление:

```bash
./scripts/update-dynamic-api.sh
docker compose up -d --build dynamic-api dynamic-api-panel
./scripts/run-init-seed.sh   # при изменениях схемы API
```

Патчи: `patches/dynamic-api-wash.patch`. Сборка backend: `context: ./dynamic-api`, `dockerfile: backend/Dockerfile` (нужны `scripts/` для updater).
