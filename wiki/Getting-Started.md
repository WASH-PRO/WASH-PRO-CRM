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

Первый вход → **мастер настройки** (`/setup`).

## Настройка

1. Пройдите **мастер настройки** или вручную: автомойка + посты (**serial**, **MQTT login/password**).
2. **Синхронизировать MQTT** в мастере.
3. На странице поста: **цены режимов**, префикс `washpro`.
4. Admin: пользователи, группы, Telegram-боты.
5. Справочники валют и типов скидок.

## MQTT

- Пост: `mqtt://<mqttLogin>:<mqttPassword>@<IP>:1883`
- CRM: `system` — пароль в **Настройки → MQTT (CRM)** (`MQTT_USER` / `MQTT_PASSWORD` в `.env` при первом запуске)
- Подробнее: [MQTT](MQTT)

## Миграция с RabbitMQ

```bash
./scripts/migrate-to-mqtt.sh
```

## PyOrchestrator

```env
PYORCHESTRATOR_ENABLED=true
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
