---
layout: default
title: Runtime и sandbox
description: Модель изоляции и жизненный цикл выполнения скриптов
---

## Принцип

Пользовательские скрипты **не получают отдельный Docker-контейнер**. Все runs выполняются как **изолированные subprocess** внутри сервиса `runtime`.

```
Runtime Engine
├── Redis BLPOP runtime:jobs
├── SandboxPool (semaphore max_concurrent)
│   └── Sandbox на каждый run
│       ├── venv (на workspace)
│       ├── subprocess python entrypoint
│       ├── RLIMIT_CPU / RLIMIT_AS
│       └── wall-clock timeout
└── POST /internal/runs/* → backend
```

## Жизненный цикл run

1. **Очередь** — backend создаёт `Run` (статус `queued`), кладёт job в Redis
2. **Старт** — runtime забирает job, вызывает `/internal/runs/start`
3. **Выполнение** — sandbox запускает `entrypoint` с секретами в env (`SECRET_*`)
4. **Логи** — stdout/stderr → WebSocket + PostgreSQL
5. **Завершение** — exit code, duration → `/internal/runs/complete`
6. **Остановка** — UI публикует `stop` в `run:{id}:control`, SIGTERM процессу

## Изоляция

| Слой | Механизм |
|------|----------|
| Процесс | `subprocess.Popen` |
| ФС | `/workspaces/{script_id}/{run_id}/` |
| Зависимости | `pip install -r requirements.txt` в локальный venv |
| CPU/память | `resource.setrlimit` |
| Время | `asyncio.wait_for` wall timeout |
| Секреты | Шифрование at rest, инъекция при run |

## Масштабирование

`docker compose -f docker-compose.prod.yml` — несколько реплик `runtime`, общая Redis-очередь.

## Горячая перезагрузка кода

Сохранение скрипта в UI → Redis `script:updated` → runtime инвалидирует кэш venv → следующий run с новым кодом **без перезапуска контейнеров**.
