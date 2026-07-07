Все переменные — в `.env` (см. `.env.example`).

## Приложение

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `APP_ENV` | `development` | Окружение |
| `APP_VERSION` | `0.1.13` | Версия в API |

## Безопасность

| Переменная | Описание |
|------------|----------|
| `SECRET_MASTER_KEY` | AES-ключ для секретов скриптов (32+ символов) |
| `JWT_SECRET` | Подпись JWT |
| `INTERNAL_API_KEY` | Auth runtime → backend internal API |
| `CORS_ORIGINS` | Разрешённые origins UI |

## База данных

| Переменная | По умолчанию |
|------------|--------------|
| `POSTGRES_DB` | `pyorchestrator` |
| `POSTGRES_USER` | `pyorch` |
| `POSTGRES_PASSWORD` | `pyorch_secret` |
| `POSTGRES_PORT` | `5432` |

## Runtime

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `MAX_CONCURRENT_SANDBOXES` | `50` | Параллельные sandbox |
| `DEFAULT_MAX_MEMORY_MB` | `512` | Лимит RAM sandbox |
| `DEFAULT_MAX_CPU_SECONDS` | `300` | Лимит CPU time |
| `DEFAULT_WALL_TIMEOUT_SEC` | `3600` | Wall timeout |
| `RUNTIME_REPLICAS` | `1` | Реплики в prod |

## Frontend

| Переменная | Описание |
|------------|----------|
| `VITE_API_URL` | URL backend для браузера |
| `VITE_WS_URL` | URL WebSocket |
| `FRONTEND_TARGET` | `development` \| `production` |

## MCP

| Переменная | По умолчанию |
|------------|--------------|
| `MCP_PORT` | `8010` |
| `MCP_PYORCH_EMAIL` | email admin |
| `MCP_PYORCH_PASSWORD` | пароль admin |

## Лимиты на скрипт

В UI при создании/редактировании скрипта:

- `max_concurrent_runs` — макс. параллельных runs
- `max_runtime_seconds` — макс. время выполнения
- `max_memory_bytes` — лимит памяти
- `storage_quota_bytes` — квота хранилища

## MinIO

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `MINIO_ACCESS_KEY` | `minioadmin` | S3 access key |
| `MINIO_SECRET_KEY` | `minioadmin` | S3 secret key |
| `MINIO_BUCKET` | `pyorchestrator` | Bucket для workspaces |
| `MINIO_PORT` | `9000` | S3 API |
| `MINIO_CONSOLE_ENABLED` | `false` | Веб-консоль MinIO (порт 9001); S3 API работает без неё |
| `MINIO_CONSOLE_PORT` | `9001` | Порт консоли (если включена) |
| `MINIO_CONSOLE_PUBLIC_URL` | *(пусто — `http://localhost:{MINIO_CONSOLE_PORT}`)* | Публичная ссылка на консоль |

При `MINIO_CONSOLE_ENABLED=false` ссылка на веб-консоль MinIO не попадает в `/api/v1/system/info` и скрывается на странице System.

## Grafana и наблюдаемость

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `GRAFANA_PUBLIC_URL` | *(пусто — ссылка в UI скрыта)* | Ссылка на Grafana в панели |
| `GRAFANA_INTERNAL_URL` | `http://grafana:3000` | URL для health-check из backend |
| `GRAFANA_ADMIN_USER` | `admin` | Логин Grafana |
| `GRAFANA_ADMIN_PASSWORD` | `admin` | Пароль Grafana |

Панель **Observability** на дашборде показывается только если Grafana доступна: backend проверяет `/api/health` по `GRAFANA_INTERNAL_URL`, а ссылку отдаёт из `GRAFANA_PUBLIC_URL` (или internal URL, если public не задан).

Provisioning: `infrastructure/grafana/provisioning/`

## OTA-обновления

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `GITHUB_UPDATE_REPO` | `PyOrchestrator/PyOrchestrator` | Репозиторий релизов |
| `UPDATE_EXECUTOR_ENABLED` | `true` | Docker-исполнитель обновлений |
| `UPDATE_DEPLOY_MODE` | `docker` | Режим деплоя (`docker`) |
| `PYORCH_HOST_PROJECT_ROOT` | _(авто)_ | Путь к проекту на хосте; определяется автоматически |

Обновление: **Настройки → Обновления ПО** в панели управления.
