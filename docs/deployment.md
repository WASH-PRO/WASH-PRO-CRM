---
layout: default
title: Развёртывание
description: Production, обновление и восстановление
---

## Production checklist

1. Смените все секреты в `.env` (JWT, CSRF, пароли)
2. Задайте сильный пароль администратора (`ADMIN_PASSWORD`)
3. Настройте `CORS_ORIGIN` под реальные домены Dashboard и API
4. Ограничьте доступ к портам 80, 3001, 8080 файрволом / reverse proxy
5. Не публикуйте MongoDB и RabbitMQ наружу без необходимости
6. Настройте регулярные бэкапы (`BACKUP_CRON`, `BACKUP_RETENTION_COUNT`)

## Запуск

```bash
./scripts/start.sh
```

Или вручную:

```bash
docker compose up -d --build
```

## Обновление

### Dynamic API Platform (vendored)

```bash
./scripts/update-dynamic-api.sh
docker compose up -d --build dynamic-api dynamic-api-panel
./scripts/run-init-seed.sh   # при изменениях схемы API
```

Актуальная версия встроенной платформы: **v1.5.6** (см. `dynamic-api/CHANGELOG.md`).

> **Важно:** в панели Dynamic API (`:8080`) может отображаться раздел Software Updates. В WASH-PRO-CRM in-app updater **отключён** — он предназначен для standalone-развёртывания. Используйте `./scripts/update-dynamic-api.sh` в корне репозитория.

### Весь стек WASH-PRO-CRM

```bash
docker compose up -d --build
```

Данные сохраняются в Docker volumes и не теряются при пересборке.

## Восстановление из бэкапа

```bash
./scripts/restore.sh wash-pro-crm-2024-06-22T02-00-00.archive.gz
```

Список бэкапов доступен в Dashboard → **Резервные копии** или в volume `wash_backup_data`.

## GitHub Pages (документация)

Документация в папке `docs/` публикуется через GitHub Actions.

1. В репозитории: **Settings → Pages → Build and deployment → GitHub Actions**
2. В `docs/_config.yml` замените `url` и `baseurl` на ваши значения:
   - `url: https://Developer-RU.github.io`
   - `baseurl: /WASH-PRO-CRM`
3. Push в ветку `main` — workflow `.github/workflows/pages.yml` задеплоит сайт

## Reverse proxy (опционально)

Пример nginx для Dashboard с TLS:

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

Для API и панели Dynamic API — отдельные `server` блоки на порты 3001 и 8080.

## Мониторинг

```bash
docker compose ps
docker logs -f wash-dynamic-api
docker logs -f wash-message-processor
curl -s http://localhost:3001/api/health | jq
```
