---
layout: default
title: Быстрый старт
description: Установка и первый запуск WASH PRO CRM
---

## Требования

- Docker 24+
- Docker Compose v2
- Минимум 4 GB RAM
- Порты: `80` (Dashboard), `3001` (API), `8080` (панель Dynamic API)

## Установка

```bash
git clone https://github.com/Developer-RU/WASH-PRO-CRM.git
cd WASH-PRO-CRM
cp .env.example .env
```

Отредактируйте `.env`: задайте `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CSRF_SECRET`, пароли RabbitMQ и администратора.

```bash
chmod +x scripts/*.sh
./scripts/start.sh
```

Скрипт `start.sh` создаёт `.env` при отсутствии, собирает контейнеры и запускает стек.

## Первый вход

| Интерфейс | URL | Назначение |
|-----------|-----|------------|
| **Dashboard** | http://localhost | CRM для операторов |
| **Dynamic API Panel** | http://localhost:8080 | Endpoints, пользователи, логи |
| **Health check** | http://localhost:3001/api/health | Статус API |

Учётные данные по умолчанию (из `.env`):

- Логин: `admin`
- Пароль: `Admin123!`

## Первоначальная настройка

1. Войдите в Dashboard и создайте **автомойку** (название, адрес).
2. Добавьте **посты** с уникальным **серийным номером** — по нему контроллер идентифицируется в RabbitMQ.
3. При необходимости настройте Telegram в разделе **Telegram** (токен бота, ID администраторов).

Контейнер `init-seed` автоматически создаёт CRM endpoints, RBAC-группы и настройки по умолчанию. Статус `Exited (0)` — норма.

## Опции запуска

### С Redis (кеш Dynamic API)

```bash
REDIS_ENABLED=true docker compose -f docker-compose.yml -f docker-compose.redis.yml up -d --build
```

### С внешним портом RabbitMQ для контроллеров

```bash
RABBITMQ_EXTERNAL_PORT=5672 docker compose -f docker-compose.yml -f docker-compose.controllers.yml up -d --build
```

## Повторная инициализация CRM

Если endpoints не создались или нужно обновить схему:

```bash
./scripts/run-init-seed.sh
```

## Проверка работоспособности

```bash
docker compose ps
docker logs wash-init-seed
docker logs wash-message-processor
curl -s http://localhost:3001/api/health
```
