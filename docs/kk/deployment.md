---
layout: default
title: Орналастыру
description: Production, жаңарту және қалпына келтіру
---

## Production checklist

1. `.env` ішіндегі барлық секреттерді өзгертіңіз (JWT, CSRF, парольдер, PyOrch keys)
2. Күшті `ADMIN_PASSWORD` және `system` үшін **`MQTT_PASSWORD`** орнатыңыз (CRM-де баптауға дейін)
3. Нақты домендерге сәйкес `CORS_ORIGIN` баптаңыз
4. 80, 3001, 8080 порттарын (PyOrch болса 8000, 8090, 8010) файрволмен шектеңіз
5. Қажетсіз болса MongoDB және Mosquitto жарияламаңыз
6. `BACKUP_CRON` баптап, қалпына келтіруді тексеріңіз

## Іске қосу

```bash
./scripts/start.sh
```

Скрипт `.env` айнымалыларына қарай overlay-лерді қосады: Redis, external MQTT, PyOrchestrator.

## Жаңарту

### Dynamic API Platform (vendored v1.5.13)

```bash
./scripts/update-dynamic-api.sh
docker compose up -d --build dynamic-api dynamic-api-panel
./scripts/run-init-seed.sh   # CRM-схема өзгергенде
```

> WASH-та `:8080` панеліндегі in-app updater **өшірілген** (`UPDATE_EXECUTOR_ENABLED=false`). Жаңарту скриптін қолданыңыз.

### PyOrchestrator (vendored v0.1.10, опционалды)

```bash
./scripts/update-pyorchestrator.sh
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build pyorch-backend pyorchestrator-panel pyorch-bridge
```

### Dashboard және bridge

```bash
docker compose up -d --build dashboard pyorch-bridge
```

### Бүкіл стек

```bash
docker compose up -d --build
# немесе PyOrch-пен:
PYORCHESTRATOR_ENABLED=true ./scripts/start.sh
```

Деректер хост дискісіндегі `DATA_DIR` каталогында (әдепкі `./data`), Docker volumes емес. Образдарды қайта құрастыру және `docker compose down` бұл каталогты **жоймайды**. Толығырақ: [data/README.md](../data/README.md).

Ескі named volumes-тан көшіру (бір рет):

```bash
./scripts/migrate-volumes-to-data.sh
./scripts/start.sh
```

## Бэкаптан қалпына келтіру

```bash
./scripts/restore.sh wash-pro-crm-2024-06-22T02-00-00.archive.gz
```

Немесе Dashboard → **Резервтік көшірмелер**.

## GitHub Pages

1. **Settings → Pages → GitHub Actions**
2. `docs/_config.yml`: `url` және `baseurl`
3. `main`-ға push → `.github/workflows/pages.yml` workflow

## Reverse proxy (TLS)

Dashboard мысалы:

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

Қажет болса `:3001`, `:8080`, `:8090` үшін бөлек блоктар.

## Мониторинг

```bash
docker compose ps
docker logs -f wash-dynamic-api
docker logs -f wash-message-processor
docker logs -f wash-pyorch-bridge    # PyOrch болса
curl -s http://localhost:3001/api/health | jq
curl -s http://localhost/api/telegram-bots/health | jq   # Dashboard nginx арқылы
```

PyOrchestrator Observability: `PYORCH_OBSERVABILITY_ENABLED=true` → Grafana `:3000`, Prometheus `:9090`.

## Телеметрия компоненттерін жаңарту

`message-processor` немесе Dashboard прокси өзгергеннен кейін:

```bash
docker compose up -d --build message-processor dashboard
```

Пост басқару HTTP API тексеруі (JWT қажет):

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer TOKEN" \
  http://localhost/api/crm/post-device/posts/SERIAL/command
# денесіз 404 — қалыпты; 401 — токен жоқ; 400/500 — жауап денесін қараңыз
```
