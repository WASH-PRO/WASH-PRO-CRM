---
layout: default
title: Конфигурация
description: Переменные окружения .env
---

Все настройки задаются в `.env` (шаблон — `.env.example`).

## Каталог данных

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `DATA_DIR` | `./data` | Каталог на **хосте** для MongoDB, MQTT, бэкапов, PyOrchestrator и кэша `update-bridge`. Bind mount — не удаляется при `docker compose down` / `--build` |
| `WASH_HOST_PROJECT_ROOT` | *(авто)* | Абсолютный путь к проекту на хосте; нужен `update-bridge` для compose и автообновления |
| `WASH_BUILD_ROOT` | *(авто)* | Путь build context внутри контейнера (`/deploy`); обычно не задаётся вручную |

**Production:** допустимы любые пути на хосте вне mount контейнера `/deploy`, например:

```env
DATA_DIR=/var/lib/wash-pro-crm
# или отдельный диск:
DATA_DIR=/mnt/hdd/data
```

Мастер **Целостность и исправление** *(v1.1.19+)* предупреждает только если `DATA_DIR` ошибочно указывает **внутрь** `/deploy`. См. [data/README.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/data/README.md).

## Dashboard

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `DASHBOARD_PORT` | `80` | Порт CRM Dashboard |
| `APP_VERSION` | `1.1.32` | Версия приложения |

## Dynamic API

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `DYNAMIC_API_PORT` | `3001` | Порт REST API |
| `DYNAMIC_API_PANEL_PORT` | `8080` | Порт панели Dynamic API |
| `CORS_ORIGIN` | localhost URLs | Origin через запятую |
| `JWT_SECRET` | — | Access token (≥32 символов) |
| `JWT_REFRESH_SECRET` | — | Refresh token |
| `CSRF_SECRET` | — | CSRF |
| `ADMIN_LOGIN` | `admin` | Логин администратора |
| `ADMIN_EMAIL` | `admin@wash-pro-crm.local` | Email |
| `ADMIN_PASSWORD` | `Admin123!` | Пароль |
| `UPDATE_EXECUTOR_ENABLED` | `true` | Автообновление через `update-bridge` (GitHub → Docker) |
| `CRM_GITHUB_REPO` | `WASH-PRO/WASH-PRO-CRM` | Репозиторий CRM для проверки релизов |
| `DYNAMIC_API_GITHUB_REPO` | `Dynamic-API-Platform/Dynamic-API-Platform` | Upstream Dynamic API |
| `PYORCHESTRATOR_GITHUB_REPO` | `PyOrchestrator/PyOrchestrator` | Upstream PyOrchestrator |
| `# GITHUB_TOKEN` | — | **Опционально.** Release notes и лимит 5000/ч; без токена версии проверяются через `git ls-remote` *(v1.1.18+)* |
| `# DYNAMIC_API_VERSION` | из package.json | Принудительная версия (обычно не нужна) |

Актуальная vendored-версия: **v1.5.13** (`dynamic-api/backend/package.json`).

## Service account

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `SERVICE_LOGIN` | `service` | Аккаунт для message-processor, backup, pyorch-bridge |
| `SERVICE_PASSWORD` | — | Пароль |

## MQTT

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `MQTT_USER` | `system` | Учётная запись CRM (message-processor); не назначайте постам |
| `MQTT_PASSWORD` | `washpro` в `.env.example` | Пароль при первом запуске; далее — **Настройки → MQTT (CRM)** |
| `MQTT_EXTERNAL_PORT` | `1883` | Порт MQTT на хосте (доступен из LAN) |
| `MQTT_BIND` | пусто | `127.0.0.1` — только localhost, без LAN |
| `MQTT_DEVICE_PREFIX` | `washpro` | Префикс топика `dt_pref` для исходящих `set/*` |
| `MQTT_TOPICS` | — | Список топиков подписки processor (через запятую) |
| `MQTT_DEVICE_TOPIC` | `+/+/#` | Нативный протокол WASH-PRO |

