---
layout: default
title: Заметки о выпуске
description: История релизов PyOrchestrator
---

## v0.1.0 — первый публичный выпуск

**Дата:** 27 июня 2026  
**Тег:** [`v0.1.0`](https://github.com/Developer-RU/pyorchestrator/releases/tag/v0.1.0) · MIT

Первый стабильный релиз платформы PyOrchestrator — SCADA/CMS для управления тысячами изолированных Python-скриптов и ботов в фиксированном стеке Docker Compose.

### Что входит в релиз

| Область | Содержание |
|---------|------------|
| **Control plane** | FastAPI API, React UI, JWT + RBAC (4 роли), группы, i18n (ru/en) |
| **Скрипты** | CRUD, многофайловый Monaco-редактор, импорт/экспорт, шаблоны, демо-объекты |
| **Выполнение** | Runtime sandbox (subprocess + venv + rlimits), очередь Redis, live-логи WebSocket |
| **Планирование** | APScheduler: cron, интервалы, webhook-триггеры |
| **Данные** | PostgreSQL 16, MinIO (S3), шифрованный vault секретов на скрипт |
| **Операции** | Ручные и по расписанию бэкапы, in-app уведомления, health/metrics |
| **Наблюдаемость** | Prometheus, Grafana, Loki |
| **AI-агенты** | MCP-сервер (24+ инструментов), HTTP + stdio |
| **Документация** | GitHub Pages на русском, wiki-копия в репозитории |
| **CI** | Сборка backend/frontend, Docker Compose build |

### Улучшения и исправления

- Интеграция **MinIO**: health check, автосоздание bucket, `minio-init`, корректный статус в панели System
- **Страница входа**: split-layout (брендинг + форма), баннер проекта
- **GitHub Pages**: русская документация, sidebar с live-лентой открытых Issues
- Исправлено удаление расписаний (FK `runs.schedule_id` → `ON DELETE SET NULL`)
- Корректная остановка queued/cancelled runs, lazy-load уведомлений

### Быстрый старт

```bash
git clone https://github.com/Developer-RU/pyorchestrator.git
cd pyorchestrator
git checkout v0.1.0
cp .env.example .env
docker compose up --build
```

| Сервис | URL |
|--------|-----|
| Панель управления | http://localhost:5173 |
| API + Swagger | http://localhost:8000/docs |
| MCP | http://localhost:8010/mcp |

**Логин по умолчанию:** `admin@pyorchestrator.local` / `admin` — смените пароль и секреты в `.env` перед production.

### Дальше

См. [дорожную карту]({{ '/roadmap/' | relative_url }}) — фаза **Production-3** (MQTT, HA Postgres, продвинутая изоляция) в backlog.

---

Полный список изменений: [CHANGELOG.md](https://github.com/Developer-RU/pyorchestrator/blob/main/CHANGELOG.md)
