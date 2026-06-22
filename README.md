# WASH PHO CRM / SCADA

Локальная CRM/SCADA-система для автомоек самообслуживания на базе [Dynamic API Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform).

📖 **[Документация](https://Developer-RU.github.io/WASH-PHO-CRM/)** · [Быстрый старт](docs/getting-started.md) · [Архитектура](docs/architecture.md)

## Возможности

- Управление автомойками и постами (серийный номер — у поста)
- SCADA: текущее состояние постов в реальном времени
- Карты клиентов, статистика использования и финансов
- Архивирование, резервное копирование MongoDB
- Telegram-бот и уведомления
- RBAC: Administrator / Operator / Viewer

## Архитектура

```
Контроллеры → RabbitMQ → Message Processor → Dynamic API → MongoDB
                                                      ↑
Dashboard (React) ──────────── nginx /api proxy ──────┘
                                                      ↑
                              Telegram Bot / Backup ──┘
```

| Сервис | Назначение | Порт |
|--------|------------|------|
| `dashboard` | CRM интерфейс | 80 |
| `dynamic-api` | REST API | 3001 |
| `dynamic-api-panel` | Панель Dynamic API | 8080 |
| `mongodb`, `rabbitmq`, … | Внутренние сервисы | — |

Подробнее: [docs/architecture.md](docs/architecture.md)

## Быстрый старт

### Требования

- Docker 24+, Docker Compose v2
- 4 GB RAM минимум

### Запуск

```bash
git clone https://github.com/Developer-RU/WASH-PHO-CRM.git
cd WASH-PHO-CRM
cp .env.example .env
# Измените JWT_SECRET, пароли!

chmod +x scripts/*.sh
./scripts/start.sh
```

| Интерфейс | URL |
|-----------|-----|
| Dashboard | http://localhost |
| Dynamic API Panel | http://localhost:8080 |
| API health | http://localhost:3001/api/health |

**Учётные данные по умолчанию:** `admin` / `Admin123!`

### Опции

```bash
# С Redis
REDIS_ENABLED=true docker compose -f docker-compose.yml -f docker-compose.redis.yml up -d --build

# RabbitMQ для контроллеров снаружи
RABBITMQ_EXTERNAL_PORT=5672 docker compose -f docker-compose.yml -f docker-compose.controllers.yml up -d --build
```

## Документация

Полная документация в папке [`docs/`](docs/) и на **GitHub Pages** (после настройки):

| Раздел | Описание |
|--------|----------|
| [Быстрый старт](docs/getting-started.md) | Установка и первый вход |
| [Архитектура](docs/architecture.md) | Сервисы и потоки данных |
| [Dashboard](docs/dashboard.md) | Модули веб-интерфейса |
| [RabbitMQ](docs/rabbitmq.md) | Интеграция контроллеров |
| [Схема данных](docs/database-schema.md) | CRM endpoints и MongoDB |
| [Развёртывание](docs/deployment.md) | Production и обновление |
| [Конфигурация](docs/configuration.md) | Переменные `.env` |
| [Безопасность](docs/security.md) | RBAC и рекомендации |
| [Устранение неполадок](docs/troubleshooting.md) | Типичные проблемы |

### Публикация GitHub Pages

1. **Settings → Pages → Build and deployment → GitHub Actions**
2. В [`docs/_config.yml`](docs/_config.yml) укажите `url` и `baseurl` вашего репозитория
3. Push в `main` — workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) опубликует сайт с боковым меню и гамбургером на мобильных

## Структура проекта

```
WASH-PHO-CRM/
├── docker-compose.yml
├── dynamic-api/              # Dynamic API Platform
├── dashboard/                # React CRM Dashboard
├── services/
│   ├── init-seed/            # CRM endpoints + RBAC
│   ├── message-processor/    # RabbitMQ → API
│   ├── backup/
│   └── telegram-bot/
├── config/rabbitmq/
├── scripts/
└── docs/                     # Документация (GitHub Pages)
```

## Обновление и бэкап

```bash
docker compose up -d --build
./scripts/restore.sh wash-crm-2024-06-22T02-00-00.archive.gz
```

## Устранение неполадок

| Проблема | Решение |
|----------|---------|
| init-seed `Exited (0)` | Норма — одноразовый контейнер |
| RabbitMQ `user 'wash'` | `./scripts/fix-rabbitmq.sh` |
| Нет CRM endpoints | `./scripts/run-init-seed.sh` |

Подробнее: [docs/troubleshooting.md](docs/troubleshooting.md)

## Безопасность

1. Смените все секреты в `.env` перед production
2. Наружу — только Dashboard и Dynamic API
3. MongoDB и RabbitMQ — внутренняя сеть Docker
4. RBAC через группы Dynamic API

## Лицензия

WASH PHO CRM — проприетарный проект.  
[Dynamic API Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform) — Apache License 2.0.
