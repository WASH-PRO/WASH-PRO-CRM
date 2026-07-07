---
layout: default
title: Заметки о выпуске
description: История релизов PyOrchestrator
---

## v0.1.13 — обновление backend-зависимостей и синхронизация документации

**Дата:** 7 июля 2026  
**Тег:** [`v0.1.13`](https://github.com/PyOrchestrator/PyOrchestrator/releases/tag/v0.1.13)

### Изменено

- **Backend:** uvicorn 0.49.0, alembic 1.18.5, python-jose 3.5.0, psutil 7.2.2
- **Runtime:** psutil 7.2.2 (в образе runtime)
- Документация, wiki, CHANGELOG и README приведены к актуальному стеку

---

## v0.1.12 — исправления API скриптов и устойчивость runtime

**Дата:** 7 июля 2026  
**Тег:** [`v0.1.12`](https://github.com/PyOrchestrator/PyOrchestrator/releases/tag/v0.1.12)

### Исправлено

- **Обновление кода скрипта:** `PUT /scripts/{id}` с полем `code` теперь обновляет entrypoint-файл (как при создании)
- **Удаление скрипта:** корректная очистка уведомлений перед удалением запусков — без ошибок FK
- **Runtime:** переподключение к Redis после обрыва соединения; публикация логов устойчива к временным сбоям

### Изменено

- **Backend:** SQLAlchemy 2.0.51, Pydantic 2.13.4, pydantic-settings 2.14.2, redis 8.0.1, python-multipart 0.0.32
- **Frontend:** react-router-dom 7.18.1, @tailwindcss/vite 4.3.2
- **CI:** actions/checkout v7

---

## v0.1.11 — опциональная наблюдаемость и MinIO Console

**Дата:** 30 июня 2026  
**Тег:** [`v0.1.11`](https://github.com/PyOrchestrator/PyOrchestrator/releases/tag/v0.1.11)

### Новое

- Блок **Наблюдаемость** на дашборде — только если Grafana включена (`GRAFANA_ENABLED`) и отвечает на health-check
- **MinIO Console** опциональна: по умолчанию только S3 API (`MINIO_CONSOLE_ENABLED=false`)

### Изменено

- Страница **Система**: карточки Bucket и статус MinIO на всю ширину, когда консоль отключена
- Документация и wiki обновлены под OTA и новые переменные окружения

### OTA (с v0.1.5)

Полноценные обновления через **Настройки → Обновления ПО** с GitHub Releases, Docker-исполнителем и откатом.

---

## v0.1.0 — первый публичный выпуск

**Дата:** 27 июня 2026  
**Тег:** [`v0.1.0`](https://github.com/PyOrchestrator/PyOrchestrator/releases/tag/v0.1.0) · Apache 2.0

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

### Быстрый старт

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
| MCP | http://localhost:8010/mcp |

**Логин по умолчанию:** `admin@pyorchestrator.local` / `admin` — смените пароль и секреты в `.env` перед production.

---

Полный список изменений: [CHANGELOG.md](https://github.com/PyOrchestrator/PyOrchestrator/blob/main/CHANGELOG.md)
