# Архитектура

Полная версия: [docs/architecture.md](https://wash-pro.github.io/WASH-PRO-CRM/architecture/)

## Поток данных

```
Контроллеры → RabbitMQ → Message Processor → Dynamic API → MongoDB
Dashboard ──► Dynamic API (nginx /api)
Dashboard ──► pyorch-bridge ──► PyOrchestrator (Telegram, опц.)
```

## Основной стек

| Сервис | Порт | Доступ |
|--------|------|--------|
| dashboard | 80 | ✅ |
| dynamic-api | 3001 | ✅ |
| dynamic-api-panel | 8080 | ✅ |
| mongodb, rabbitmq, backup, message-processor | — | internal |

## PyOrchestrator (опц.)

| Сервис | Порт |
|--------|------|
| pyorchestrator-panel | 8090 |
| pyorch-backend | 8000 |
| pyorch-mcp | 8010 |
| pyorch-bridge | internal |

Включение: `PYORCHESTRATOR_ENABLED=true` + `./scripts/start.sh`

## init-seed

11 групп endpoints, 52 CRM-маршрута, RBAC, RUB, типы скидок 1–5.
