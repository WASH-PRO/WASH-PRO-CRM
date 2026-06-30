## Требования

- Docker 24+ и Docker Compose v2
- 4 GB RAM (рекомендуется 8 GB с observability-стеком)
- Linux или macOS (cgroups для runtime — опционально)

## Установка

```bash
git clone https://github.com/Developer-RU/pyorchestrator.git
cd pyorchestrator
cp .env.example .env
docker compose up --build
```

Первый запуск занимает несколько минут: сборка образов, инициализация PostgreSQL, MinIO, seed демо-скриптов.

## Вход в систему

| Поле | Значение по умолчанию |
|------|------------------------|
| Email | `admin@pyorchestrator.local` |
| Пароль | `admin` |

После входа откройте **Скрипты** — будут загружены демо-объекты (Weather, Crypto, DAP API Poster и др.).

## Первый запуск скрипта

1. Откройте любой скрипт → **Редактор**
2. Нажмите **Run** — внизу появится live-вывод
3. **Stop** — остановка sandbox через Redis control channel

## Сервисы и порты

| Сервис | Порт | Назначение |
|--------|------|------------|
| frontend | 5173 | React UI (dev) |
| backend | 8000 | REST API |
| postgres | 5432 | Метаданные |
| redis | 6379 | Очередь jobs |
| minio | 9000 / 9001 | S3 API / Console |
| grafana | 3000 | Дашборды |
| prometheus | 9090 | Метрики |
| mcp | 8010 | MCP HTTP |

Порты настраиваются в `.env` — см. [Конфигурация](/configuration/).

## Production

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Подробнее: [Развёртывание](/deployment/).

## MCP для Cursor

```bash
cd mcp && pip install -e .
```

Добавьте в Cursor Settings → MCP конфиг из `mcp/cursor-mcp.example.json`.

Подробнее: [MCP](/mcp/).

## Дальше

- [Архитектура](/architecture/)
- [Панель управления](/control-plane/)
- [Безопасность](/security/)
