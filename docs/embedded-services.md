---
layout: default
title: Встроенные сервисы
description: Dynamic API Platform и PyOrchestrator в составе WASH PRO CRM
---

WASH PRO CRM включает две платформы как **vendored-копии** с отдельными панелями управления. Основной интерфейс для операторов — **Dashboard** (`:80`). Платформы доступны администраторам через блок **Resources** в сайдбаре и по прямым URL.

| Сервис | Vendored-версия | Панель | API |
|--------|-----------------|--------|-----|
| **Dynamic API Platform** | v1.5.13 (`dynamic-api/backend/package.json`) | http://localhost:8080 | http://localhost:3001 |
| **PyOrchestrator** *(опц.)* | v0.1.10 (`pyorchestrator/CHANGELOG.md`) | http://localhost:8090 | http://localhost:8000 |

> Полная upstream-документация: [Dynamic API Platform](https://dynamic-api-platform.github.io/Dynamic-API-Platform/) · [PyOrchestrator](https://pyorchestrator.github.io/PyOrchestrator/)

---

## Кто что использует

| Возможность | Operator / Viewer | Administrator (Dashboard) | Панель `:8080` | Панель `:8090` |
|-------------|-------------------|---------------------------|----------------|----------------|
| CRM/SCADA данные | ✅ Dashboard | ✅ Dashboard | — | — |
| Пользователи и группы RBAC | ❌ | ✅ Dashboard → Система | ✅ Users / Groups | ✅ Users / Groups |
| Endpoints, схемы, cron, webhooks | ❌ | 🔗 ссылка Resources | ✅ | — |
| Telegram-боты (несколько) | ❌ | ✅ Dashboard → Telegram *(PyOrch)* | — | ✅ Scripts (полный редактор) |
| Python-скрипты, расписания | ❌ | 🔗 ссылка Resources | — | ✅ |
| MongoDB backups CRM | ❌ | ✅ Dashboard → Резервные копии | — | — |
| Аудит-логи | ❌ | ✅ Dashboard → Логи | ✅ Audit Logs | — |

---

## Dynamic API Platform

### Роль в WASH PRO CRM

- **Единственный backend** для CRM: все данные `/api/crm/*` хранятся в MongoDB через runtime engine.
- **JWT + RBAC** для Dashboard и внутренних серvice-аккаунтов (`message-processor`, `backup`, `pyorch-bridge`).
- **`init-seed`** создаёт 11 групп endpoints и 52 CRM-маршрута при первом запуске.

Dashboard проксирует `/api/` → `dynamic-api:3001` (nginx в контейнере `dashboard`).

### Подтверждённые возможности платформы (v1.5.13)

Доступны в панели **Dynamic API** (`:8080`), если не указано иное:

| Категория | Возможности |
|-----------|-------------|
| **Dynamic API Engine** | REST endpoints GET/POST/PUT/PATCH/DELETE через UI; **маршруты активны сразу после сохранения**; JSON-схема; path params; `reference` + `?populate=`; опциональный TTL записей; смена path с миграцией данных; встроенный API tester |
| **Автоматизация** | Cron (javascript / http / endpoint); исходящие webhooks (HMAC); API keys; MCP server (`POST /api/mcp`); JavaScript handlers `async function handler(req, db)`; версионирование `/api/v1/...` |
| **Безопасность** | JWT + refresh; RBAC (5 системных групп + custom); network access (domains/IP); rate limiting; login lockout; audit logs; Helmet, CORS, CSRF |
| **Admin Panel** | Dashboard KPI; endpoints & groups; **API Schema** (ER-диаграмма); **Database Explorer**; users/groups; audit logs; 4 темы UI; OpenAPI/Swagger; export/import проекта |
| **DevOps (upstream)** | Standalone Docker, MongoDB replica set, Kubernetes — **не используются в стандартном WASH compose**, но манифесты есть в `dynamic-api/` |

### Что отключено или ограничено в WASH

| Функция | Статус в WASH |
|---------|---------------|
| **In-app Software Updates** (GitHub Releases) | ❌ `UPDATE_EXECUTOR_ENABLED=false` — обновление через `./scripts/update-dynamic-api.sh` |
| **Standalone MongoDB stack** Dynamic API | ❌ используется общий `wash-mongodb` |
| **Прямой доступ операторов к endpoint-builder** | ❌ только через `:8080` (admin) |

### Обновление Dynamic API в WASH

```bash
./scripts/update-dynamic-api.sh
docker compose up -d --build dynamic-api dynamic-api-panel
./scripts/run-init-seed.sh   # при изменениях CRM-схемы
```

Патчи WASH: `patches/dynamic-api-wash.patch`. Embedded UI: `patches/wash-embedded/`.

---

## PyOrchestrator

### Роль в WASH PRO CRM

PyOrchestrator **опционален**. Включается, если в `.env`:

```env
PYORCHESTRATOR_ENABLED=true
```

Скрипт `./scripts/start.sh` подключает `docker-compose.pyorchestrator.yml`.

| Компонент WASH | Назначение |
|----------------|------------|
| `pyorch-backend` | FastAPI REST + WebSocket |
| `pyorchestrator-panel` | React Control Plane (`:8090`) |
| `pyorch-runtime` | Изолированные Python subprocess (без контейнера на скрипт) |
| `pyorch-scheduler` | Cron / interval / webhook triggers |
| `pyorch-bridge` | HTTP-мост CRM ↔ PyOrchestrator для Telegram-ботов |
| `pyorch-postgres`, `pyorch-redis`, `pyorch-minio` | Метаданные, очередь, workspace |
| `pyorch-mcp` | MCP для AI-агентов (`:8010`, опционально) |
| `pyorch-prometheus`, `pyorch-grafana`, `pyorch-loki`, `pyorch-promtail` | Observability (профиль `pyorch-observability`, выкл. по умолчанию) |

### Подтверждённые возможности PyOrchestrator (v0.1.10)

Доступны в панели **PyOrchestrator** (`:8090`):

| Категория | Возможности |
|-----------|-------------|
| **Scripts** | CRUD; multi-file workspace (Monaco); группы; тип `bot`; secrets (AES-GCM); hot reload через Redis |
| **Runs** | Запуск/остановка; очередь; история; live logs через WebSocket `ws://.../ws/runs/{run_id}` |
| **Schedules** | Cron и interval |
| **Webhooks** | Inbound HTTP `POST /hooks/{token}` |
| **Backups** | Create/restore в UI |
| **Dashboard** | KPI и timeseries в Control Plane |
| **Security** | JWT; роли Administrator / Developer / Operator / Viewer |
| **MCP** | 24 tools на `:8010/mcp` (scripts, runs, schedules, secrets…) |
| **Observability** | Prometheus + Grafana + Loki *(профиль `pyorch-observability`)* |

### Что **не** реализовано (не заявляйте как готовое)

| Функция | Статус |
|---------|--------|
| In-app OTA updates в панели `:8090` | ❌ отключено в WASH (`UPDATE_EXECUTOR_ENABLED=false`) — `./scripts/update-pyorchestrator.sh` |
| OTA updates (`GitHubUpdateProvider`) upstream | Stub / backlog |
| Audit logs UI | Таблица есть; UI в roadmap |
| Production multi-runtime scaling | Только в upstream `docker-compose.prod.yml`, не в WASH overlay |

### Интеграция с Dashboard: Telegram-боты

При включённом PyOrchestrator администратор управляет ботами в **Dashboard → Система → Telegram** без обязательного входа в панель `:8090`. Полная документация: [Telegram-боты](telegram.md).

```
Dashboard  →  /api/telegram-bots/*  →  pyorch-bridge  →  PyOrchestrator API
                                                      ↓
                              Dynamic API  GET /api/users/telegram/{id}/auth
```

| Endpoint bridge | Действие |
|-----------------|----------|
| `GET /health` | Проверка доступности PyOrchestrator |
| `GET /bots` | Список WASH Telegram-ботов |
| `POST /bots` | Создать бота (script_type `bot` + secrets) |
| `PUT/DELETE /bots/:id` | Изменить / удалить |
| `POST /bots/:id/start\|stop` | Запуск / остановка |
| `GET /bots/:id/link` | QR-код и ссылка `t.me/...` |
| `POST /bots/refresh` | Синхронизация шаблонов + restart всех ботов |

**Типы ботов:** Управление (полный RBAC), Сервисный (мониторинг + команды постов), **Информационный** (публичный: новости, цены, занятость, акции из CRM).

**Информационный бот (v1.8):** контент из **Dashboard → Информация**; рассылка подписчикам в **личных чатах**; изображения отправляются файлом.

**Изоляция (v1.1.11):** боты отвечают только в личных сообщениях — каждый пользователь не видит чужих диалогов.

**Доступ сотрудников:** поле **Telegram user_id** в **Dashboard → Пользователи** + группа RBAC. Viewer — только отчёты; Operator — создание объектов и команды постов; Administrator — полный доступ. Поле admin Telegram IDs в форме бота **удалено** (с v1.1.0).

Учётные данные bridge → PyOrchestrator: `PYORCH_DASHBOARD_EMAIL` / `PYORCH_DASHBOARD_PASSWORD` (по умолчанию `admin@pyorchestrator.local` / `admin`).

### Обновление PyOrchestrator в WASH

```bash
./scripts/update-pyorchestrator.sh
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build pyorch-backend pyorchestrator-panel pyorch-bridge
```

Патчи WASH: `patches/pyorchestrator-wash/`. Embedded panel: `services/pyorchestrator-panel/Dockerfile`, `VITE_WASH_EMBEDDED=true`.

---

## Блок Resources в Dashboard

Внизу сайдбара Dashboard:

| Элемент | Описание |
|---------|----------|
| **Dynamic API** | Ссылка на `:8080` + индикатор online/offline (`GET /api/health`) |
| **PyOrchestrator** | Ссылка на `:8090` + индикатор (`GET /api/telegram-bots/health` → bridge → PyOrch) |
| **Документация** | GitHub Pages |
| **GitHub** | Репозиторий проекта |

---

## Учётные данные по умолчанию

| Интерфейс | Логин | Пароль | Переменные `.env` |
|-----------|-------|--------|-------------------|
| Dashboard + Dynamic API Panel | `admin` | `Admin123!` | `ADMIN_LOGIN`, `ADMIN_PASSWORD` |
| PyOrchestrator Panel | `admin@pyorchestrator.local` | `admin` | создаётся при seed PyOrch |
| Service account (internal) | `service` | `ServiceInternal123!` | `SERVICE_LOGIN`, `SERVICE_PASSWORD` |

Смените все пароли и секреты перед production.
