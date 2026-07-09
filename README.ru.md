**Язык:** [English](README.md) · **Русский**

<p align="center">
  <img src="docs/assets/banner.png" alt="WASH PRO CRM / SCADA" width="100%">
</p>

<p align="center">
  <a href="https://github.com/WASH-PRO/WASH-PRO-CRM/actions/workflows/pages.yml"><img src="https://github.com/WASH-PRO/WASH-PRO-CRM/actions/workflows/pages.yml/badge.svg" alt="GitHub Pages"></a>
  <a href="https://wash-pro.github.io/WASH-PRO-CRM/en/"><img src="https://img.shields.io/badge/Docs-GitHub_Pages-14b8a6?style=flat-square&logo=github&logoColor=white" alt="Documentation"></a>
  <img src="https://img.shields.io/badge/version-1.1.13-0d9488?style=flat-square" alt="Version">
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
  <a href="https://wash-pro.github.io/WASH-PRO-CRM/ru/"><strong>Документация</strong></a>
  ·
  <a href="docs/ru/getting-started.md">Быстрый старт</a>
  ·
  <a href="docs/ru/architecture.md">Архитектура</a>
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
- **Языки интерфейса** — English и Русский; по умолчанию English; переключатель в шапке и в Настройках (v1.1.13)
- **Таблицы** — постраничный вывод (20/40/60/80/100), **Назад/Далее**, **Загрузить ещё**
- **RBAC:** Administrator / Operator / Viewer / Service

## Встроенные платформы

| Платформа | Версия | Назначение в WASH |
|-----------|--------|-------------------|
| [Dynamic API Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform) | **v1.5.13** | REST API, MongoDB, CRM endpoints, RBAC, automation |
| [PyOrchestrator](https://github.com/PyOrchestrator/PyOrchestrator) | **v0.1.13** *(опц.)* | Python-скрипты и Telegram-боты через `pyorch-bridge` |

Подробно: [docs/ru/embedded-services.md](docs/ru/embedded-services.md)

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
| `mosquitto`, `mosquitto-init` | MQTT-брокер, ACL/passwd | — |

Подробнее: [docs/ru/architecture.md](docs/ru/architecture.md)

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

**Учётные данные по умолчанию:** `admin` / `Admin123!`  
При первом входе откроется **мастер настройки** (`/setup`).

### Опции

```bash
REDIS_ENABLED=true docker compose -f docker-compose.yml -f docker-compose.redis.yml up -d --build
PYORCHESTRATOR_ENABLED=true ./scripts/start.sh
```

## Документация

| Язык | URL |
|------|-----|
| [English](https://wash-pro.github.io/WASH-PRO-CRM/en/) | GitHub Pages |
| **Русский** | https://wash-pro.github.io/WASH-PRO-CRM/ru/ |

| Раздел | Описание |
|--------|----------|
| [Быстрый старт](docs/ru/getting-started.md) | Установка и первый вход |
| [Мастер настройки](docs/ru/setup-wizard.md) | Первичная настройка CRM |
| [Архитектура](docs/ru/architecture.md) | Сервисы и потоки данных |
| [Dashboard](docs/ru/dashboard.md) | Модули UI, live-режим, RBAC |
| [MCP](docs/ru/mcp.md) | HTTP MCP для AI-агентов |
| [MQTT](docs/ru/mqtt.md) | Телеметрия и управление постами |
| [Changelog](CHANGELOG.md) | История изменений |
| [Wiki (EN)](wiki/en/Home.md) | GitHub Wiki (English) |
| [Wiki (RU)](wiki/ru/Home.md) | GitHub Wiki (русский) |

## Структура проекта

```
WASH-PRO-CRM/
├── dashboard/                # React CRM Dashboard
├── dynamic-api/              # Dynamic API Platform
├── pyorchestrator/           # PyOrchestrator (опц.)
├── services/                 # init-seed, message-processor, backup, …
├── docs/ru/                  # Документация (русский)
├── docs/en/                  # Documentation (English)
├── wiki/ru/                  # Wiki (русский)
└── wiki/en/                  # Wiki (English)
```

## Лицензия

WASH PRO CRM — проприетарный проект.  
[Dynamic API Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform) — Apache License 2.0.  
[PyOrchestrator](https://github.com/PyOrchestrator/PyOrchestrator) — Apache License 2.0.
