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

## CRM update failed or wrong paths

WASH uses **`update-bridge`** for in-Dashboard updates (not the Dynamic API panel updater).

1. Open **Dashboard → Settings → Integrity and repair** (administrator).
2. Click **Check integrity** — review paths (`WASH_HOST_PROJECT_ROOT`, `DATA_DIR`), missing files, Docker socket, stuck jobs.
3. Select fixes and click **Apply fixes** (sync `.env`, Mosquitto repair, `init-seed`, clear stuck job).
4. Rebuild if needed:

```bash
docker compose up -d --build update-bridge dashboard
```

Manual fallback:

```bash
./scripts/fix-mqtt.sh
docker compose run --rm init-seed
```

Ensure `.env` has correct `WASH_HOST_PROJECT_ROOT` (absolute host path to the project) and `DATA_DIR` — host data directory (`./data`, `/var/lib/wash-pro-crm`, `/mnt/hdd/data`, etc.).

## False “suspicious DATA_DIR” warning (v1.1.19+)

**Symptoms:** **Integrity and repair** warns about `DATA_DIR` even though the path is valid (e.g. `/mnt/hdd/data`).

**Cause (before v1.1.19):** the check flagged any absolute `DATA_DIR` that did not match `{project}/data`.

**Fix (v1.1.19+):** external host paths are valid; warning only when `DATA_DIR` points inside the container `/deploy` mount. Upgrade and rebuild:

```bash
git pull
docker compose up -d --build update-bridge dashboard
```

Do **not** apply the “Set DATA_DIR=./data” fix if your data already lives on an external disk.

## Updates not shown / reset on page load (v1.1.18+)

**Symptoms:** update banner disappears after F5; empty “latest version” on component cards; “GitHub API rate limit exceeded”.

**Cause (before v1.1.18):** without `GITHUB_TOKEN`, GitHub REST API allows 60 requests/hour per IP; Dashboard forced API checks on every load and every 3 s during updates.

**Fix (v1.1.18+):**

- `update-bridge` falls back to **`git ls-remote`** when API quota is exhausted — token **not required** for public repos
- normal page load and job progress polling use **cache**; GitHub is queried only via **Check now**
- on API errors, last known versions are kept in `DATA_DIR/update-bridge/state.json`

Upgrade to **v1.1.18** and rebuild:

```bash
git pull
docker compose up -d --build update-bridge dashboard
```

`GITHUB_TOKEN` in `.env` is **optional** (release notes and 5000 req/h). Not needed for public installs.

## Local server edits block git pull

**Symptoms:** Dashboard update “resets” immediately — progress vanishes in 1–2 s, history shows `failed`, step “Fetch from GitHub”.

**Cause (before v1.1.20):** `git pull --ff-only` aborts on any **tracked** file modifications (“local changes would be overwritten”). Localhost clones are often clean; production hosts after manual edits or `scp` are not.

**Fix (v1.1.20+):** updater runs `git fetch` + `git reset --hard origin/main` — resets tracked files only; **preserves** `.env`, `docker-compose.override.yml`, `local/`, `DATA_DIR`.

**Recommended pattern:**

```bash
cp docker-compose.override.yml.example docker-compose.override.yml
mkdir -p local
cp local/apply-server-patches.sh.example local/apply-server-patches.sh
chmod +x local/apply-server-patches.sh
git checkout -- docker-compose.yml
```

- `docker-compose.override.yml` — untracked, loaded by `scripts/start.sh`
- `local/apply-server-patches.sh` — run by updater after `git pull`

See [Deployment](deployment.md), [Configuration](configuration.md).

## “text/html is not a valid JavaScript MIME type” (v1.1.29+)

**Symptoms:** **Interface error** or “Failed to load page” mentioning `text/html` and JavaScript MIME type; often after `docker compose up -d --build dashboard` or a CRM update from Dashboard.

**Cause:** the browser (often Safari) keeps a stale `index.html` pointing at removed JS bundles (`/assets/index-….js`). Before v1.1.29 nginx could return HTML instead of 404 — the browser tried to run HTML as JS.

**Fix:**

1. **Hard reload:** `⌘⇧R` (Mac) or close the tab and open CRM again.
2. Upgrade to **v1.1.29+** and rebuild dashboard: `docker compose up -d --build dashboard`.
3. Do not mix **localhost:80** (Docker) and **localhost:5173** (`npm run dev`) in the same workflow.
4. For UI dev, use either `npm run dev` or Docker only.

## Update fails at build: Docker Hub timeout (Mac / localhost)

**Symptoms:** CRM update in Dashboard reaches **Build** and fails; job log shows `DeadlineExceeded`, `registry-1.docker.io`, `failed to resolve source metadata`, or exit code 1. GitHub (source fetch) succeeds.

**Cause:** Docker on Mac cannot pull base images (`node:20-alpine`, `nginx:alpine`) from Docker Hub in time — network, VPN, Docker Desktop DNS, or registry blocking. This is **not a CRM logic bug**; on a server with normal Hub access (e.g. 192.168.1.151) the same release builds fine.

**Diagnose on the host:**

```bash
docker pull node:20-alpine
docker pull nginx:alpine
```

If these hang or fail with `DeadlineExceeded`, the issue is Docker Hub access, not WASH.

**What to do:**

1. Check internet; disable or change VPN if it blocks `registry-1.docker.io`.
2. Docker Desktop → Settings → Docker Engine — for DNS issues, temporarily add `"dns": ["8.8.8.8", "1.1.1.1"]` and restart Docker.
3. After successful `docker pull`, retry update from Dashboard (**Settings → Software updates**).
4. For UI dev without full rebuild: `cd dashboard && npm run dev` (port 5173).
5. Manual build on host (when pull works):

```bash
cd /path/to/WASH-PRO-CRM
git fetch origin && git checkout v1.1.51
docker compose up -d --build dashboard update-bridge
```

**v1.1.25:** `update-bridge` shows a clear message instead of raw log tail on Hub timeout.

## “/deploy is not a git repository” in integrity (v1.1.21+)

**Symptoms:** warning “/deploy is not a git repository” or “Git in /deploy unavailable” despite `git clone` install.

**Cause:** Git 2.35+ **dubious ownership** — host `.git` owned by a different user than `update-bridge` in the container (root). The repo **exists**; the check was wrong.

**Fix (v1.1.21+):** `update-bridge` registers `safe.directory /deploy` on startup; integrity check does the same. Or manually:

```bash
docker exec wash-update-bridge git config --global --add safe.directory /deploy
```

**Without `.git` on the host** (file copy without clone) — Dashboard auto-update **will not work**; use `git clone` or manual updates.

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

1. **Dashboard → Publications** — status **Published** (not "Draft")
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

MongoDB and other service data in `DATA_DIR` (default `./data`), see [data/README.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/data/README.md).

## Help

1. `docker compose logs > logs.txt`
2. GitHub issue with `APP_VERSION`, `docker compose ps`, reproduction steps
