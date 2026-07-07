---
layout: default
title: Telegram-боты
description: Создание ботов, авторизация по пользователям CRM и RBAC
---

Telegram-боты WASH PRO CRM работают через **PyOrchestrator** и сервис **`pyorch-bridge`**. Управление — в **Dashboard → Система → Telegram** (требуется роль Administrator).

## Архитектура

```
Пользователь Telegram
        ↓
   Telegram API (long polling)
        ↓
PyOrchestrator runtime (скрипт main.py из botTemplate)
        ↓  JWT service account
Dynamic API  →  GET /api/users/telegram/{id}/auth
        ↓
RBAC (группы пользователя) + CRM endpoints
```

| Компонент | Назначение |
|-----------|------------|
| `pyorch-bridge` | Создание ботов, secrets, синхронизация шаблона `main.py`, restart |
| `botTemplate.ts` | Исходный код бота (шаблон v2.7+), единый UI отчётов |
| Dynamic API `users` | Поле `telegramUserId`, endpoint авторизации для бота |

## Создание бота

1. Включите PyOrchestrator: `PYORCHESTRATOR_ENABLED=true` в `.env`, затем `./scripts/start.sh`
2. **Dashboard → Telegram → Создать бота**
3. Укажите **токен** от [@BotFather](https://t.me/BotFather)
4. Выберите разрешённые **команды** (whitelist на уровне бота)
5. Запустите бота (кнопка ▶ или «Запустить сразу после создания»)

Пересборка bridge и синхронизация шаблона:

```bash
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build pyorch-bridge
```

Принудительное обновление кода у всех запущенных ботов: `POST /api/telegram-bots/bots/refresh` (через API с admin JWT).

## Авторизация пользователей

Доступ в бот **не** задаётся списком admin ID в настройках бота. Каждый сотрудник привязывается в CRM:

1. Узнайте Telegram ID у [@userinfobot](https://t.me/userinfobot)
2. **Dashboard → Пользователи** → редактировать пользователя
3. Поле **Telegram user_id** — числовой ID
4. Назначьте **группу доступа** (RBAC)

При каждом сообщении бот вызывает:

`GET /api/users/telegram/{telegramUserId}/auth`

Ответ содержит `permissions` из групп пользователя. Учётная запись `service` (внутренний JWT бота) должна иметь право `view` — это настроено в init-seed.

### Права в боте

| Permission CRM | Возможности в боте |
|--------------|-------------------|
| `view` | Мониторинг, отчёты: статус, автомойки, посты, выручка, статистика, карты |
| `create` | Создание автомоек и постов |
| `update` | Команды поста (перезагрузка, зачисление баланса, режимы) |
| `delete` | Удаление автомоек и постов |
| `manage_users` / `manage_api` | Полный доступ (как Administrator) |

Группа **Viewer** — только чтение. **Operator** — просмотр + создание/изменение. **Administrator** — всё.

### Посторонние пользователи

Если Telegram ID не привязан к активному пользователю CRM, бот отвечает **только** сообщением «Частный бот» с указанием их ID. Данные CRM не раскрываются.

## Меню и отчёты (шаблон v2.7)

Единый формат ответов:

- заголовок и сводка;
- секции с подзаголовками;
- подвал `Шаблон бота v2.7`.

| Раздел | Содержание |
|--------|------------|
| **Статус** | Онлайн/офлайн/обслуживание/ошибка по постам |
| **Автомойки** | Объекты, посты, режимы из справочника «Режимы работы» |
| **Посты** | Группировка по объектам, баланс, режим |
| **Выручка / Статистика** | До и после инкассации |
| **Карты** | По типам (скидочные, сервисные, VIP) |

Многошаговые сценарии (создание объекта, команда с суммой) — через inline-кнопки и пошаговый ввод.

## Надёжность

| Механизм | Описание |
|----------|----------|
| Lock по токену | Один процесс polling на токен (`/tmp/wash-telegram-locks/`) |
| Offset | Сохранение до обработки update (нет дублей после рестарта) |
| Дедупликация send | Одинаковый текст в чат ≤ 3 с не повторяется |
| Legacy-боты | Bridge останавливает старые скрипты из шаблона PyOrchestrator |
| Шаблон | `syncBotCode` при старте bridge и перед restart бота |

## Устранение неполадок

| Симптом | Действие |
|---------|----------|
| «PyOrchestrator недоступен» | `PYORCHESTRATOR_ENABLED=true`, `./scripts/start.sh`, health `curl localhost/api/telegram-bots/health` |
| Два ответа (старый + новый формат) | `POST /bots/refresh`, стоп/старт бота; удалите дубликаты в PyOrchestrator |
| «Частный бот» для сотрудника | Проверьте `telegramUserId` и статус `active` в **Пользователи** |
| Viewer не может создать объект | Ожидаемо — нужна группа Operator или выше |
| Бот молчит | `./scripts/fix-pyorch.sh`, логи `docker logs wash-pyorch-runtime` |

Подробнее: [Устранение неполадок — Telegram](troubleshooting.md#telegram-unauthorized-при-создании-бота).

## API bridge (admin JWT)

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/telegram-bots/health` | Доступность PyOrchestrator |
| GET | `/api/telegram-bots/bots` | Список ботов |
| POST | `/api/telegram-bots/bots` | Создать |
| PUT | `/api/telegram-bots/bots/:id` | Обновить |
| DELETE | `/api/telegram-bots/bots/:id` | Удалить |
| POST | `/api/telegram-bots/bots/:id/start` | Запуск |
| POST | `/api/telegram-bots/bots/:id/stop` | Остановка |
| POST | `/api/telegram-bots/bots/refresh` | Синхронизация шаблона + restart |

См. также: [Встроенные сервисы](embedded-services.md), [Безопасность](security.md).
