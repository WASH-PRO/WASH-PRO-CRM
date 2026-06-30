## Контейнеры не стартуют

```bash
docker compose ps
docker compose logs backend
docker compose logs postgres
```

Проверьте занятость портов (`5173`, `8000`, `5432`).

## Скрипт не запускается

1. Статус скрипта — `enabled`?
2. Лимит `max concurrent runs` не исчерпан?
3. `docker compose logs runtime` — ошибки sandbox?
4. API: `GET /api/v1/runs/scripts/{id}/runs`

## Остановка не работает

- Run должен быть в статусе `running` или `queued`
- Проверьте Redis: backend и runtime в одной сети
- Логи backend на `POST /runs/scripts/{id}/stop`

## Frontend: не найден пакет recharts

```bash
docker compose exec frontend npm install
docker compose restart frontend
```

## MCP не подключается

```bash
curl -s http://localhost:8010/mcp
docker compose logs mcp
```

HTTP `406` — нормально (сервер отвечает).

## Grafana пустая

Provisioning datasource: `infrastructure/grafana/provisioning/`

Логин: `admin` / `admin` (или из `.env`).

## Сброс данных (dev)

```bash
docker compose down -v
docker compose up --build
```

**Удалит все данные PostgreSQL и MinIO.**

## Проверки health

| URL | Ожидаемый ответ |
|-----|-----------------|
| `http://localhost:8000/health` | `{"status":"ok"}` |
| `http://localhost:9091/health` | runtime |
| `http://localhost:9092/health` | scheduler |

## Логи

```bash
docker compose logs -f backend runtime scheduler
```

Loki: Grafana → Explore → источник Loki.
