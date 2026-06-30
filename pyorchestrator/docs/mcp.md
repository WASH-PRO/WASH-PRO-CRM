---
layout: default
title: MCP для AI-агентов
description: Model Context Protocol server — интеграция с Cursor и автоматизация платформы
---

PyOrchestrator поставляет **MCP-сервер** (`mcp/`) для управления платформой из AI-агентов (Cursor, Claude, собственные боты).

## Транспорт

| Режим | Когда использовать |
|-------|-------------------|
| **stdio** | Локальная разработка, Cursor IDE |
| **streamable-http** | Docker Compose, порт `8010` |

## Инструменты (24)

| Категория | Инструменты |
|-----------|-------------|
| Auth | `pyorch_login`, `pyorch_whoami` |
| Скрипты | `list_scripts`, `get_script`, `create_script`, `update_script_file`, `enable_script`, `disable_script`, `delete_script` |
| Runs | `run_script`, `stop_script`, `get_run`, `get_run_logs`, `list_script_runs` |
| Автоматизация | `list_groups`, `list_schedules`, `create_schedule`, `list_webhooks`, `create_webhook` |
| Секреты | `set_script_secret`, `list_script_secrets` |
| Платформа | `dashboard_stats`, `system_info`, `list_notifications` |

Ресурс: `pyorch://platform/overview`

## Cursor (stdio)

```json
{
  "mcpServers": {
    "pyorchestrator": {
      "command": "python3",
      "args": ["-m", "pyorchestrator_mcp"],
      "cwd": "/path/to/PyOrchestrator/mcp",
      "env": {
        "PYORCH_API_URL": "http://localhost:8000",
        "PYORCH_EMAIL": "admin@pyorchestrator.local",
        "PYORCH_PASSWORD": "admin"
      }
    }
  }
}
```

## Docker (HTTP)

```bash
docker compose up -d mcp
```

URL: `http://localhost:8010/mcp`

```json
{
  "mcpServers": {
    "pyorchestrator": {
      "url": "http://localhost:8010/mcp"
    }
  }
}
```

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `PYORCH_API_URL` | Backend API |
| `PYORCH_TOKEN` | JWT (опционально) |
| `PYORCH_EMAIL` / `PYORCH_PASSWORD` | Автовход |
| `MCP_TRANSPORT` | `stdio` \| `streamable-http` |
| `MCP_PORT` | HTTP-порт (по умолчанию 8010) |

## Пример workflow агента

1. `system_info` — проверка health
2. `list_scripts` — найти скрипт
3. `update_script_file` — изменить `main.py`
4. `run_script` → `get_run_logs` — выполнить и прочитать вывод

Подробнее: [mcp/README.md](https://github.com/PyOrchestrator/PyOrchestrator/blob/main/mcp/README.md)
