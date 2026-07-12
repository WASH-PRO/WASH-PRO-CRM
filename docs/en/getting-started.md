---
layout: default
title: Quick start
description: Installation and first launch of WASH PRO CRM
---

## Requirements

- Docker 24+, Docker Compose v2
- 4 GB RAM (8 GB with PyOrchestrator)
- Ports: `80`, `3001`, `8080`; with PyOrch — `8000`, `8090`, `8010`

## Installation

```bash
git clone https://github.com/WASH-PRO/WASH-PRO-CRM.git
cd WASH-PRO-CRM
cp .env.example .env
# Change JWT_SECRET, passwords!
chmod +x scripts/*.sh
./scripts/start.sh
```

## First login

| Interface | URL | Credentials |
|-----------|-----|-------------|
| **Dashboard** | http://localhost | `admin` / `Admin123!` |
| **Dynamic API Panel** | http://localhost:8080 | same |
| **PyOrchestrator Panel** *(opt.)* | http://localhost:8090 | `admin@pyorchestrator.local` / `admin` |

After logging into the Dashboard, the **setup wizard** (`/setup`) opens if initial setup is not yet complete. Details: [Setup wizard](setup-wizard.md).

Health checks:

```bash
curl -s http://localhost:3001/api/health
curl -s http://localhost/api/telegram-bots/health   # via Dashboard, if PyOrch
```

## Initial configuration

### Setup wizard (recommended)

The wizard guides you through creating a site, posts (with **serial number** and **MQTT login/password**), currency, Mosquitto sync, and reference data.

To restart: `/setup?restart=1` or **System → Setup wizard**.

### Manual setup

1. Create a **car wash** and **posts** with a unique controller **serial number** (must match `{serial}` in MQTT topics).
2. In the post card, set **MQTT login and password** (login defaults to serial).
3. Click **"Sync MQTT"** in the wizard or save the post.
4. On the post page, configure **mode prices** and verify the MQTT prefix (`washpro` by default).
5. **Administrator:** configure **Users** and **Groups & permissions** (Dashboard → System).
6. With PyOrchestrator: create **Telegram bots** (Dashboard → Telegram).
7. With PyOrchestrator *(v1.1.30+)*: install **Modules** from **Automation → Modules** — see [Modules](modules.md).
8. Reference data: **Currencies**, **Discount types**.

`init-seed` creates CRM endpoints, RBAC, RUB, discount types 1–5. `Exited (0)` is normal.

### Demo data

```bash
./scripts/generate-demo-data.sh
./scripts/generate-demo-cards.sh
```

## Startup options

### Redis

```bash
REDIS_ENABLED=true docker compose -f docker-compose.yml -f docker-compose.redis.yml up -d --build
```

### Migration from RabbitMQ

If you previously used RabbitMQ (AMQP):

```bash
./scripts/migrate-to-mqtt.sh
docker compose up -d --build message-processor
```

### MQTT for controllers

Port **1883** is open on the local network by default. A **post** connects with login/password from the post card:

`mqtt://<mqttLogin>:<mqttPassword>@<server-IP>:1883`

The CRM (`message-processor`) uses `system`; password — **Settings → MQTT (CRM)** (on first launch — `MQTT_PASSWORD` in `.env`). See [MQTT](mqtt.md).

Native panel protocol: `{dt_pref}/{serial}/state/*`. Control from CRM: [MQTT](mqtt.md).

Localhost only (no LAN): `MQTT_BIND=127.0.0.1` in `.env`.

### PyOrchestrator

```bash
# In .env: PYORCHESTRATOR_ENABLED=true
./scripts/start.sh
```

### PyOrch observability

```env
PYORCH_OBSERVABILITY_ENABLED=true
```

## Re-run seed

```bash
./scripts/run-init-seed.sh
```

## Verification

```bash
docker compose ps
docker logs wash-init-seed
docker logs wash-message-processor
```

More about the platforms: [Embedded services](embedded-services.md).
