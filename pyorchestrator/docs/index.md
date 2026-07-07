---
layout: default
---

<img src="{{ '/assets/banner.png' | relative_url }}" alt="PyOrchestrator" class="banner" width="1280" height="640" loading="eager">

<div class="hero">
  <div class="hero-badges">
    <a href="https://github.com/{{ site.github_org }}/{{ site.github_repo }}/actions/workflows/ci.yml" target="_blank" rel="noopener">
      <img src="https://github.com/{{ site.github_org }}/{{ site.github_repo }}/actions/workflows/ci.yml/badge.svg" alt="CI" width="88" height="20">
    </a>
    <a href="https://github.com/{{ site.github_org }}/{{ site.github_repo }}/releases/latest" target="_blank" rel="noopener">
      <img src="https://img.shields.io/github/v/release/{{ site.github_org }}/{{ site.github_repo }}?label=release&amp;color=22d3ee" alt="Latest release" width="88" height="20">
    </a>
    <a href="https://github.com/{{ site.github_org }}/{{ site.github_repo }}/blob/main/LICENSE" target="_blank" rel="noopener">
      <img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="Apache License 2.0" width="120" height="20">
    </a>
    <a href="{{ '/' | relative_url }}">
      <img src="https://img.shields.io/badge/docs-GitHub%20Pages-22d3ee" alt="GitHub Pages" width="120" height="20">
    </a>
  </div>
  <p class="hero-lead">
    SCADA/CMS-платформа управления для тысяч изолированных Python-скриптов и ботов —
    один Runtime Engine, множество sandbox, без отдельного контейнера на скрипт.
  </p>
</div>

> **7 июля 2026** — опубликован [релиз v0.1.13](https://github.com/PyOrchestrator/PyOrchestrator/releases/tag/v0.1.13): обновление backend-зависимостей и синхронизация документации. Предыдущий [v0.1.12](https://github.com/PyOrchestrator/PyOrchestrator/releases/tag/v0.1.12) — исправления API скриптов и устойчивость runtime к Redis.
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
| **Наблюдаемость** | Prometheus, Grafana, Loki (блок в UI — только при доступной Grafana) |
| **MCP** | 24+ инструментов для Cursor и других AI-агентов |
| **RBAC** | Administrator / Developer / Operator / Viewer |

## Стек

| Компонент | Технология |
|-----------|------------|
| API | FastAPI 0.115, Uvicorn 0.49, SQLAlchemy 2.0, Alembic, asyncpg, PostgreSQL 16 |
| UI | React 18, TypeScript 5, Vite 5, Tailwind CSS 4, react-router-dom 7, Monaco, Recharts |
| Runtime | Python 3.12, subprocess, venv, psutil 7, Prometheus |
| Scheduler | APScheduler 3.10 |
| Очередь / pub-sub | Redis 7 |
| Файлы | MinIO (S3-compatible) |
| MCP | `mcp` SDK, streamable HTTP + stdio |
| Инфраструктура | Docker Compose |

## Быстрый старт

```bash
git clone https://github.com/PyOrchestrator/PyOrchestrator.git
cd PyOrchestrator
git checkout v0.1.13
cp .env.example .env
docker compose up --build
```

| Сервис | URL |
|--------|-----|
| Панель управления | http://localhost:5173 |
| API + Swagger | http://localhost:8000/docs |
| Grafana | http://localhost:3000 (если `GRAFANA_ENABLED=true` и сервис запущен) |
| Prometheus | http://localhost:9090 |
| MinIO S3 API | http://localhost:9000 |
| MinIO Console | http://localhost:9001 (только при `MINIO_CONSOLE_ENABLED=true`) |
| MCP (HTTP) | http://localhost:8010/mcp |

**Логин по умолчанию:** `admin@pyorchestrator.local` / `admin` — смените пароль и секреты в `.env` перед production.

## Структура репозитория

```
PyOrchestrator/
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

[Apache License 2.0](https://github.com/PyOrchestrator/PyOrchestrator/blob/main/LICENSE)
