---
layout: default
title: Troubleshooting
description: Common problems and solutions
---

## Updating Dynamic API Platform

In-app updater in panel `:8080` is **disabled** in WASH. Use:

```bash
./scripts/update-dynamic-api.sh
docker compose up -d --build dynamic-api dynamic-api-panel
```

Current vendored version: **v1.5.13**.

## init-seed: Exited status

`Exited (0)` is normal (one-time container).

On error:

```bash
docker logs wash-init-seed
./scripts/run-init-seed.sh
```

## Migration from RabbitMQ to MQTT

If you previously used RabbitMQ (AMQP, port 5672):

```bash
./scripts/migrate-to-mqtt.sh
docker compose up -d --build message-processor
```

In `.env` replace `RABBITMQ_*` with `MQTT_*`. Controllers must publish to topic `wash/telemetry/{type}` (QoS 1), not AMQP exchange.

Details: [MQTT](mqtt.md).

## MQTT

### User / password issues

```bash
./scripts/fix-mqtt.sh
docker compose up -d message-processor
```

Script recreates `system` in passwd. **Post** accounts — via "Sync MQTT" in wizard or post save.

### Post cannot connect / "not authorised"

1. Panel login/password = `settings.mqttLogin` / `settings.mqttPassword` from CRM (not `system`).
2. Publish topic: `washpro/{serial}/state/...`, where `{serial}` = `posts.serialNumber`.
3. After MQTT data change in CRM — MQTT sync.
4. `./scripts/fix-mqtt.sh` — if `system` for CRM is broken.

### ACL / foreign serial in topic

Post cannot publish to topic with another serial — Mosquitto will reject. If CRM receives message with mismatched payload — only serial from topic is used.

Full MQTT reset (data in `DATA_DIR`, not Docker volume):

```bash
docker compose stop mosquitto mosquitto-init
rm -rf "${DATA_DIR:-./data}/mosquitto/data"/* "${DATA_DIR:-./data}/mosquitto/config"/*
./scripts/start.sh
```

Connection check:

```bash
docker exec wash-mosquitto mosquitto_sub -h 127.0.0.1 -p 1884 -t '$SYS/broker/version' -C 1 -W 3
```

## Users page is empty

1. Ensure you are **Administrator** (`manage_users` or `view_logs`)
2. Check API: `curl -H "Authorization: Bearer TOKEN" http://localhost:3001/api/users?page=1&limit=5`
3. Update Dashboard: `docker compose up -d --build dashboard`
4. Re-login (expired JWT)

## Telegram: "No news" / "News (N)" without text

1. **Dashboard → Information** — status **Published** (not "Draft")
2. **Hide after** field — leave empty or date **after** publication
3. Rebuild and restart information bot:

```bash
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build pyorch-bridge
# Dashboard → Telegram → ▶ on information bot
```

4. In Telegram: `/start` in **private chat** (not group), then **📰 News**
5. Image URL — direct jpg/png link, up to 10 MB, accessible from internet

## Telegram: no automatic news broadcast

- User must send `/start` to bot in private chat (subscriber registration)
- News — status **Published**; publication date set automatically
- Wait up to 30 s after publish
- News created before user's first `/start` arrive only via **📰 News** button, not push broadcast

## Dashboard: gray screen when navigating sections

Since v1.1.12 JS chunk retry and `RouteErrorBoundary` added. If screen is blank:

1. Refresh page (F5)
2. Rebuild dashboard: `docker compose up -d --build dashboard`
3. Clear browser cache for `localhost`

## Telegram: bot responds in group / others' messages visible

Since v1.1.11 bots work **only in private chats**. Open bot via **QR** or `t.me/...` link → `/start`. In groups bot does not respond.

## Telegram: "Unauthorized" when creating bot

1. `PYORCHESTRATOR_ENABLED=true` in `.env` and `./scripts/start.sh`
2. Health: `curl http://localhost/api/telegram-bots/health`
3. Rebuild: `docker compose … up -d --build dashboard pyorch-bridge`
4. Refresh page / re-login
5. Logs: `docker logs wash-pyorch-bridge --tail 50`

## Telegram: "PyOrchestrator unavailable"

```bash
docker compose ps | grep pyorch
docker logs wash-pyorch-backend
curl -s http://localhost:8000/health
```

Bridge credentials: `PYORCH_DASHBOARD_EMAIL` / `PYORCH_DASHBOARD_PASSWORD`.

## Telegram bot silent / runtime: `redis ConnectionError`

