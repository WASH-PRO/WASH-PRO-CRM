> **[English](../en/Architecture.md)** · **Русский**

# Архитектура

Полная версия: [docs/architecture.md](https://wash-pro.github.io/WASH-PRO-CRM/ru/architecture/)

## Поток данных

```
Контроллеры ⇄ MQTT (Mosquitto, ACL по serial) ⇄ Message Processor ⇄ Dynamic API ⇄ MongoDB
Dashboard ──► Dynamic API (nginx /api)
Dashboard ──► /api/crm/post-device/ ──► message-processor:3022 (команды/цены/sync MQTT)
Dashboard ──► pyorch-bridge ──► PyOrchestrator (Telegram, опц.)
```

## Основной стек

| Сервис | Порт | Доступ |
|--------|------|--------|
| dashboard | 80 | ✅ |
| dynamic-api | 3001 | ✅ |
| dynamic-api-panel | 8080 | ✅ |
| mosquitto | 1883 | ✅ LAN |
| mongodb, backup, message-processor | — | internal |

`message-processor`: подписка MQTT + HTTP `:3022` + синхронизация passwd/ACL.

## PyOrchestrator (опц.)

| Сервис | Порт |
|--------|------|
| pyorchestrator-panel | 8090 |
| pyorch-backend | 8000 |
| pyorch-mcp | 8010 |
| pyorch-bridge | internal |

Включение: `PYORCHESTRATOR_ENABLED=true` + `./scripts/start.sh`

## Телеметрия

- **Входящая:** `{dt_pref}/{serial}/state/*` (нативный) и `wash/telemetry/#` (legacy)
- **Исходящая:** Dashboard → processor HTTP → `{dt_pref}/{serial}/set/*`
- **Авторизация:** пост — свой логин; CRM — `system`
- **Изоляция:** ACL по serial; CRM доверяет serial из топика
- Журнал: `/api/crm/telemetry`
- DLQ: `wash/dlq`

## init-seed

11 групп endpoints, 52 CRM-маршрута, RBAC, RUB, типы скидок 1–5, `setup.complete: false`.
