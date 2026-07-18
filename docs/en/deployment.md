---
layout: default
title: Deployment
description: Deploy WASH PRO CRM in production — updates, backups, restore procedures, host paths, and recommended Docker Compose setup.
---

## Production checklist

1. Change all secrets in `.env` (JWT, CSRF, passwords, PyOrch keys)
2. Set strong `ADMIN_PASSWORD` and **`MQTT_PASSWORD`** for `system` (before CRM configuration)
3. Configure `CORS_ORIGIN` for real domains
4. Restrict ports 80, 3001, 8080 (and 8000, 8090, 8010 with PyOrch) with firewall
5. Do not publish MongoDB and Mosquitto unless necessary
6. Configure `BACKUP_CRON` and verify restore

## Startup

```bash
./scripts/start.sh
```

The script attaches overlays: Redis, external MQTT, PyOrchestrator, **`docker-compose.override.yml`** (if present) — based on `.env` variables.

## Server-local overrides (production)

On a specific host (external disk for `DATA_DIR`, CPU without AVX, PyOrchestrator patches):

```env
# example: data on a dedicated HDD
DATA_DIR=/mnt/hdd/data
```

Absolute host paths outside `/deploy` are **valid**; the integrity wizard *(v1.1.19+)* does not flag them as suspicious.

```bash
cp docker-compose.override.yml.example docker-compose.override.yml
mkdir -p local && cp local/apply-server-patches.sh.example local/apply-server-patches.sh
chmod +x local/apply-server-patches.sh
```

Files are **not committed** — they do not block Dashboard auto-update `git pull`. See [Troubleshooting](troubleshooting.md).

## Updates

### Dynamic API Platform (vendored v1.5.13)

```bash
./scripts/update-dynamic-api.sh
docker compose up -d --build dynamic-api dynamic-api-panel
./scripts/run-init-seed.sh   # if CRM schema changed
```

> In-app updater in panel `:8080` is **disabled** in WASH (`UPDATE_EXECUTOR_ENABLED=false`). Use the update script.

### PyOrchestrator (vendored v0.1.13, optional)

```bash
./scripts/update-pyorchestrator.sh
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build pyorch-backend pyorchestrator-panel pyorch-bridge
```

### Dashboard and bridge

```bash
docker compose up -d --build dashboard pyorch-bridge
```

### Full stack

```bash
docker compose up -d --build
# or with PyOrch:
PYORCHESTRATOR_ENABLED=true ./scripts/start.sh
```

Data is stored on the host disk in `DATA_DIR` (default `./data`), not in Docker volumes. Image rebuild and `docker compose down` **do not delete** this directory. Details: [data/README.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/data/README.md).

One-time migration from old named volumes:

```bash
./scripts/migrate-volumes-to-data.sh
./scripts/start.sh
```

## Restore from backup

```bash
./scripts/restore.sh wash-pro-crm-2024-06-22T02-00-00.archive.gz
```

Or Dashboard → **Backups**.

### Full backup bundle (v1.1.44)

When enabled in **Settings → Backups** (`fullBundle`), each run also creates `*-extras.tar.gz` with CRM settings JSON and `modules/installed/*/data/`. Download both files from **Backups** if you need settings and module state beyond MongoDB.

## GitHub Pages

1. **Settings → Pages → GitHub Actions**
2. `docs/_config.yml`: `url` and `baseurl`
3. Push to `main` → workflow `.github/workflows/pages.yml`

## Reverse proxy (TLS)

Example for Dashboard:

```nginx
server {
    listen 443 ssl;
    server_name crm.example.com;
    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Separate blocks for `:3001`, `:8080`, `:8090` if needed.

## Monitoring

```bash
docker compose ps
docker logs -f wash-dynamic-api
docker logs -f wash-message-processor
docker logs -f wash-pyorch-bridge    # if PyOrch
curl -s http://localhost:3001/api/health | jq
curl -s http://localhost/api/telegram-bots/health | jq   # via Dashboard nginx
```

PyOrchestrator observability: `PYORCH_OBSERVABILITY_ENABLED=true` → Grafana `:3000`, Prometheus `:9090`.

## Telemetry component updates

After changes in `message-processor` or Dashboard proxy:

```bash
docker compose up -d --build message-processor dashboard
```

Post control HTTP API check (JWT required):

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer TOKEN" \
  http://localhost/api/crm/post-device/posts/SERIAL/command
# 404 without body — normal; 401 — no token; 400/500 — see response body
```