After rebuilding `pyorch-redis` or `pyorch-backend`, runtime may keep old Redis connection.

```bash
chmod +x ./scripts/fix-pyorch.sh
./scripts/fix-pyorch.sh
```

Or manually:

```bash
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml restart pyorch-runtime pyorch-scheduler pyorch-bridge
```

Then Dashboard → **Telegram** — **Stop** → **Start** on bot.

## Telegram: duplicate replies (old + new format)

Cause — two polling processes on one token (old PyOrchestrator demo script + new bridge template).

```bash
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build pyorch-bridge
# via API or Dashboard: POST /api/telegram-bots/bots/refresh
```

Bridge stops legacy bots and applies token lock. Bot reply footer should show `Шаблон бота v2.7`.

## Telegram: "Private bot" for staff

1. **Dashboard → Users** — set **Telegram user_id** (number from [@userinfobot](https://t.me/userinfobot))
2. User must be **active**, with assigned group (Viewer / Operator / Administrator)
3. Restart bot or wait for session cache refresh (up to 5 min)

## Telegram: Viewer cannot create site

Expected RBAC behavior — **Viewer** group has only `view`. For creating washes and post commands assign **Operator** or **Administrator**.

**Bot silent, run logs: `Temporary failure in name resolution`:** sandbox runtime was only on `wash-internal` network (no internet) and could not reach `api.telegram.org`. After updating `docker-compose.pyorchestrator.yml` recreate runtime:

```bash
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build pyorch-runtime pyorch-backend pyorch-bridge
```

**Bot delete fails with 500:** PyOrchestrator had notifications referencing run. Fixed in `delete_script_record` — rebuild `pyorch-backend`.

```bash
docker exec wash-pyorch-runtime python -c "import urllib.request; urllib.request.urlopen('https://api.telegram.org', timeout=10); print('telegram ok')"
docker logs wash-pyorch-runtime --tail 30
```

## PyOrchestrator MCP: "unreachable" / does not start

In WASH the service is named `pyorch-mcp`, while backend defaults to `http://mcp:8010`. Overlay sets `MCP_INTERNAL_URL` and network alias `mcp`.

```bash
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d pyorch-mcp pyorch-backend
docker logs wash-pyorch-mcp --tail 30
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8010/mcp   # 200/405/406 — normal
```

Check from API (admin JWT required):

```bash
curl -s http://localhost:8000/api/v1/mcp/info -H "Authorization: Bearer TOKEN" | jq .status
# expected: "ok"
```

## Resources: PyOrchestrator "Stopped"

Indicator checks `/api/telegram-bots/health`. If PyOrch is off — expected. Dynamic API checked via `/api/health`.

## Post status "Offline" with working panel

Post is **online** if `lastMessageAt` in `/api/crm/post-states` is not older than **30 seconds**. Check:

1. Telemetry arrives on topic `washpro/{serial}/state/process` (or other suffix).
2. `docker logs wash-message-processor` — processing errors.
3. Serial in topic = `serialNumber` in CRM.

## Telemetry not updating

1. Serial in topic (`{dt_pref}/{serial}/state/...`) or `postSerial` in legacy JSON = post `serialNumber` in CRM
2. `docker logs wash-message-processor`
3. DLQ `wash/dlq`
4. MQTT log: Dashboard → Logs or `/api/crm/telemetry`

## Commands and prices not reaching post

1. MQTT prefix in CRM (`dt_pref`) matches panel setting (`get_settings.remote`)
2. `docker logs wash-message-processor` — publish errors
3. Check from server:
   ```bash
   mosquitto_pub -h localhost -p 1883 -u system -P 'PASSWORD' -q 1 \
     -t 'washpro/SERIAL/set/command' -m '{"cmd":1}'
   ```
4. HTTP API: `curl http://localhost/api/crm/post-device/posts/SERIAL/command` with JWT (see [MQTT](mqtt.md))
5. Rebuild after update: `docker compose up -d --build message-processor dashboard`

## CORS

Add origin to `CORS_ORIGIN`, restart `dynamic-api`.

## Dashboard won't open

```bash
docker compose ps
docker logs wash-dashboard
```

## Backup

```bash
docker logs wash-backup
```

Manual run — Dashboard → Backups.

## Full restart

```bash
docker compose down
docker compose up -d --build
```

MongoDB and other service data in `DATA_DIR` (default `./data`), see [data/README.md](../data/README.md).

## Help

1. `docker compose logs > logs.txt`
2. GitHub issue with `APP_VERSION`, `docker compose ps`, reproduction steps
