---
layout: default
---

<div class="hero">
  <img class="banner" src="{{ '/assets/banner.png' | relative_url }}" alt="WASH PRO CRM / SCADA">
  {% include hero-badges.html %}
  <p class="hero-lead">
    Локальная CRM/SCADA-система для автомоек самообслуживания на базе
    <a href="https://github.com/Dynamic-API-Platform/Dynamic-API-Platform">Dynamic API Platform</a>
    и опционально <a href="https://github.com/PyOrchestrator/PyOrchestrator">PyOrchestrator</a>
  </p>
</div>

**Локальная система управления автомойками** — SCADA в реальном времени, карты клиентов, аналитика, RBAC, встроенные платформы Dynamic API и PyOrchestrator.

<p class="quick-links">
  <a href="{{ '/getting-started/' | relative_url }}">Быстрый старт</a> ·
  <a href="{{ '/setup-wizard/' | relative_url }}">Мастер настройки</a> ·
  <a href="{{ '/architecture/' | relative_url }}">Архитектура</a> ·
  <a href="{{ '/mqtt/' | relative_url }}">MQTT</a> ·
  <a href="{{ '/embedded-services/' | relative_url }}">Встроенные сервисы</a> ·
  <a href="{{ '/dashboard/' | relative_url }}">Dashboard</a>
</p>

## Возможности WASH PRO CRM

| Модуль | Описание |
|--------|----------|
| **Обзор** | KPI, графики Recharts, live-уведомления |
| **SCADA** | Состояние постов, **онлайн/оффлайн**, live-таймер, **интерактивный график** |
| **Мастер настройки** | Первичная настройка после установки (`/setup`) |
| **Объекты** | Автомойки, посты, **MQTT-учётки**, **настройки устройства** (цены, команды) |
| **Карты** | Скидочные / сервисные / VIP; журнал применений NFC |
| **Аналитика** | Использование и финансы до/после инкассации |
| **Система** | Уведомления (web + Telegram), пользователи, группы RBAC, бэкапы, Telegram-боты, справочники, логи |
| **Resources** | Статус и ссылки на панели Dynamic API и PyOrchestrator |
| **Live-данные** | Автообновление 3–15 с без перезагрузки |

## Встроенные платформы

| Платформа | Версия | Панель | В WASH |
|-----------|--------|--------|--------|
| [Dynamic API Platform](https://dynamic-api-platform.github.io/Dynamic-API-Platform/) | **v1.5.13** | `:8080` | Backend CRM, endpoints, RBAC, automation |
| [PyOrchestrator](https://pyorchestrator.github.io/PyOrchestrator/) | **v0.1.10** *(опц.)* | `:8090` | Telegram-боты, Python scripts |

Подробно: [Встроенные сервисы](embedded-services.md).

## Стек

| Компонент | Технология |
|-----------|------------|
| API | Dynamic API Platform v1.5.13 (Node.js + MongoDB) |
| Dashboard | React 18 + TypeScript + Vite + Tailwind + Recharts |
| Очередь | MQTT (Mosquitto) |
| Телеметрия | message-processor (Node.js) |
| Python automation | PyOrchestrator v0.1.10 *(опц.)* |
| Инфраструктура | Docker Compose |

## Быстрый старт

```bash
git clone https://github.com/WASH-PRO/WASH-PRO-CRM.git
cd WASH-PRO-CRM
cp .env.example .env
chmod +x scripts/*.sh
./scripts/start.sh
```

| Сервис | URL |
|--------|-----|
| Dashboard | http://localhost |
| Dynamic API Panel | http://localhost:8080 |
| Dynamic API health | http://localhost:3001/api/health |
| PyOrchestrator Panel *(если включён)* | http://localhost:8090 |

**Логин Dashboard:** `admin` / `Admin123!`  
При первом входе откроется **мастер настройки** — см. [Мастер настройки](setup-wizard.md).

### PyOrchestrator (опционально)

```bash
# В .env: PYORCHESTRATOR_ENABLED=true
./scripts/start.sh
```

### Демо-данные

```bash
./scripts/generate-demo-data.sh
./scripts/generate-demo-cards.sh
```

## Структура репозитория

```
WASH-PRO-CRM/
├── dashboard/                 # React CRM
├── dynamic-api/               # Dynamic API Platform (vendored)
├── pyorchestrator/            # PyOrchestrator (vendored, опц.)
├── services/
│   ├── init-seed/             # CRM endpoints + RBAC
│   ├── message-processor/
│   ├── backup/
│   ├── pyorch-bridge/         # Telegram ↔ PyOrchestrator
│   ├── dynamic-api-panel/
│   └── pyorchestrator-panel/
├── scripts/                   # start, update, demo, backup
├── docs/                      # GitHub Pages
└── wiki/                      # GitHub Wiki
```

## Лицензия

WASH PRO CRM — проприетарный проект.  
Dynamic API Platform — Apache 2.0 · PyOrchestrator — MIT.

## История изменений

См. [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md) в репозитории.
