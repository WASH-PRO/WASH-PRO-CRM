---
layout: default
---

<img src="{{ '/assets/banner.png' | relative_url }}" alt="PyOrchestrator" class="banner" width="1280" height="640" loading="eager">

<div class="hero">
  <span class="hero-badge">v0.1.0 · первый релиз · MIT</span>
  <p class="hero-lead">
    SCADA/CMS-платформа управления для тысяч изолированных Python-скриптов и ботов —
    один Runtime Engine, множество sandbox, без отдельного контейнера на скрипт.
  </p>
</div>

> **27 июня 2026** — опубликован [первый релиз v0.1.0](https://github.com/Developer-RU/pyorchestrator/releases/tag/v0.1.0).
> См. [заметки о выпуске]({{ '/release-notes/' | relative_url }}).

**PyOrchestrator** — платформа для создания, планирования, запуска и мониторинга Python-автоматизации в фиксированном стеке Docker Compose: веб-интерфейс, API, планировщик, изолированный runtime, наблюдаемость и MCP-сервер для AI-агентов.

<p class="quick-links">
  <a href="{{ '/release-notes/' | relative_url }}">Заметки о выпуске</a> ·
  <a href="{{ '/getting-started/' | relative_url }}">Быстрый старт</a> ·
  <a href="{{ '/architecture/' | relative_url }}">Архитектура</a> ·
  <a href="{{ '/control-plane/' | relative_url }}">Панель управления</a> ·
  <a href="{{ '/mcp/' | relative_url }}">MCP</a>
</p>

## Возможности

| Модуль | Описание |
|--------|----------|
| **Обзор** | KPI, объединённые графики активности, состав объектов, состояние сервисов |
| **Скрипты и боты** | CRUD, многофайловый редактор (Monaco), импорт/экспорт, шаблоны |
| **Группы** | Организация скриптов по категориям |
| **Расписания** | Cron, интервалы, webhook-триггеры |
| **Вебхуки** | Внешние HTTP-триггеры |
| **Runtime** | Subprocess sandbox + venv + rlimits, очередь Redis |
| **Секреты** | Шифрованное хранилище на скрипт, инъекция в runtime |
| **Бэкапы** | Ручные и по расписанию, восстановление |
| **Оповещения** | In-app уведомления по событиям runs |
| **Наблюдаемость** | Prometheus, Grafana, Loki |
| **MCP** | 24+ инструментов для Cursor и других AI-агентов |
| **RBAC** | Administrator / Developer / Operator / Viewer |

## Стек

| Компонент | Технология |
|-----------|------------|
| API | FastAPI 0.115, SQLAlchemy 2, asyncpg, PostgreSQL 16 |
| UI | React 18, TypeScript, Vite 5, Tailwind CSS 4, Monaco, Recharts |
| Runtime | Python 3.12, subprocess, venv, psutil, Prometheus |
| Scheduler | APScheduler 3.10 |
| Очередь / pub-sub | Redis 7 |
| Файлы | MinIO (S3-compatible) |
| MCP | `mcp` SDK, streamable HTTP + stdio |
| Инфраструктура | Docker Compose |

## Быстрый старт

```bash
git clone https://github.com/Developer-RU/pyorchestrator.git
cd pyorchestrator
cp .env.example .env
docker compose up --build
```

| Сервис | URL |
|--------|-----|
| Панель управления | http://localhost:5173 |
| API + Swagger | http://localhost:8000/docs |
| Grafana | http://localhost:3000 |
| Prometheus | http://localhost:9090 |
| MinIO Console | http://localhost:9001 |
| MCP (HTTP) | http://localhost:8010/mcp |

**Логин по умолчанию:** `admin@pyorchestrator.local` / `admin` — смените пароль и секреты в `.env` перед production.

## Структура репозитория

```
pyorchestrator/
├── backend/           # FastAPI — REST, WebSocket, RBAC
├── frontend/          # React — панель управления
├── runtime/           # Движок sandbox
├── scheduler/         # Сервис APScheduler
├── mcp/               # MCP-сервер для AI-агентов
├── infrastructure/    # Prometheus, Grafana, Loki
├── docs/              # Документация (GitHub Pages)
├── wiki/              # Копия для GitHub Wiki
└── docker-compose.yml
```

## Лицензия

[MIT License](https://github.com/Developer-RU/pyorchestrator/blob/main/LICENSE)
