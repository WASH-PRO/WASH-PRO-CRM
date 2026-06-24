<p align="center">
  <img src="docs/assets/banner.png" alt="WASH PRO CRM / SCADA" width="100%">
</p>

<p align="center">
  <a href="https://github.com/Developer-RU/WASH-PRO-CRM/actions/workflows/pages.yml"><img src="https://github.com/Developer-RU/WASH-PRO-CRM/actions/workflows/pages.yml/badge.svg" alt="GitHub Pages"></a>
  <a href="https://developer-ru.github.io/WASH-PRO-CRM/"><img src="https://img.shields.io/badge/Docs-GitHub_Pages-14b8a6?style=flat-square&logo=github&logoColor=white" alt="Documentation"></a>
  <img src="https://img.shields.io/badge/version-1.0.0-0d9488?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/MongoDB-7-47A248?style=flat-square&logo=mongodb&logoColor=white" alt="MongoDB">
  <img src="https://img.shields.io/badge/RabbitMQ-Telemetry-FF6600?style=flat-square&logo=rabbitmq&logoColor=white" alt="RabbitMQ">
  <a href="https://github.com/Dynamic-API-Platform/Dynamic-API-Platform"><img src="https://img.shields.io/badge/Dynamic_API-v1.5.6-3b82f6?style=flat-square" alt="Dynamic API Platform v1.5.6"></a>
  <img src="https://img.shields.io/badge/License-Proprietary-red?style=flat-square" alt="License">
</p>

<p align="center">
  Локальная CRM/SCADA-система для автомоек самообслуживания на базе
  <a href="https://github.com/Dynamic-API-Platform/Dynamic-API-Platform">Dynamic API Platform</a>
</p>

<p align="center">
  <a href="https://developer-ru.github.io/WASH-PRO-CRM/"><strong>Документация</strong></a>
  ·
  <a href="docs/getting-started.md">Быстрый старт</a>
  ·
  <a href="docs/architecture.md">Архитектура</a>
  ·
  <a href="https://github.com/Developer-RU/WASH-PRO-CRM/issues">Issues</a>
</p>

---

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
git clone https://github.com/Developer-RU/WASH-PRO-CRM.git
cd WASH-PRO-CRM
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
WASH-PRO-CRM/
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
# Обновить встроенную Dynamic API Platform (v1.5.6+)
./scripts/update-dynamic-api.sh
docker compose up -d --build dynamic-api dynamic-api-panel

# Пересобрать весь стек
docker compose up -d --build

./scripts/restore.sh wash-pro-crm-2024-06-22T02-00-00.archive.gz
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

WASH PRO CRM — проприетарный проект.  
[Dynamic API Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform) — Apache License 2.0.
