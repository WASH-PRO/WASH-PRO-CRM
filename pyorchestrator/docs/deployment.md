---
layout: default
title: Развёртывание
description: Разработка и production через Docker Compose
---

## Разработка (по умолчанию)

```bash
cp .env.example .env
docker compose up --build
```

- Frontend: Vite dev server с hot reload (`FRONTEND_TARGET=development`)
- Backend: volume mount `./backend/app`
- Все порты опубликованы на localhost

## Production

```bash
cp .env.example .env
# отредактируйте секреты и пароли
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

`docker-compose.prod.yml`:

- Frontend — статическая сборка через nginx
- Runtime — `RUNTIME_REPLICAS` (по умолчанию 2)
- Postgres/Redis — только internal network
- Prometheus/Grafana — bind `127.0.0.1`

## Чеклист production

- [ ] Сменить `SECRET_MASTER_KEY`, `JWT_SECRET`, `INTERNAL_API_KEY`
- [ ] Сменить `POSTGRES_PASSWORD`, `MINIO_*`, `GRAFANA_ADMIN_PASSWORD`
- [ ] Сменить пароль admin-пользователя
- [ ] Настроить `CORS_ORIGINS` на реальный домен UI
- [ ] TLS termination (nginx/traefik перед frontend + API)
- [ ] Расписание бэкапов в UI
- [ ] Ограничить доступ к портам observability

## Обновление

### OTA из панели управления (рекомендуется)

1. **Настройки → Обновления ПО → Проверить**
2. **Обновить** — загрузка релиза с GitHub, пересборка Compose-стека

Требуется Docker socket в backend (`/var/run/docker.sock`) и доступ к GitHub Releases.

### Ручное обновление

```bash
git fetch --tags
git checkout v0.1.13   # или нужный тег
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## Ресурсы

| Профиль | CPU | RAM | Диск |
|---------|-----|-----|------|
| Минимальный | 2 | 4 GB | 20 GB |
| Рекомендуемый | 4 | 8 GB | 50 GB |
| Нагруженный (50+ параллельных sandbox) | 8+ | 16 GB | 100 GB |

## Публикация в GitHub Organization

1. Создайте org `pyorchestrator` (или своё имя)
2. Обновите `docs/_config.yml`: `url`, `baseurl`, `github_org`, `github_repo`
3. Settings → Pages → Source: **GitHub Actions**
4. Push в `main` — workflow `pages.yml` опубликует документацию
