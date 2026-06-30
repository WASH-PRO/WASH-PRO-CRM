---
layout: default
title: Дорожная карта
description: План развития PyOrchestrator — фазы MVP и Production
---

## Статус v0.1.0

**Релиз опубликован:** [v0.1.0](https://github.com/PyOrchestrator/PyOrchestrator/releases/tag/v0.1.0) (27 июня 2026) · [заметки о выпуске]({{ '/release-notes/' | relative_url }})

| Фаза | Статус | Примечания |
|------|--------|------------|
| MVP-0 Foundation | ✅ | Compose, auto-migrate БД, health, Prometheus/Grafana/Loki, CI |
| MVP-1 Script CRUD + Run | ✅ | CRUD, run/stop, logs WS, import/export, шаблоны |
| MVP-2 Scheduler + Dashboard | ✅ | Cron/interval, KPI dashboard, webhooks |
| MVP-3 Editor + RBAC | ✅ | Monaco editor, JWT auth, 4 роли, группы |
| Production-1 | ✅ | Vault секретов, уведомления, бэкапы |
| Production-2 | ✅ | OTA stub, UpdateProvider, multi-runtime compose prod, метрики |
| Production-3 | 🔜 | MQTT, HA Postgres, продвинутая изоляция — backlog |

---

## Обзор фаз

| Фаза | Цель | Срок (оценка) | Результат |
|------|------|---------------|-----------|
| **MVP-0** | Foundation | 2 недели | Compose up, health checks, пустая UI-оболочка |
| **MVP-1** | Script CRUD + Run | 3 недели | Создание/редактирование/запуск скриптов, базовые логи |
| **MVP-2** | Scheduler + Dashboard | 3 недели | Cron, KPI-карточки, история runs |
| **MVP-3** | Editor + Groups | 2 недели | Monaco multi-file, группы, базовый RBAC |
| **Production-1** | Hardening | 4 недели | Секреты, уведомления, бэкапы |
| **Production-2** | Scale + OTA | 4 недели | Multi-runtime, OTA, полный RBAC |
| **Production-3** | Enterprise | ongoing | MQTT, продвинутая изоляция, HA Postgres |

---

## MVP-0 — Foundation (недели 1–2)

### Цели
- Стек Docker Compose стартует одной командой
- Backend подключается к Postgres + Redis + MinIO
- Frontend отдаёт страницу входа
- Runtime и Scheduler стартуют и отчитываются по health

### Результаты
- [x] Структура проекта и документация по архитектуре
- [ ] `docker compose up` — все сервисы healthy
- [ ] Alembic initial migration (users, scripts, runs)
- [ ] `GET /health`, `GET /api/v1/system/info`
- [ ] Prometheus скрейпит backend + runtime `/metrics`
- [ ] Grafana с заготовкой system dashboard
- [ ] CI: lint + сборка образов

### Критерий выхода
Все контейнеры проходят healthcheck; API возвращает 200 на `/health`.

---

## MVP-1 — Управление скриптами и выполнение (недели 3–5)

### Цели
- Полный жизненный цикл скрипта без рестарта системы
- Однофайловые скрипты в sandbox с timeout и лимитом памяти

### Функции
| Функция | Приоритет |
|---------|-----------|
| Создание / редактирование / удаление скрипта | P0 |
| Включение / отключение скрипта | P0 |
| Ручной run / stop | P0 |
| Стрим логов (WebSocket) | P0 |
| Список истории runs | P0 |
| Копирование скрипта | P1 |
| Import / export (zip) | P1 |
| Базовые шаблоны (3 системных) | P1 |

### Runtime (scope MVP)
- Subprocess + выделенный workspace
- `RLIMIT_CPU`, `RLIMIT_AS`, wall-clock timeout
- venv на скрипт из `requirements.txt`
- Захват stdout/stderr → Redis stream → WS

### API endpoints
```
POST   /api/v1/scripts
GET    /api/v1/scripts
GET    /api/v1/scripts/{id}
PUT    /api/v1/scripts/{id}
DELETE /api/v1/scripts/{id}
POST   /api/v1/scripts/{id}/run
POST   /api/v1/scripts/{id}/stop
GET    /api/v1/scripts/{id}/runs
GET    /api/v1/runs/{id}/logs
WS     /ws/runs/{id}
```

### Критерий выхода
Пользователь создаёт скрипт в UI, запускает, видит логи и статус success/fail.

---

## MVP-2 — Планировщик и мониторинг (недели 6–8)

### Цели
- Cron и interval-расписания
- Dashboard с KPI-карточками и базовыми графиками

### Функции
| Функция | Приоритет |
|---------|-----------|
| Cron-расписания | P0 |
| Interval-расписания | P0 |
| Max concurrent runs на скрипт | P0 |
| Окно start/end date | P1 |
| Webhook-триггер (статический token) | P1 |
| KPI-карточки dashboard | P0 |
| Графики CPU / memory (Grafana embed) | P0 |
| Runs per day chart | P1 |
| Ошибки за 24 ч | P0 |
| Панель статуса по скриптам | P0 |

### Сервис scheduler
- APScheduler с Redis job store (общее состояние)
- Публикация в `runtime:jobs` при срабатывании
- Reload по pub/sub `scheduler:reload`

### Критерий выхода
Скрипт запускается по cron без ручного действия; dashboard показывает live-метрики.

---

## MVP-3 — Редактор, группы и RBAC (недели 9–10)

### Цели
- Редактор кода production-уровня
- Организация скриптов в группы
- Четыре роли с правами в scope группы

### Функции
| Функция | Приоритет |
|---------|-----------|
| Monaco editor, Python syntax | P0 |
| Multi-file дерево проекта | P0 |
| Редактор `requirements.txt` | P0 |
| Проверка синтаксиса (ast.parse) | P1 |
| Форматирование (black, опционально) | P2 |
| Поиск по проекту | P1 |
| CRUD групп с color/icon | P0 |
| Роли: Admin, Developer, Operator, Viewer | P0 |
| JWT auth + страница входа | P0 |

### Критерий выхода
Developer редактирует multi-file бота в группе «bots», Operator может запускать, но не редактировать.

---

## Production-1 — Безопасность, секреты и уведомления (недели 11–14)

### Цели
- Vault секретов, каналы уведомлений, backup/restore

### Функции
| Функция | Приоритет |
|---------|-----------|
| Секреты на скрипт (шифрование) | P0 |
| SDK `platform.secrets.get()` | P0 |
| Email-уведомления | P1 |
| Telegram-уведомления | P1 |
| Webhook-уведомления | P0 |
| In-app уведомления | P0 |
| Ручной бэкап | P0 |
| Бэкап по расписанию | P1 |
| Restore из бэкапа | P0 |
| Export/import полной конфигурации | P1 |
| Audit log | P1 |
| Run по событию script-complete | P1 |
| API-триггер с auth | P0 |

### Критерий выхода
Секреты не видны в коде; бэкап восстанавливает скрипты + БД на чистой установке.

---

## Production-2 — Масштаб, OTA и продвинутый runtime (недели 15–18)

### Цели
- Горизонтальное масштабирование runtime
- Фреймворк OTA-обновлений
- Детальные метрики на run

### Функции
| Функция | Приоритет |
|---------|-----------|
| Несколько реплик runtime (Redis queue) | P0 |
| Интерфейс `UpdateProvider` | P0 |
| Заглушка `GitHubUpdateProvider` | P0 |
| OTA UI: check, apply, rollback | P0 |
| Автобэкап перед обновлением | P0 |
| Сэмплирование CPU/memory/threads на run | P0 |
| Лимиты cgroup v2 (Linux) | P1 |
| Квоты хранилища на скрипт | P1 |
| API temp vs persistent storage | P1 |
| MQTT client в SDK | P2 |
| Дерево зависимостей в UI | P2 |

### Критерий выхода
2 контейнера runtime обрабатывают общую очередь; OTA apply + rollback проверены на staging.

---

## Production-3 — Enterprise и HA (ongoing)

### Backlog
- Репликация Postgres / managed DB
- Network namespace isolation на sandbox
- SSO (OIDC/SAML)
- Multi-tenancy
- Кастомные Grafana dashboard на группу
- Marketplace скриптов / общие шаблоны
- Git sync исходников скриптов
- Canary runs / dry-run mode
- SLA alerting

---

## Реестр рисков

| Риск | Митигация |
|------|-----------|
| Медленная сборка venv для многих скриптов | Lazy build, кэш venv, общие базовые пакеты |
| Утечка памяти в user script | Subprocess на run + жёсткий memory cap + kill |
| Drift scheduler | Redis distributed lock; один leader scheduler в MVP |
| Объём логов | Retention Loki; пагинированный API; опционально S3 cold storage |
| Утечка секретов | Не возвращать расшифрованные секреты через API; аудит доступа |

---

## Матрица MVP vs Production

| Возможность | MVP | Production |
|-------------|-----|------------|
| Script CRUD | ✅ | ✅ |
| Multi-file проекты | ✅ (MVP-3) | ✅ |
| Изоляция sandbox | Базовые rlimits | + cgroups, опционально netns |
| Cron / interval | ✅ | ✅ |
| Event / chain triggers | ❌ | ✅ |
| Webhook trigger | Базовый | ✅ + rate limits |
| RBAC | ✅ (MVP-3) | ✅ + audit |
| Vault секретов | ❌ | ✅ |
| Уведомления | ❌ | ✅ |
| Бэкапы | ❌ | ✅ |
| OTA updates | ❌ | ✅ |
| Multi-runtime | ❌ | ✅ |
| Prometheus/Grafana | Базовый | Полные дашборды |
| MQTT | ❌ | ✅ |

---

## Рекомендуемый порядок спринтов (первые 10 недель)

```
Sprint 1: Compose, миграции БД, health, каркас auth
Sprint 2: Script CRUD API + хранение файлов MinIO
Sprint 3: Runtime sandbox v1 + ручной run + logs WS
Sprint 4: Frontend список скриптов + панель run
Sprint 5: Scheduler cron + interval
Sprint 6: Dashboard KPI + панели Grafana
Sprint 7: Monaco editor + file tree
Sprint 8: Группы + enforcement RBAC
Sprint 9: Import/export + шаблоны
Sprint 10: Hardening, docs, релиз MVP v0.1.0
```
