---
layout: default
title: MCP для AI-агентов
description: HTTP MCP Dynamic API и PyOrchestrator, раздел Dashboard и stdio crm-mcp
---

WASH PRO CRM предоставляет **Model Context Protocol (MCP)** для подключения AI-агентов (Cursor, Claude Desktop и др.) к CRM, SCADA и автоматизации.

## Три способа подключения

| Способ | Где настроить | Транспорт | Когда использовать |
|--------|---------------|-----------|-------------------|
| **Dashboard → MCP сервер** | `/mcp` | HTTP через nginx | Быстрый старт в Cursor без сборки |
| **Dynamic API Panel** | `:8080` → Automation → MCP | HTTP `POST /api/mcp` | Все CRM endpoints платформы |
| **crm-mcp** | `services/crm-mcp` | stdio | Локальный агент с composite tools |

Раздел **Dashboard → Автоматизация → MCP сервер** (v1.1.12+) — рекомендуемая точка входа для администраторов.

## Dashboard → MCP сервер (`/mcp`)

Страница доступна **Administrator** в группе **Автоматизация**.

| Блок | Описание |
|------|----------|
| **Переключатель сервиса** | **Dynamic API** — CRM, карты, статистика, все auto-generated endpoints; **PyOrchestrator** — скрипты, боты, расписания *(если включён)* |
| **HTTP URL** | Готовый адрес MCP через Dashboard: `/api/mcp` или `/api/pyorch-mcp/mcp` |
| **Конфиг Cursor** | JSON для вставки в настройки MCP (Streamable HTTP, без `npm run build`) |
| **Таблица инструментов** | Поиск, сортировка, фильтр по категории, бейджи HTTP-метода |

### Прокси nginx (Dashboard)

| Путь | Upstream |
|------|----------|
| `/api/mcp` | Dynamic API `POST /api/mcp` (JWT) |
| `/api/pyorch-mcp/mcp` | PyOrchestrator MCP `:8010` *(overlay)* |

Для Dynamic API MCP в Cursor передайте JWT из сессии Dashboard (кнопка «Скопировать» на странице) или используйте API key `dap_...` из панели `:8080`.

PyOrchestrator MCP через Dashboard **не требует** отдельной авторизации в конфиге Cursor — прокси идёт во внутреннюю сеть Docker.

## Stdio: `services/crm-mcp`

Отдельный MCP-сервер для локального агента с удобными composite tools (`crm_get_wash_overview`, прокси Dynamic API MCP, bridge Telegram/post-device).

```bash
cd services/crm-mcp
npm install && npm run build
```

Пример конфига: `services/crm-mcp/cursor-mcp.example.json`. Подробнее: [services/crm-mcp/README.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/services/crm-mcp/README.md).

## Dynamic API MCP (платформа)

Встроен в **Dynamic API Platform v1.5.13**:

- панель `:8080` → раздел Automation;
- endpoint `POST http://localhost:3001/api/mcp` (или через Dashboard `/api/mcp`);
- инструменты генерируются из CRM endpoints и automation.

## PyOrchestrator MCP (опционально)

При `PYORCHESTRATOR_ENABLED=true`:

- сервис `pyorch-mcp` на порту **8010**;
- ~24 инструмента: scripts, runs, schedules, secrets, webhooks;
- Dashboard проксирует `/api/pyorch-mcp/mcp` для внешних агентов.

Проверка:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8010/mcp
docker logs wash-pyorch-mcp --tail 20
```

## Устранение неполадок

| Симптом | Действие |
|---------|----------|
| Dynamic API MCP: 401 | Обновите JWT / API key в конфиге Cursor |
| PyOrchestrator: «unreachable» на `/mcp` | `docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d pyorch-mcp pyorch-backend` |
| Нет раздела MCP в меню | Роль **Administrator**; пересоберите `dashboard` |
| Инструменты не обновляются | Обновите страницу `/mcp` (live-polling списка tools) |

Подробнее: [Устранение неполадок — PyOrchestrator MCP](troubleshooting.md#pyorchestrator-mcp-unreachable--не-стартует).

## См. также

- [Dashboard — навигация](dashboard.md)
- [Встроенные сервисы](embedded-services.md)
- [Конфигурация — PyOrchestrator](configuration.md)
