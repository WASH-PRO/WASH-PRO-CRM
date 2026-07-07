---
layout: default
title: Развёртывание
description: Production, обновление и восстановление
---

## Production checklist

1. Смените все секреты в `.env` (JWT, CSRF, пароли, PyOrch keys)
2. Задайте сильный `ADMIN_PASSWORD` и **`MQTT_PASSWORD`** для `system` (до настройки в CRM)
3. Настройте `CORS_ORIGIN` под реальные домены
4. Ограничьте порты 80, 3001, 8080 (и 8000, 8090, 8010 при PyOrch) файрволом
5. Не публикуйте MongoDB и Mosquitto без необходимости
6. Настройте `BACKUP_CRON` и проверьте восстановление

## Запуск

```bash
./scripts/start.sh
```

Скрипт подключает overlays: Redis, external MQTT, PyOrchestrator — по переменным в `.env`.

## Обновление

### Dynamic API Platform (vendored v1.5.13)

```bash
./scripts/update-dynamic-api.sh
docker compose up -d --build dynamic-api dynamic-api-panel
./scripts/run-init-seed.sh   # при изменениях CRM-схемы
```

> In-app updater в панели `:8080` **отключён** в WASH (`UPDATE_EXECUTOR_ENABLED=false`). Используйте скрипт обновления.

### PyOrchestrator (vendored v0.1.10, опционально)

```bash
./scripts/update-pyorchestrator.sh
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build pyorch-backend pyorchestrator-panel pyorch-bridge
```

### Dashboard и bridge

```bash
docker compose up -d --build dashboard pyorch-bridge
```

### Весь стек

```bash
docker compose up -d --build
# или с PyOrch:
PYORCHESTRATOR_ENABLED=true ./scripts/start.sh
```

Данные хранятся на диске хоста в каталоге `DATA_DIR` (по умолчанию `./data`), а не в Docker volumes. Пересборка образов и `docker compose down` **не удаляют** этот каталог. Подробнее: [data/README.md](../data/README.md).

Миграция со старых named volumes (однократно):

```bash
./scripts/migrate-volumes-to-data.sh
./scripts/start.sh
```

## Восстановление из бэкапа

```bash
./scripts/restore.sh wash-pro-crm-2024-06-22T02-00-00.archive.gz
```

Или Dashboard → **Резервные копии**.

## GitHub Pages

1. **Settings → Pages → GitHub Actions**
2. `docs/_config.yml`: `url` и `baseurl`
3. Push в `main` → workflow `.github/workflows/pages.yml`

## Reverse proxy (TLS)

Пример для Dashboard:

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

Отдельные блоки для `:3001`, `:8080`, `:8090` при необходимости.

## Мониторинг

```bash
docker compose ps
docker logs -f wash-dynamic-api
docker logs -f wash-message-processor
docker logs -f wash-pyorch-bridge    # если PyOrch
curl -s http://localhost:3001/api/health | jq
curl -s http://localhost/api/telegram-bots/health | jq   # через Dashboard nginx
```

Observability PyOrchestrator: `PYORCH_OBSERVABILITY_ENABLED=true` → Grafana `:3000`, Prometheus `:9090`.

## Обновление компонентов телеметрии

После изменений в `message-processor` или прокси Dashboard:

```bash
docker compose up -d --build message-processor dashboard
```

Проверка HTTP API управления постом (нужен JWT):

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer TOKEN" \
  http://localhost/api/crm/post-device/posts/SERIAL/command
# 404 без тела — норма; 401 — нет токена; 400/500 — см. тело ответа
```
