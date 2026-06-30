Базовый URL: `http://localhost:8000/api/v1`

Интерактивная документация: **http://localhost:8000/docs** (Swagger UI)

## Аутентификация

```http
POST /api/v1/auth/login
Content-Type: application/json

{"email": "admin@pyorchestrator.local", "password": "admin"}
```

Ответ: `{ "access_token": "...", "token_type": "bearer" }`

Далее в заголовках: `Authorization: Bearer <token>`

## Скрипты

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/scripts` | Список скриптов |
| POST | `/scripts` | Создать |
| GET | `/scripts/{id}` | Получить |
| PATCH | `/scripts/{id}` | Обновить |
| DELETE | `/scripts/{id}` | Удалить |
| GET | `/scripts/{id}/files` | Список файлов |
| PUT | `/scripts/{id}/files/{path}` | Сохранить файл |

## Запуски (runs)

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/runs/scripts/{id}/run` | Поставить в очередь |
| POST | `/runs/scripts/{id}/stop` | Остановить running/queued |
| GET | `/runs/scripts/{id}/runs` | История |
| GET | `/runs/{run_id}` | Статус run |
| GET | `/runs/{run_id}/logs` | Логи |

## Расписания и вебхуки

| Метод | Путь | Описание |
|-------|------|----------|
| GET/POST | `/schedules` | Список / создание |
| PATCH/DELETE | `/schedules/{id}` | Изменение / удаление |
| GET/POST | `/webhooks` | Список / создание |
| POST | `/hooks/{token}` | Публичный вызов webhook |

## Система

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/system/info` | Информация о системе |
| GET | `/mcp/info` | Статус MCP-сервера |
| GET | `/dashboard/stats` | KPI dashboard |
| GET | `/dashboard/timeseries` | Временные ряды для графиков |

## WebSocket

```
ws://localhost:8000/ws/runs/{run_id}
```

Поток логов в реальном времени (JWT в соединении или cookie — зависит от развёртывания).

## Метрики

Prometheus: `http://localhost:8000/metrics` (backend), runtime `:9093`
