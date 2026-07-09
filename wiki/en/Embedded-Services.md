> **English** · **[Русский](../ru/Embedded-Services.md)**

# Embedded Services

Full version: [docs/embedded-services.md](https://wash-pro.github.io/WASH-PRO-CRM/en/embedded-services/)

## Dynamic API Platform v1.5.13

- CRM backend (`/api/crm/*`), MongoDB, JWT + RBAC
- Panel `:8080`: endpoints, cron, webhooks, MCP, API keys, Database Explorer, API Schema
- **In-app updater disabled in WASH** — `./scripts/update-dynamic-api.sh`

Upstream: https://dynamic-api-platform.github.io/Dynamic-API-Platform/

## PyOrchestrator v0.1.10 (optional)

- Python scripts/bots, schedules, secrets, WebSocket logs
- Panel `:8090`: full Control Plane
- **WASH:** Telegram bots via `pyorch-bridge` + Dashboard → Telegram
- MCP `:8010`; observability — `pyorch-observability` profile

Upstream: https://pyorchestrator.github.io/PyOrchestrator/

## Not ready for production claims

| Feature | Status |
|---------|--------|
| Dynamic API in-app updates in WASH | ❌ disabled |
| PyOrchestrator OTA updates | stub |
| PyOrchestrator audit logs UI | roadmap |

## Resources in Dashboard

Links to `:8080` and `:8090` with online/offline indicator.

## Credentials

| | Dashboard / DAP | PyOrchestrator |
|--|-----------------|----------------|
| Default | admin / Admin123! | admin@pyorchestrator.local / admin |

Change before production.
