---
layout: default
title: Быстрый старт
description: Установка и первый запуск WASH PRO CRM
---

## Требования

- Docker 24+, Docker Compose v2
- 4 GB RAM (8 GB с PyOrchestrator)
- Порты: `80`, `3001`, `8080`; при PyOrch — `8000`, `8090`, `8010`

## Установка

```bash
git clone https://github.com/WASH-PRO/WASH-PRO-CRM.git
cd WASH-PRO-CRM
cp .env.example .env
# Измените JWT_SECRET, пароли!
chmod +x scripts/*.sh
./scripts/start.sh
```

## Первый вход

| Интерфейс | URL | Учётные данные |
|-----------|-----|----------------|
| **Dashboard** | http://localhost | `admin` / `Admin123!` |
| **Dynamic API Panel** | http://localhost:8080 | те же |
| **PyOrchestrator Panel** *(опц.)* | http://localhost:8090 | `admin@pyorchestrator.local` / `admin` |

Health checks:

```bash
curl -s http://localhost:3001/api/health
curl -s http://localhost/api/telegram-bots/health   # через Dashboard, если PyOrch
```

## Первоначальная настройка

1. Создайте **автомойку** и **посты** с уникальным **серийным номером** контроллера (должен совпадать с `{serial}` в MQTT-топиках).
2. На странице поста настройте **цены режимов** и проверьте префикс MQTT (`washpro` по умолчанию).
3. **Administrator:** настройте **Пользователи** и **Группы и права** (Dashboard → Система).
3. При PyOrchestrator: создайте **Telegram-ботов** (Dashboard → Telegram).
4. Справочники: **Валюты**, **Типы скидок**.

`init-seed` создаёт CRM endpoints, RBAC, RUB, типы скидок 1–5. `Exited (0)` — норма.

### Демо-данные

```bash
./scripts/generate-demo-data.sh
./scripts/generate-demo-cards.sh
```

## Опции запуска

### Redis

```bash
REDIS_ENABLED=true docker compose -f docker-compose.yml -f docker-compose.redis.yml up -d --build
```

### Миграция с RabbitMQ

Если раньше использовался RabbitMQ (AMQP):

```bash
./scripts/migrate-to-mqtt.sh
docker compose up -d --build message-processor
```

### MQTT для контроллеров

Порт **1883** открыт в локальной сети по умолчанию. Контроллеры подключаются к `mqtt://wash:PASSWORD@<IP-сервера>:1883`.

Только localhost (без LAN): `MQTT_BIND=127.0.0.1` в `.env`.

Нативный протокол панели: `{dt_pref}/{serial}/state/*`. Управление из CRM: [MQTT](mqtt.md).

### PyOrchestrator

```bash
# В .env: PYORCHESTRATOR_ENABLED=true
./scripts/start.sh
```

### Observability PyOrch

```env
PYORCH_OBSERVABILITY_ENABLED=true
```

## Повторный seed

```bash
./scripts/run-init-seed.sh
```

## Проверка

```bash
docker compose ps
docker logs wash-init-seed
docker logs wash-message-processor
```

Подробнее о платформах: [Встроенные сервисы](embedded-services.md).
