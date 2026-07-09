> **English** · **[Русский](ru/Getting-Started)** · [← Wiki](../Home)

# Getting Started

Full version: [docs/getting-started.md](https://wash-pro.github.io/WASH-PRO-CRM/en/getting-started/)

## Requirements

Docker 24+, Compose v2, 4 GB RAM (8 GB with PyOrchestrator).

## Installation

```bash
git clone https://github.com/WASH-PRO/WASH-PRO-CRM.git
cd WASH-PRO-CRM
cp .env.example .env
chmod +x scripts/*.sh
./scripts/start.sh
```

## Login

| URL | Credentials |
|-----|-------------|
| http://localhost | `admin` / `Admin123!` |
| http://localhost:8080 | Dynamic API Panel |
| http://localhost:8090 | PyOrchestrator *(if `PYORCHESTRATOR_ENABLED=true`)* |

First login → **setup wizard** (`/setup`).

## Configuration

1. Complete the **setup wizard** or configure manually: car wash + posts (**serial**, **MQTT login/password**).
2. **Sync MQTT** in the wizard.
3. On the post page: **mode prices**, prefix `washpro`.
4. Admin: users, groups, Telegram bots.
5. Currency and discount type reference data.

## MQTT

- Post: `mqtt://<mqttLogin>:<mqttPassword>@<IP>:1883`
- CRM: `system` — password in **Settings → MQTT (CRM)** (`MQTT_USER` / `MQTT_PASSWORD` in `.env` on first start)
- Details: [MQTT](MQTT)

## Migration from RabbitMQ

```bash
./scripts/migrate-to-mqtt.sh
```

## PyOrchestrator

```env
PYORCHESTRATOR_ENABLED=true
```

## Demo

```bash
./scripts/generate-demo-data.sh
./scripts/generate-demo-cards.sh
```

## Seed

```bash
./scripts/run-init-seed.sh
```
