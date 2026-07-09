> **[English](en/Embedded-Services)** · **Русский** · [← Wiki](../Home)

# Встроенные сервисы

Полная версия: [docs/embedded-services.md](https://wash-pro.github.io/WASH-PRO-CRM/ru/embedded-services/)

## Dynamic API Platform v1.5.13

- Backend CRM (`/api/crm/*`), MongoDB, JWT + RBAC
- Панель `:8080`: endpoints, cron, webhooks, MCP, API keys, Database Explorer, API Schema
- **In-app updater выключен в WASH** — `./scripts/update-dynamic-api.sh`

Upstream: https://dynamic-api-platform.github.io/Dynamic-API-Platform/

## PyOrchestrator v0.1.10 (опц.)

- Python scripts/bots, schedules, secrets, WebSocket logs
- Панель `:8090`: полный Control Plane
- **WASH:** Telegram-боты через `pyorch-bridge` + Dashboard → Telegram
- MCP `:8010`; observability — профиль `pyorch-observability`

Upstream: https://pyorchestrator.github.io/PyOrchestrator/

## Что не заявлять как готовое

| Функция | Статус |
|---------|--------|
| Dynamic API in-app updates в WASH | ❌ отключено |
| PyOrchestrator OTA updates | stub |
| PyOrchestrator audit logs UI | roadmap |

## Resources в Dashboard

Ссылки на `:8080` и `:8090` с индикатором online/offline.

## Учётные данные

| | Dashboard / DAP | PyOrchestrator |
|--|-----------------|----------------|
| Default | admin / Admin123! | admin@pyorchestrator.local / admin |

Смените перед production.
