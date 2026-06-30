---
layout: default
title: Архитектура
description: Топология сервисов, sandbox-модель, потоки данных и безопасность
---

## Концепция

PyOrchestrator — SCADA/CMS-платформа для создания, планирования, запуска и мониторинга тысяч изолированных Python-скриптов и ботов — всё внутри **фиксированного набора сервисов Docker Compose**. Пользовательские скрипты не получают отдельные контейнеры; они выполняются в sandbox внутри единого **движка runtime**.

Вдохновение по дизайну: SCADA (мониторинг/управление), Jenkins (CI-запуски), Home Assistant (автоматизации), n8n (воркфлоу), Airflow (планирование), Portainer (ops UI), Node-RED (события), GitLab CI (пайплайны).

---

## Топология сервисов

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Сеть Docker Compose                               │
│                                                                             │
│  ┌──────────┐    ┌──────────┐    ┌─────────────┐    ┌──────────────────┐   │
│  │ Frontend │───▶│ Backend  │───▶│ PostgreSQL  │    │ Redis            │   │
│  │ (React)  │◀───│ (FastAPI)│◀───│             │    │ кэш / pub-sub    │   │
│  └──────────┘    └────┬─────┘    └─────────────┘    └────────┬─────────┘   │
│                       │                                         │            │
│                       │ REST / WS                               │            │
│                       ▼                                         ▼            │
│              ┌────────────────┐    ┌──────────────┐    ┌──────────────┐     │
│              │ Движок runtime │◀──▶│  Планировщик │    │    MinIO     │     │
│              │ (sandbox)      │    │ (APScheduler)│    │ файлы / S3   │     │
│              └────────┬───────┘    └──────────────┘    └──────────────┘     │
│                       │ метрики / логи                                     │
│                       ▼                                                    │
│         ┌─────────────────────────────────────────────┐                    │
│         │ Prometheus │ Grafana │ Loki │ Promtail      │                    │
│         └─────────────────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Основные сервисы (обязательные)

| Сервис | Роль | Технологии |
|--------|------|------------|
| **backend** | REST API, WebSocket hub, RBAC, API секретов, координатор OTA | FastAPI, SQLAlchemy, Redis |
| **frontend** | Дашборд, редактор скриптов, UI мониторинга | React, TypeScript, Vite, Tailwind CSS |
| **runtime** | Пул процессов; изолированный Python sandbox на каждый запуск | Python, subprocess, venv, cgroups/rlimit |
| **scheduler** | Cron, интервалы, webhooks, цепочки событий; постановка задач в runtime | APScheduler, Redis |
| **postgres** | Метаданные, запуски, пользователи, расписания, аудит | PostgreSQL 16 |
| **redis** | Очередь задач, pub/sub, rate limits, кэш сессий | Redis 7 |
| **minio** | Рабочие области скриптов, ассеты, бэкапы, временные файлы | MinIO (S3-compatible) |

### Наблюдаемость (в комплекте)

| Сервис | Роль |
|--------|------|
| **prometheus** | Сбор метрик backend и runtime |
| **grafana** | Дашборды (система и KPI по скриптам) |
| **loki** | Агрегация логов |
| **promtail** | Отправка логов контейнеров в Loki |

---

## Движок runtime — модель sandbox

Каждое выполнение скрипта — **изолированный sandbox** внутри контейнера runtime, а не новый Docker-контейнер.

```
Движок runtime (один контейнер)
├── Супервизор (async event loop)
├── Менеджер пула sandbox
│   ├── Sandbox #1  script_id=42  run_id=1001
│   │   ├── subprocess (python main.py)
│   │   ├── отдельный venv (на скрипт или на запуск)
│   │   ├── каталог workspace (bind из MinIO)
│   │   ├── переменные окружения + секреты
│   │   ├── rlimits: CPU, память, открытые файлы
│   │   └── cgroup slice (если доступен)
│   ├── Sandbox #2  ...
│   └── Sandbox #N  (ограничено max_concurrent_runs)
└── Экспортёр метрик (Prometheus)
```

### Гарантии изоляции

| Слой | Механизм |
|------|----------|
| Процесс | `subprocess` с отдельным PID namespace, где поддерживается |
| Окружение | Словарь env на запуск; секреты инъектируются в runtime, не в коде |
| Файловая система | Workspace на скрипт `/workspaces/{script_id}/`; без кросс-доступа |
| Зависимости | venv на скрипт из `requirements.txt` при включении или импорте |
| CPU | `RLIMIT_CPU`, опционально cgroup `cpu.max` |
| Память | `RLIMIT_AS`, cgroup `memory.max`, OOM kill только для дочернего процесса |
| Время | Таймаут реального времени через watchdog супервизора |
| Сеть | Опциональная политика egress (MVP: общая сеть; Production: сетевые namespace) |

### Динамический жизненный цикл скрипта (без рестарта)

1. Пользователь сохраняет скрипт в UI → backend пишет файлы в MinIO и строку в БД.
2. Backend публикует `script.updated` в Redis.
3. Runtime инвалидирует кэш venv для `script_id`.
4. Планировщик перезагружает cron-записи для `script_id`.
5. Следующий запуск использует свежий код без пересборки контейнера.

---

## Потоки данных

### Ручной запуск

```
UI → POST /api/v1/scripts/{id}/run
  → Backend проверяет RBAC, создаёт Run (queued)
  → Redis LPUSH runtime:jobs
  → Runtime забирает задачу, готовит sandbox, стримит логи в Redis + Loki
  → Backend по WS отправляет статус в UI
  → По завершению: Run обновлён, метрики записаны, уведомления отправлены
```