### message-processor (внутренний HTTP)

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `PROCESSOR_HTTP_PORT` | `3022` | HTTP API цен и команд (прокси: `/api/crm/post-device/`) |

## Redis (опционально)

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `REDIS_ENABLED` | `false` | + `docker-compose.redis.yml` |
| `REDIS_PASSWORD` | пусто | Пароль |

## Telegram (PyOrchestrator)

Telegram-боты управляются через **Dashboard → Telegram** и `pyorch-bridge` → PyOrchestrator. Доступ сотрудников — через **Пользователи → Telegram user_id** и группы RBAC (не через список admin ID в настройках бота). См. [Telegram-боты](telegram.md) и [Встроенные сервисы](embedded-services.md).

## Backup

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `BACKUP_RETENTION_COUNT` | `7` | Хранить N копий |
| `BACKUP_CRON` | `0 2 * * *` | Расписание mongodump |

## PyOrchestrator (опционально)

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `PYORCHESTRATOR_ENABLED` | `true` в `.env.example` | Стек включается только при `true` в вашем `.env` |
| `PYORCHESTRATOR_VERSION` | `0.1.13` | Vendored-версия |
| `PYORCH_BACKEND_PORT` | `8000` | FastAPI |
| `PYORCH_PANEL_PORT` | `8090` | Control Plane UI |
| `PYORCH_MCP_PORT` | `8010` | MCP server |
| `PYORCH_CORS_ORIGINS` | localhost | CORS |
| `PYORCH_JWT_SECRET` | — | JWT PyOrchestrator |
| `PYORCH_SECRET_MASTER_KEY` | — | Шифрование secrets |
| `PYORCH_INTERNAL_API_KEY` | — | runtime ↔ backend |
| `PYORCH_POSTGRES_*` | см. example | PostgreSQL |
| `PYORCH_MINIO_*` | см. example | MinIO workspace |
| `PYORCH_DASHBOARD_EMAIL` | `admin@pyorchestrator.local` | Логин bridge → PyOrch |
| `PYORCH_DASHBOARD_PASSWORD` | `admin` | Пароль bridge |
| `PYORCH_MCP_EMAIL` / `PYORCH_MCP_PASSWORD` | admin@… / admin | MCP auth |
| `PYORCH_OBSERVABILITY_ENABLED` | `false` | Prometheus/Grafana/Loki; при `true` — блок Observability на Dashboard |
| `PYORCH_GRAFANA_PUBLIC_URL` | пусто | Ссылка на Grafana (auto при observability) |
| `MINIO_CONSOLE_ENABLED` | `false` в WASH | Скрыть ссылку на веб-консоль MinIO в System |

## Пример production `.env`

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

## Локальные переопределения на сервере (v1.1.18+)

Для правок, специфичных для конкретного хоста (CPU без AVX → MongoDB 4.4, патчи vendored-кода), **не изменяйте** отслеживаемые файлы git — иначе автообновление не сможет выполнить `git pull`.

| Файл | Назначение |
|------|------------|
| `docker-compose.override.yml` | Переопределения сервисов (пример: `docker-compose.override.yml.example`); подключается `scripts/start.sh` и апдейтер через `scripts/compose-files.sh` |
| `local/apply-server-patches.sh` | Скрипт после pull (пример: `local/apply-server-patches.sh.example`); вызывается `update-bridge` |

Оба файла **не коммитятся** — храните только на сервере.

## Обновления ПО (Dashboard)

- **Настройки → Обновления ПО** — CRM, Dynamic API, PyOrchestrator через `update-bridge`
- **«Проверить сейчас»** — принудительный опрос GitHub (или git fallback без токена)
- Загрузка страницы и опрос прогресса job — из кэша `DATA_DIR/update-bridge/state.json`
- Баннер обновления — в шапке Dashboard (администратор)

См. [Устранение неполадок](troubleshooting.md).
