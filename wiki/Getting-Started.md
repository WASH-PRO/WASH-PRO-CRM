# Быстрый старт

Полная версия: [docs/getting-started.md](https://wash-pro.github.io/WASH-PRO-CRM/getting-started/)

## Требования

Docker 24+, Compose v2, 4 GB RAM (8 GB с PyOrchestrator).

## Установка

```bash
git clone https://github.com/WASH-PRO/WASH-PRO-CRM.git
cd WASH-PRO-CRM
cp .env.example .env
chmod +x scripts/*.sh
./scripts/start.sh
```

## Вход

| URL | Логин |
|-----|-------|
| http://localhost | `admin` / `Admin123!` |
| http://localhost:8080 | Dynamic API Panel |
| http://localhost:8090 | PyOrchestrator *(если `PYORCHESTRATOR_ENABLED=true`)* |

## Настройка

1. Автомойка + посты (**серийный номер** = `{serial}` в MQTT-топиках).
2. На странице поста: **цены режимов**, префикс MQTT (`washpro`).
3. Admin: пользователи, группы, Telegram-боты.
4. Справочники валют и типов скидок.

## MQTT

Порт **1883** в LAN. Нативный протокол и команды: [MQTT](MQTT).

## Миграция с RabbitMQ

```bash
./scripts/migrate-to-mqtt.sh
```

## PyOrchestrator

```env
PYORCHESTRATOR_ENABLED=true
```

```bash
./scripts/start.sh
```

## Демо

```bash
./scripts/generate-demo-data.sh
./scripts/generate-demo-cards.sh
```

## Seed

```bash
./scripts/run-init-seed.sh
```
