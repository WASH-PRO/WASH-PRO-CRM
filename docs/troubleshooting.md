---
layout: default
title: Устранение неполадок
description: Типичные проблемы и решения
---

## Обновление Dynamic API Platform

В панели (`:8080` → **Settings → Software Updates**) отображается блок **«WASH-PHO-CRM — встроенная платформа»** с инструкцией. In-app updater отключён намеренно.

```bash
./scripts/update-dynamic-api.sh
docker compose up -d --build dynamic-api dynamic-api-panel
```

## init-seed: статус Exited

`init-seed` — **одноразовый** контейнер. Статус `Exited (0)` означает успешное завершение.

Если зависимые сервисы не стартовали (код выхода 1):

```bash
docker logs wash-init-seed
./scripts/run-init-seed.sh
```

**Типичная причина:** Dynamic API отвечал на `/health`, но учётная запись admin ещё не была создана в MongoDB.

## RabbitMQ: `Invalid challenge reply` / зависший `wash-rabbitmq-init`

Контейнер `rabbitmq-init` должен монтировать тот же volume `rabbitmq_data`, что и `rabbitmq` — иначе CLI подключается с другим Erlang cookie.

```bash
docker rm -f wash-rabbitmq-init
docker compose up -d rabbitmq rabbitmq-init
```

Статус `wash-rabbitmq-init` **Exited (0)** — норма (одноразовая настройка пользователя).

## RabbitMQ: `PLAIN login refused: user 'wash'`

Пользователь RabbitMQ мог не создаться при первом запуске.

```bash
./scripts/fix-rabbitmq.sh
docker restart wash-message-processor
```

Полный сброс данных RabbitMQ:

```bash
docker compose down
docker volume rm wash_rabbitmq_data
docker compose up -d
```

## Не создаётся / не удаляется автомойка

1. Проверьте, что пользователь в группе Super Admin или Administrator
2. Перезапустите init-seed: `./scripts/run-init-seed.sh`
3. Проверьте логи API: `docker logs wash-dynamic-api`

## Телеметрия не обновляет состояние поста

1. Убедитесь, что `postSerial` в сообщении совпадает с `serialNumber` поста в CRM
2. Проверьте message-processor: `docker logs wash-message-processor`
3. Проверьте очередь в RabbitMQ Management (если включён)
4. Смотрите DLQ `wash.dlq` на необработанные сообщения

## CORS ошибки в браузере

Добавьте origin Dashboard в `CORS_ORIGIN` в `.env`:

```env
CORS_ORIGIN=http://localhost,http://localhost:3001,http://your-host
```

Перезапустите `dynamic-api`:

```bash
docker compose up -d dynamic-api
```

## Dashboard не открывается

```bash
docker compose ps
docker logs wash-dashboard
```

Проверьте, что порт `DASHBOARD_PORT` не занят другим процессом.

## Проблемы с бэкапом

```bash
docker logs wash-backup
docker volume inspect wash_backup_data
```

Ручной запуск бэкапа — через Dashboard → **Резервные копии**.

## Полный перезапуск стека

```bash
docker compose down
docker compose up -d --build
```

Данные MongoDB сохраняются в volume `wash_mongodb_data`.

## Получение помощи

1. Соберите логи: `docker compose logs > logs.txt`
2. Опишите шаги воспроизведения
3. Создайте Issue в GitHub с версией `APP_VERSION` и выводом `docker compose ps`
