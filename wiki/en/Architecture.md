> **English** · **[Русский](ru-Architecture)** · [← Wiki](Home)

# Architecture

Full version: [docs/architecture.md](https://wash-pro.github.io/WASH-PRO-CRM/en/architecture/)

## Data flow

```
Controllers ⇄ MQTT (Mosquitto, ACL by serial) ⇄ Message Processor ⇄ Dynamic API ⇄ MongoDB
Dashboard ──► Dynamic API (nginx /api)
Dashboard ──► /api/crm/post-device/ ──► message-processor:3022 (commands/prices/sync MQTT)
Dashboard ──► pyorch-bridge ──► PyOrchestrator (Telegram, optional)
Dashboard ──► modules-bridge ──► PyOrchestrator (modules, optional)
```

## Core stack

| Service | Port | Access |
|---------|------|--------|
| dashboard | 80 | ✅ |
| dynamic-api | 3001 | ✅ |
| dynamic-api-panel | 8080 | ✅ |
| mosquitto | 1883 | ✅ LAN |
| mongodb, backup, message-processor | — | internal |

`message-processor`: MQTT subscription + HTTP `:3022` + passwd/ACL sync.

## PyOrchestrator (optional)

| Service | Port |
|---------|------|
| pyorchestrator-panel | 8090 |
| pyorch-backend | 8000 |
| pyorch-mcp | 8010 |
| pyorch-bridge | internal |

Enable: `PYORCHESTRATOR_ENABLED=true` + `./scripts/start.sh`

## Telemetry

- **Inbound:** `{dt_pref}/{serial}/state/*` (native) and `wash/telemetry/#` (legacy)
- **Outbound:** Dashboard → processor HTTP → `{dt_pref}/{serial}/set/*`
- **Auth:** post — own login; CRM — `system`
- **Isolation:** ACL by serial; CRM trusts serial from topic
- Log: `/api/crm/telemetry`
- DLQ: `wash/dlq`

## init-seed

11 endpoint groups, 52 CRM routes, RBAC, RUB, discount types 1–5, `setup.complete: false`.
