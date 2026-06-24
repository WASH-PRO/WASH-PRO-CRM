---
layout: default
---

<div class="hero">
  <img class="banner" src="{{ '/assets/banner.png' | relative_url }}" alt="WASH PRO CRM / SCADA">
  {% include hero-badges.html %}
  <p class="hero-lead">
    Локальная CRM/SCADA-система для автомоек самообслуживания на базе
    <a href="https://github.com/Dynamic-API-Platform/Dynamic-API-Platform">Dynamic API Platform</a>
  </p>
</div>

**Локальная система управления автомойками самообслуживания** — мониторинг постов, карты клиентов, статистика, финансы, резервное копирование и Telegram-уведомления.

Построена на [Dynamic API Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform): все CRM-данные хранятся в MongoDB и доступны через REST API, а контроллеры постов отправляют телеметрию через RabbitMQ.

<p class="quick-links">
  <a href="{{ '/getting-started/' | relative_url }}">Быстрый старт</a> ·
  <a href="{{ '/architecture/' | relative_url }}">Архитектура</a> ·
  <a href="{{ '/dashboard/' | relative_url }}">Dashboard</a> ·
  <a href="{{ '/rabbitmq/' | relative_url }}">RabbitMQ</a>
</p>

## Возможности

| Модуль | Описание |
|--------|----------|
| **Автомойки и посты** | Справочник объектов; серийный номер привязан к посту |
| **SCADA** | Текущее состояние постов в реальном времени |
| **Карты** | Обычные, безлимитные и служебные карты |
| **Статистика** | Использование и финансы по периодам |
| **Архив** | Политики хранения 30/90/180/365 дней |
| **Резервные копии** | Автоматический `mongodump` по расписанию |
| **Telegram** | Бот для администраторов |
| **Уведомления** | Web + Telegram |

## Стек

| Компонент | Технология |
|-----------|------------|
| API | Dynamic API Platform **v1.5.6** (Node.js + MongoDB) |
| Dashboard | React + TypeScript + Vite |
| Очередь | RabbitMQ |
| Обработка телеметрии | message-processor (Node.js) |
| Инфраструктура | Docker Compose |

## Быстрый старт

```bash
git clone https://github.com/Developer-RU/WASH-PRO-CRM.git
cd WASH-PRO-CRM
cp .env.example .env
chmod +x scripts/*.sh
./scripts/start.sh
```

| Сервис | URL |
|--------|-----|
| Dashboard | http://localhost |
| Dynamic API | http://localhost:3001 |
| Dynamic API Panel | http://localhost:8080 |

**Логин по умолчанию:** `admin` / `Admin123!` — смените в `.env` перед production.

## Структура репозитория

```
WASH-PRO-CRM/
├── dashboard/              # React CRM Dashboard
├── dynamic-api/            # Dynamic API Platform (submodule / clone)
├── services/
│   ├── init-seed/          # CRM endpoints + RBAC
│   ├── message-processor/  # RabbitMQ → API
│   ├── backup/             # Резервное копирование
│   └── telegram-bot/
├── config/rabbitmq/
├── scripts/
├── docs/                   # Документация (GitHub Pages)
└── docker-compose.yml
```

## Лицензия

WASH PRO CRM — проприетарный проект.  
[Dynamic API Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform) распространяется под Apache License 2.0.