### Запуск по расписанию

```
Тик планировщика / совпадение cron
  → Проверка enabled, лимита параллельности, окна дат
  → Тот же путь очереди, что и при ручном запуске
```

### Webhook или событие

```
POST /api/v1/hooks/{token}  ИЛИ  событие Redis (script.completed)
  → Планировщик создаёт Run с trigger_type
  → Постановка в очередь runtime
```

---

## Структура backend

```
backend/app/
├── api/v1/          # REST-роутеры (scripts, runs, groups, secrets, backups, ota)
├── core/            # конфигурация, безопасность, зависимости
├── models/          # SQLAlchemy ORM
├── schemas/         # Pydantic DTO
├── services/        # бизнес-логика
│   ├── script_service.py
│   ├── run_service.py
│   ├── secret_service.py      # шифрование envelope на скрипт
│   ├── storage_service.py     # абстракция MinIO
│   ├── notification_service.py
│   ├── backup_service.py
│   └── update_service.py      # интерфейс UpdateProvider
├── ws/              # WebSocket hub (live-логи, статус)
└── integrations/    # клиенты email, telegram, mqtt
```

---

## SDK скриптов (инъекция в sandbox)

Скрипты получают клиентский пакет `pyorchestrator`:

```python
from pyorchestrator import Platform

platform = Platform()  # читает переменные PYORCH_*

platform.storage.upload("data/out.csv", data)
platform.secrets.get("API_TOKEN")
platform.db.query("SELECT ...")  # read-only в scope по умолчанию
platform.notify("Задача выполнена")
platform.http.get("https://...")
platform.mqtt.publish("topic", payload)
```

Секреты и токены **никогда** не хранятся в исходном коде; SDK читает env, инъектированный runtime, и vault API.

---

## Модель безопасности

### Роли RBAC

| Роль | Возможности |
|------|-------------|
| **Administrator** | Полная конфигурация, пользователи, OTA, бэкапы |
| **Developer** | CRUD скриптов, секреты своих групп, запуск и остановка |
| **Operator** | Запуск/остановка/отключение, просмотр логов, без редактирования кода |
| **Viewer** | Только чтение дашборда и логов |

Права ограничены **группой** (monitoring, bots, ETL, custom).

### Секреты

- Хранение в зашифрованном виде (AES-256-GCM, ключ из `SECRET_MASTER_KEY`).
- Namespace на скрипт; расшифровка только при подготовке sandbox в runtime.
- Аудит доступа к секретам.

---

## Раскладка файлов (MinIO)

```
pyorchestrator/
├── scripts/{script_id}/          # дерево проекта (main.py, modules/, ...)
├── runs/{run_id}/                  # артефакты запуска, временные выходы
├── backups/{backup_id}/            # снимки tarball
├── templates/{template_id}/        # шаблоны скриптов
└── system/                         # ассеты платформы
```

Квоты на скрипт задаются полем `storage_quota_bytes` в БД.

---

## OTA-обновления (абстрактный провайдер)

```python
class UpdateProvider(ABC):
    async def check_latest(self) -> VersionInfo: ...
    async def download(self, version: str, dest: Path) -> Path: ...
    async def verify(self, artifact: Path) -> bool: ...

class GitHubUpdateProvider(UpdateProvider):
    """Заглушка до настройки URL репозитория."""
```

Поток: проверка → загрузка → бэкап → миграции → rolling restart через Compose → откат при сбое health.

---

## Масштабирование

| Задача | Подход |
|--------|--------|
| Тысячи зарегистрированных скриптов | Индексы БД на `script_id`, `status`; в Postgres только метаданные |
| Параллельные запуски | Горизонтальное масштабирование runtime (N реплик + очередь Redis) в Production |
| Большой объём логов | Retention в Loki; логи запусков также в `run_logs` (с усечением) |
| Стоимость сборки venv | Lazy build на первый запуск; общие слои базового образа runtime |

MVP: **1 реплика runtime**. Production: **N реплик** с общей Redis-очередью (по-прежнему без контейнера на скрипт).

---

## API (обзор)

| Область | Префикс |
|---------|---------|
| Аутентификация и пользователи | `/api/v1/auth`, `/api/v1/users` |
| Скрипты и файлы | `/api/v1/scripts`, `/api/v1/scripts/{id}/files` |
| Запуски и логи | `/api/v1/runs`, `/api/v1/scripts/{id}/runs` |
| Расписания | `/api/v1/schedules` |
| Группы | `/api/v1/groups` |
| Секреты | `/api/v1/scripts/{id}/secrets` |
| Уведомления | `/api/v1/notifications` |
| Webhooks | `/api/v1/hooks/{token}` |
| Бэкапы | `/api/v1/backups` |
| OTA | `/api/v1/system/updates` |
| Метрики | `/metrics` (Prometheus) |
| WebSocket | `/ws` |

---

## Стек технологий

| Слой | Выбор |
|------|-------|
| API | FastAPI + SQLAlchemy 2 + Alembic |
| База данных | PostgreSQL 16 |
| Кэш и очередь | Redis 7 |
| Планировщик | APScheduler (отдельный сервис) |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Редактор | Monaco Editor |
| Метрики | Prometheus + Grafana |
| Логи | Loki + Promtail |
| Хранилище | MinIO |
| Оркестрация | Docker Compose |
