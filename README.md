<p align="center">
  <img src="docs/assets/banner.png" alt="WASH PRO CRM / SCADA" width="100%">
</p>

<p align="center">
  <a href="https://github.com/WASH-PRO/WASH-PRO-CRM/actions/workflows/pages.yml"><img src="https://github.com/WASH-PRO/WASH-PRO-CRM/actions/workflows/pages.yml/badge.svg" alt="GitHub Pages"></a>
  <a href="https://wash-pro.github.io/WASH-PRO-CRM/"><img src="https://img.shields.io/badge/Docs-GitHub_Pages-14b8a6?style=flat-square&logo=github&logoColor=white" alt="Documentation"></a>
  <img src="https://img.shields.io/badge/version-1.1.12-0d9488?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/MongoDB-7-47A248?style=flat-square&logo=mongodb&logoColor=white" alt="MongoDB">
  <img src="https://img.shields.io/badge/MQTT-Telemetry-3C5280?style=flat-square&logo=eclipsemosquitto&logoColor=white" alt="MQTT">
  <a href="https://github.com/Dynamic-API-Platform/Dynamic-API-Platform"><img src="https://img.shields.io/badge/Dynamic_API-v1.5.13-3b82f6?style=flat-square" alt="Dynamic API Platform v1.5.13"></a>
  <a href="https://github.com/PyOrchestrator/PyOrchestrator"><img src="https://img.shields.io/badge/PyOrchestrator-v0.1.13-22d3ee?style=flat-square" alt="PyOrchestrator v0.1.13"></a>
  <img src="https://img.shields.io/badge/License-Proprietary-red?style=flat-square" alt="License">
</p>

<p align="center">
  Локальная CRM/SCADA-система для автомоек самообслуживания на базе
  <a href="https://github.com/Dynamic-API-Platform/Dynamic-API-Platform">Dynamic API Platform</a>
</p>

<p align="center">
  <a href="https://wash-pro.github.io/WASH-PRO-CRM/"><strong>Документация</strong></a>
  ·
  <a href="docs/getting-started.md">Быстрый старт</a>
  ·
  <a href="docs/architecture.md">Архитектура</a>
  ·
  <a href="https://github.com/WASH-PRO/WASH-PRO-CRM/issues">Issues</a>
</p>

---

## Возможности

- **Обзор** — KPI, круговые диаграммы использования и оплаты, live-уведомления; агрегация по последним записям каждого поста
- **Состояние** — все посты всех объектов, онлайн/оффлайн, интерактивный график (раздел «Главное»)
- **SCADA** — телеметрия MQTT, журнал, команды и цены постов
- **Мастер настройки** — первичная настройка после установки (объект, посты, MQTT, справочники)
- **Объекты и посты** — автомойки, посты с серийным номером, **учётные записи MQTT**, настройки устройства (цены, команды)
- **Карты** — скидочные / сервисные / VIP; журнал применений NFC; типы скидок 1–5
- **Аналитика** — использование и финансы до/после инкассации
- **Автоматизация** — новости/акции для Telegram, боты (управление / сервис / информационный v1.9), **MCP сервер** (Dynamic API + PyOrchestrator), бэкапы
- **Система** — уведомления (web + Telegram), пользователи (привязка Telegram ID), группы RBAC, настройки, логи, профиль
- **Resources** — статус и ссылки на панели Dynamic API (`:8080`) и PyOrchestrator (`:8090`)
- **Live-режим** — автообновление 3–15 с
- **Таблицы** — постраничный вывод (20/40/60/80/100), **Назад/Далее**, **Загрузить ещё**; крупные журналы (MQTT, история поста, карты) не грузят тысячи строк сразу
- **RBAC:** Administrator / Operator / Viewer / Service

## Встроенные платформы

