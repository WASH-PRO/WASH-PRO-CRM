> **[English](../en/MCP.md)** · **Русский**

# MCP для AI-агентов

Полная документация: [docs/mcp.md](../../docs/mcp.md) · [GitHub Pages — MCP](https://wash-pro.github.io/WASH-PRO-CRM/ru/mcp/)

## v1.1.12 — кратко

| Способ | Где |
|--------|-----|
| **Dashboard** | **Автоматизация → MCP сервер** (`/mcp`) |
| Dynamic API HTTP | `/api/mcp` (JWT) |
| PyOrchestrator HTTP | `/api/pyorch-mcp/mcp` *(если PyOrch включён)* |
| Stdio composite | `services/crm-mcp` |

На странице `/mcp`: переключатель сервиса, таблица tools, готовый JSON для **Cursor** (без сборки).

## Быстрый старт (Cursor)

1. Войдите в Dashboard как **Administrator**
2. **Автоматизация → MCP сервер**
3. Выберите **Dynamic API** или **PyOrchestrator**
4. Скопируйте конфиг Cursor → вставьте в Settings → MCP
5. Перезапустите Cursor

## Устранение неполадок

| Симптом | Действие |
|---------|----------|
| Нет пункта MCP | Роль Administrator; `docker compose up -d --build dashboard` |
| PyOrch unreachable | `docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d pyorch-mcp` |
| 401 Dynamic API | Обновите JWT / API key в конфиге |

См. [Troubleshooting](https://wash-pro.github.io/WASH-PRO-CRM/ru/troubleshooting/), [Dashboard](Dashboard).
