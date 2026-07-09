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
docker compose up -d message-processor
```

Скрипт пересоздаёт `system` в passwd. Учётные записи **постов** — через «Синхронизировать MQTT» в мастере или сохранение поста.

### Пост не может подключиться / «not authorised»

1. Логин/пароль на панели = `settings.mqttLogin` / `settings.mqttPassword` из CRM (не `system`).
2. Топик публикации: `washpro/{serial}/state/...`, где `{serial}` = `posts.serialNumber`.
3. После смены MQTT-данных в CRM — синхронизация MQTT.
4. `./scripts/fix-mqtt.sh` — если сбился `system` для CRM.

### ACL / чужой serial в топике

Пост не может публиковать в топик с чужим serial — Mosquitto отклонит. Если CRM получает сообщение с несовпадающим payload — учитывается только serial из топика.

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

## Telegram: «Нет новостей» / «Новости (N)» без текста

1. **Dashboard → Информация** — статус **Опубликовано** (не «Черновик»)
2. Поле **Скрыть после** — оставьте пустым или дата **позже** публикации
3. Пересборка и перезапуск информационного бота:

```bash
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build pyorch-bridge
# Dashboard → Telegram → ▶ у информационного бота
```

4. В Telegram: `/start` в **личном чате** (не в группе), затем **📰 Новости**
5. URL изображения — прямая ссылка на jpg/png, до 10 МБ, доступная из интернета

## Telegram: нет автоматической рассылки новостей

- Пользователь должен написать боту `/start` в личном чате (регистрация подписчика)
- Новость — статус **Опубликовано**; дата публикации подставится автоматически
- Подождите до 30 с после публикации
- Новости, созданные до первого `/start` пользователя, приходят только по кнопке **📰 Новости**, не push-рассылкой

## Dashboard: серый экран при переходе между разделами

С v1.1.12 добавлены retry загрузки JS-чанков и `RouteErrorBoundary`. Если экран пустой:

1. Обновите страницу (F5)
2. Пересоберите dashboard: `docker compose up -d --build dashboard`
3. Очистите кэш браузера для `localhost`

## Telegram: бот отвечает в группе / видны чужие сообщения

С v1.1.11 боты работают **только в личных чатах**. Откройте бота по **QR** или ссылке `t.me/...` → `/start`. В группах бот не отвечает.

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

## Telegram-бот молчит / runtime: `redis ConnectionError`

После пересборки `pyorch-redis` или `pyorch-backend` runtime может остаться со старым соединением к Redis.

```bash
chmod +x ./scripts/fix-pyorch.sh
./scripts/fix-pyorch.sh
```

Или вручную:

```bash
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml restart pyorch-runtime pyorch-scheduler pyorch-bridge
```

Затем Dashboard → **Telegram** — **Стоп** → **Запуск** у бота.

## Telegram: дублирующиеся ответы (старый + новый формат)

Причина — два процесса polling одного токена (старый demo-скрипт PyOrchestrator + новый шаблон bridge).

```bash
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build pyorch-bridge
# через API или Dashboard: POST /api/telegram-bots/bots/refresh
```

Bridge останавливает legacy-боты и применяет lock по токену. В подвале ответа бота должно быть `Шаблон бота v2.7`.

## Telegram: «Частный бот» для сотрудника

1. **Dashboard → Пользователи** — укажите **Telegram user_id** (число от [@userinfobot](https://t.me/userinfobot))
2. Пользователь должен быть **active**, с назначенной группой (Viewer / Operator / Administrator)
3. Перезапустите бота или дождитесь обновления кэша сессии (до 5 мин)

## Telegram: Viewer не может создать объект

Ожидаемое поведение RBAC — группа **Viewer** имеет только `view`. Для создания автомоек и команд постов назначьте **Operator** или **Administrator**.

**Бот молчит, в логах run: `Temporary failure in name resolution`:** sandbox runtime был только в сети `wash-internal` (без интернета) и не мог достучаться до `api.telegram.org`. После обновления `docker-compose.pyorchestrator.yml` пересоздайте runtime:

```bash
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build pyorch-runtime pyorch-backend pyorch-bridge
```

**Удаление бота падает с 500:** в PyOrchestrator оставались уведомления, ссылающиеся на run. Исправлено в `delete_script_record` — пересоберите `pyorch-backend`.

```bash
docker exec wash-pyorch-runtime python -c "import urllib.request; urllib.request.urlopen('https://api.telegram.org', timeout=10); print('telegram ok')"
docker logs wash-pyorch-runtime --tail 30
```

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

## Статус поста «Офлайн» при работающей панели

Пост **онлайн**, если `lastMessageAt` в `/api/crm/post-states` не старше **30 секунд**. Проверьте:

1. Телеметрия приходит в топик `washpro/{serial}/state/process` (или другой suffix).
2. `docker logs wash-message-processor` — ошибки обработки.
3. Серийный номер в топике = `serialNumber` в CRM.

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
   mosquitto_pub -h localhost -p 1883 -u system -P 'PASSWORD' -q 1 \
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

Данные MongoDB и остальные сервисы лежат в `DATA_DIR` (по умолчанию `./data`), см. [data/README.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/data/README.md).

## Помощь

1. `docker compose logs > logs.txt`
2. Issue на GitHub с `APP_VERSION`, `docker compose ps`, шаги воспроизведения