| Платформа | Версия | Назначение в WASH |
|-----------|--------|-------------------|
| [Dynamic API Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform) | **v1.5.13** | REST API, MongoDB, CRM endpoints, RBAC, automation (cron, webhooks, MCP…) |
| [PyOrchestrator](https://github.com/PyOrchestrator/PyOrchestrator) | **v0.1.13** *(опц.)* | Python-скрипты и Telegram-боты через `pyorch-bridge` |

Подробно: [docs/embedded-services.md](docs/embedded-services.md)

## Архитектура

```
Контроллеры ⇄ MQTT (Mosquitto) ⇄ Message Processor ⇄ Dynamic API ⇄ MongoDB
                                                      ↑
Dashboard (React) ──────────── nginx /api proxy ──────┘
                              post-device / backup / telegram-bots
                              pyorch-bridge → PyOrchestrator (опц.)
```

| Сервис | Назначение | Порт |
|--------|------------|------|
| `dashboard` | CRM интерфейс | 80 |
| `dynamic-api` | REST API | 3001 |
| `dynamic-api-panel` | Панель Dynamic API | 8080 |
| `pyorchestrator-panel` *(опц.)* | Control Plane PyOrchestrator | 8090 |
| `pyorch-bridge` *(опц.)* | Telegram-боты CRM | internal |
| `crm-mcp` *(опц.)* | MCP-сервер для AI-агентов (Cursor) | stdio |
| `mosquitto`, `mosquitto-init` | MQTT-брокер, ACL/passwd, изоляция постов | — |

Подробнее: [docs/architecture.md](docs/architecture.md)

## Быстрый старт

### Требования

- Docker 24+, Docker Compose v2
- 4 GB RAM минимум

### Запуск

```bash
git clone https://github.com/WASH-PRO/WASH-PRO-CRM.git
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
| PyOrchestrator Panel *(опц.)* | http://localhost:8090 |
| PyOrchestrator API *(опц.)* | http://localhost:8000/health |

**Учётные данные по умолчанию:** `admin` / `Admin123!`  
При первом входе откроется **мастер настройки** (`/setup`).

### Опции

```bash
# С Redis
REDIS_ENABLED=true docker compose -f docker-compose.yml -f docker-compose.redis.yml up -d --build

# MQTT для контроллеров (порт 1883 открыт в LAN по умолчанию)

# С PyOrchestrator (SCADA/CMS для Python-скриптов)
PYORCHESTRATOR_ENABLED=true ./scripts/start.sh
```

## Документация

Полная документация в папке [`docs/`](docs/) и на **GitHub Pages**:

| Язык | URL |
|------|-----|
| Русский | https://wash-pro.github.io/WASH-PRO-CRM/ru/ |
| English | https://wash-pro.github.io/WASH-PRO-CRM/en/ |
| Қазақша | https://wash-pro.github.io/WASH-PRO-CRM/kk/ |

Корень `/` автоматически перенаправляет на язык браузера (или `/ru/`).

| Раздел | Описание |
|--------|----------|
| [Быстрый старт](docs/getting-started.md) | Установка и первый вход |
| [Мастер настройки](docs/setup-wizard.md) | Первичная настройка CRM |
| [Архитектура](docs/architecture.md) | Сервисы и потоки данных |
| [Dashboard](docs/dashboard.md) | Модули UI, live-режим, RBAC |
| [MCP](docs/mcp.md) | HTTP MCP для AI-агентов (Cursor) |
| [Встроенные сервисы](docs/embedded-services.md) | Dynamic API + PyOrchestrator |
| [MQTT](docs/mqtt.md) | Телеметрия, нативный протокол, **команды и цены поста** |
| [Схема данных](docs/database-schema.md) | CRM endpoints, `posts.settings`, валюты, типы скидок |
| [Развёртывание](docs/deployment.md) | Production и обновление |
| [Конфигурация](docs/configuration.md) | Переменные `.env` |
| [Безопасность](docs/security.md) | RBAC и рекомендации |
| [Устранение неполадок](docs/troubleshooting.md) | Типичные проблемы |
| [Changelog](CHANGELOG.md) | История изменений |
| [Wiki](wiki/Home.md) | Краткие страницы для GitHub Wiki |

### Публикация GitHub Pages

1. **Settings → Pages → Build and deployment → GitHub Actions**
2. В [`docs/_config.yml`](docs/_config.yml) заданы `url: https://wash-pro.github.io` и `baseurl: /WASH-PRO-CRM`
3. Push в `main` — workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) опубликует сайт с боковым меню и гамбургером на мобильных

## Структура проекта

```
WASH-PRO-CRM/
├── docker-compose.yml
├── dynamic-api/              # Dynamic API Platform
├── pyorchestrator/           # PyOrchestrator (vendored)
├── dashboard/                # React CRM Dashboard
├── services/
│   ├── init-seed/            # CRM endpoints + RBAC
│   ├── message-processor/    # MQTT → API
│   ├── backup/
│   ├── pyorch-bridge/        # Telegram ↔ PyOrchestrator
│   ├── crm-mcp/              # MCP server for AI agents
│   ├── dynamic-api-panel/
│   └── pyorchestrator-panel/
├── config/mosquitto/
├── scripts/                  # start, seed, demo data, backup
├── docs/                     # Документация (GitHub Pages)
├── wiki/                     # Страницы для GitHub Wiki
└── docker-compose.yml
```

### Демо-данные

```bash
./scripts/generate-demo-data.sh    # автомойки, посты, статистика
./scripts/generate-demo-cards.sh   # карты с типами скидок 1–5
```

## Обновление и бэкап

```bash
# Обновить встроенную Dynamic API Platform (v1.5.13+)
./scripts/update-dynamic-api.sh
docker compose up -d --build dynamic-api dynamic-api-panel

# Обновить встроенный PyOrchestrator (v0.1.10+)
./scripts/update-pyorchestrator.sh
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build pyorch-backend pyorchestrator-panel pyorch-bridge

# Пересобрать весь стек
docker compose up -d --build

./scripts/restore.sh wash-pro-crm-2024-06-22T02-00-00.archive.gz
```

## Устранение неполадок

| Проблема | Решение |
|----------|---------|
| init-seed `Exited (0)` | Норма — одноразовый контейнер |
| MQTT auth / ACL | `./scripts/fix-mqtt.sh`, затем «Синхронизировать MQTT» в мастере |
| Нет CRM endpoints | `./scripts/run-init-seed.sh` |

Подробнее: [docs/troubleshooting.md](docs/troubleshooting.md)

## Безопасность

1. Смените все секреты в `.env` перед production
2. Наружу — только Dashboard, Dynamic API и (опционально) PyOrchestrator
3. MongoDB и Mosquitto — внутренняя сеть Docker
4. RBAC через группы Dynamic API
5. MQTT: смените пароль `system` в **Настройки → MQTT (CRM)**; у каждого поста свой логин/пароль

## Лицензия

WASH PRO CRM — проприетарный проект.  
[Dynamic API Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform) — Apache License 2.0.  
[PyOrchestrator](https://github.com/PyOrchestrator/PyOrchestrator) — Apache License 2.0.
