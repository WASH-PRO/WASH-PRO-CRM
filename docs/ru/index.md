---
layout: default
---

{% assign ui = site.data.ui[page.lang] %}

<div class="hero">
  <img class="banner" src="{{ '/assets/banner.png' | relative_url }}" alt="WASH PRO CRM / SCADA">
  {% include hero-badges.html %}
  <p class="hero-lead">
    {{ ui.hero_lead }}
    <a href="https://github.com/Dynamic-API-Platform/Dynamic-API-Platform">Dynamic API Platform</a>
    {{ ui.hero_optional }} <a href="https://github.com/PyOrchestrator/PyOrchestrator">PyOrchestrator</a>
  </p>
</div>

**{{ ui.hero_summary }}**

{% include quick-links.html %}

## Возможности WASH PRO CRM

| Модуль | Описание |
|--------|----------|
| **Обзор** | KPI, круговые диаграммы использования и оплаты, live-уведомления |
| **Состояние** | Все посты, онлайн/оффлайн, live-таймер, **интерактивный график** *(Главное)* |
| **Целостность и исправление** | Мастер в Настройках: пути, `.env`, git safe.directory *(v1.1.21)* |
| **Обновления ПО** | Автообновление из Dashboard: `git reset --hard`, compose override, ошибка на карточке *(v1.1.20)* |
| **Информация** | Ресурсы сервера, версия CRM, версии встроенных компонентов *(Система → Информация)* (v1.1.22) |
| **Публикации** | Новости и акции для **информационного Telegram-бота** *(Автоматизация)* (v1.1.22) |
| **Встроенная справка** | Полноэкранная справка по разделам CRM из шапки *(v1.1.22)* |
| **SCADA / MQTT** | Телеметрия, команды и цены постов |
| **Мастер настройки** | Первичная настройка после установки (`/setup`) |
| **Объекты** | Автомойки, посты, **MQTT-учётки**, **настройки устройства** (цены, команды) |
| **Карты** | Скидочные / сервисные / VIP; журнал применений NFC |
| **Аналитика** | Использование и финансы до/после инкассации |
| **Система** | Уведомления (web + Telegram), пользователи (Telegram ID), группы RBAC, настройки, логи |
| **Автоматизация** | **Публикации**, **Telegram-боты** (управление / сервис / **информационный v2.2**), **MCP сервер**, бэкапы |
| **Resources** | Статус и ссылки на панели Dynamic API и PyOrchestrator |
| **Live-данные** | Автообновление 3–15 с; таблицы с пагинацией 20–100 и «Загрузить ещё» |

## Встроенные платформы

| Платформа | Версия | Панель | В WASH |
|-----------|--------|--------|--------|
| [Dynamic API Platform](https://dynamic-api-platform.github.io/Dynamic-API-Platform/) | **v1.5.13** | `:8080` | Backend CRM, endpoints, RBAC, automation |
| [PyOrchestrator](https://pyorchestrator.github.io/PyOrchestrator/) | **v0.1.13** *(опц.)* | `:8090` | Telegram-боты, Python scripts |

Подробно: [Встроенные сервисы](embedded-services.md).

## Стек

| Компонент | Технология |
|-----------|------------|
| API | Dynamic API Platform v1.5.13 (Node.js + MongoDB) |
| Dashboard | React 18 + TypeScript + Vite + Tailwind + Recharts |
| Очередь | MQTT (Mosquitto) |
| Телеметрия | message-processor (Node.js) |
| Python automation | PyOrchestrator v0.1.13 *(опц.)* |
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

## Wiki

Краткий справочник на [GitHub Wiki](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki) (отдельно от этого сайта):

| Язык | Главная |
|------|---------|
| English | [Wiki — EN](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/en-Home) |
| Русский | [Wiki — RU](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/ru-Home) |

## Лицензия

WASH PRO CRM — проприетарный проект.  
Dynamic API Platform — Apache 2.0 · PyOrchestrator — MIT.

## История изменений

См. [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md) в репозитории.
