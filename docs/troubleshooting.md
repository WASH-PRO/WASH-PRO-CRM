---
layout: default
title: Устранение неполадок
description: Типичные проблемы и решения
---

## Обновление Dynamic API Platform

In-app updater в панели `:8080` **отключён** в WASH. Используйте:

```bash
./scripts/update-dynamic-api.sh
docker compose up -d --build dynamic-api dynamic-api-panel
```

Актуальная vendored-версия: **v1.5.13**.

## init-seed: статус Exited

`Exited (0)` — норма (одноразовый контейнер).

При ошибке:

```bash
docker logs wash-init-seed
./scripts/run-init-seed.sh
```

## Миграция с RabbitMQ на MQTT

Если раньше использовался RabbitMQ (AMQP, порт 5672):

```bash
./scripts/migrate-to-mqtt.sh
docker compose up -d --build message-processor
```

В `.env` замените `RABBITMQ_*` на `MQTT_*`. Контроллеры должны публиковать в топик `wash/telemetry/{тип}` (QoS 1), не в exchange AMQP.

Подробнее: [MQTT](mqtt.md).

## MQTT

### Проблемы с пользователем / паролем

```bash
./scripts/fix-mqtt.sh
docker restart wash-message-processor
```

Полный сброс MQTT (данные в `DATA_DIR`, не в Docker volume):

```bash
docker compose stop mosquitto mosquitto-init
rm -rf "${DATA_DIR:-./data}/mosquitto/data"/* "${DATA_DIR:-./data}/mosquitto/config"/*
./scripts/start.sh
```

Проверка подключения:

```bash
docker exec wash-mosquitto mosquitto_sub -h 127.0.0.1 -p 1884 -t '$SYS/broker/version' -C 1 -W 3
```

## Страница «Пользователи» пустая

1. Убедитесь, что вы **Administrator** (`manage_users` или `view_logs`)
2. Проверьте API: `curl -H "Authorization: Bearer TOKEN" http://localhost:3001/api/users?page=1&limit=5`
3. Обновите Dashboard: `docker compose up -d --build dashboard`
4. Перелогиньтесь (истёкший JWT)

## Telegram: «Unauthorized» при создании бота

1. `PYORCHESTRATOR_ENABLED=true` в `.env` и `./scripts/start.sh`
2. Health: `curl http://localhost/api/telegram-bots/health`
3. Пересборка: `docker compose … up -d --build dashboard pyorch-bridge`
4. Обновите страницу / перелогиньтесь
5. Логи: `docker logs wash-pyorch-bridge --tail 50`

## Telegram: «PyOrchestrator недоступен»

```bash
docker compose ps | grep pyorch
docker logs wash-pyorch-backend
curl -s http://localhost:8000/health
```

Учётные данные bridge: `PYORCH_DASHBOARD_EMAIL` / `PYORCH_DASHBOARD_PASSWORD`.

## PyOrchestrator MCP: «unreachable» / не стартует

В WASH сервис называется `pyorch-mcp`, а backend по умолчанию обращается к `http://mcp:8010`. В overlay заданы `MCP_INTERNAL_URL` и сетевой alias `mcp`.

```bash
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d pyorch-mcp pyorch-backend
docker logs wash-pyorch-mcp --tail 30
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8010/mcp   # 200/405/406 — норма
```

Проверка из API (нужен JWT admin):

```bash
curl -s http://localhost:8000/api/v1/mcp/info -H "Authorization: Bearer TOKEN" | jq .status
# ожидается: "ok"
```

## Resources: PyOrchestrator «Остановлен»

Индикатор проверяет `/api/telegram-bots/health`. Если PyOrch выключен — это ожидаемо. Dynamic API проверяется через `/api/health`.

## Телеметрия не обновляется

1. Серийный номер в топике (`{dt_pref}/{serial}/state/...`) или `postSerial` в legacy JSON = `serialNumber` поста в CRM
2. `docker logs wash-message-processor`
3. DLQ `wash/dlq`
4. Журнал MQTT: Dashboard → Логи или `/api/crm/telemetry`

## Команды и цены не доходят до поста

1. Префикс MQTT в CRM (`dt_pref`) совпадает с настройкой панели (`get_settings.remote`)
2. `docker logs wash-message-processor` — ошибки публикации
3. Проверка с сервера:
   ```bash
   mosquitto_pub -h localhost -p 1883 -u wash -P 'PASSWORD' -q 1 \
     -t 'washpro/SERIAL/set/command' -m '{"cmd":1}'
   ```
4. HTTP API: `curl http://localhost/api/crm/post-device/posts/SERIAL/command` с JWT (см. [MQTT](mqtt.md))
5. Пересборка после обновления: `docker compose up -d --build message-processor dashboard`

## CORS

Добавьте origin в `CORS_ORIGIN`, перезапустите `dynamic-api`.

## Dashboard не открывается

```bash
docker compose ps
docker logs wash-dashboard
```

## Бэкап

```bash
docker logs wash-backup
```

Ручной запуск — Dashboard → Резервные копии.

## Полный перезапуск

```bash
docker compose down
docker compose up -d --build
```

Данные MongoDB и остальные сервисы лежат в `DATA_DIR` (по умолчанию `./data`), см. [data/README.md](../data/README.md).

## Помощь

1. `docker compose logs > logs.txt`
2. Issue на GitHub с `APP_VERSION`, `docker compose ps`, шаги воспроизведения
