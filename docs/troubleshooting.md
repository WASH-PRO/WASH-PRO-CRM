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

## RabbitMQ

### `Invalid challenge reply` / зависший `rabbitmq-init`

```bash
docker rm -f wash-rabbitmq-init
docker compose up -d rabbitmq rabbitmq-init
```

### `PLAIN login refused: user 'wash'`

```bash
./scripts/fix-rabbitmq.sh
docker restart wash-message-processor
```

Полный сброс:

```bash
docker compose down
docker volume rm wash_rabbitmq_data
docker compose up -d
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

## Resources: PyOrchestrator «Остановлен»

Индикатор проверяет `/api/telegram-bots/health`. Если PyOrch выключен — это ожидаемо. Dynamic API проверяется через `/api/health`.

## Телеметрия не обновляется

1. `postSerial` в сообщении = `serialNumber` поста в CRM
2. `docker logs wash-message-processor`
3. DLQ `wash.dlq`

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

MongoDB сохраняется в `wash_mongodb_data`.

## Помощь

1. `docker compose logs > logs.txt`
2. Issue на GitHub с `APP_VERSION`, `docker compose ps`, шаги воспроизведения
