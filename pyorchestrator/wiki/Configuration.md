Все переменные — в `.env` (см. `.env.example`).

## Приложение

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `APP_ENV` | `development` | Окружение |
| `APP_VERSION` | `0.1.0` | Версия в API |

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

## Grafana

| Переменная | По умолчанию |
|------------|--------------|
| `GRAFANA_ADMIN_USER` | `admin` |
| `GRAFANA_ADMIN_PASSWORD` | `admin` |

Provisioning: `infrastructure/grafana/provisioning/`
