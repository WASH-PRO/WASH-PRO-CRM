---
layout: default
title: Схема данных
description: Модель данных WASH PRO CRM — основные коллекции MongoDB и endpoints Dynamic API для моек, клиентов, сессий и связанных сущностей.
---

Данные хранятся в **MongoDB** через [Dynamic API Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform) **v1.5.13**.

Управление пользователями и группами: `/api/users`, `/api/groups` (management API) — UI в Dashboard → Система или панель `:8080`.

## Системные коллекции Dynamic API

| Коллекция | Назначение |
|-----------|------------|
| `users` | Пользователи Dashboard (`telegramUserId` — привязка Telegram для бота) |
| `groups` | RBAC-группы (Administrator, Operator, Viewer, Service) |
| `endpoints` | Определения CRM API endpoints |
| `endpointdatas` | Все бизнес-данные CRM |
| `logs` | Аудит и системные логи |
| `systemsettings` | Настройки платформы |

## Группы endpoints (Dynamic API Panel)

| Группа | Endpoints |
|--------|-----------|
| Автомойки | `/api/crm/washes` |
| Посты | `/api/crm/posts` |
| Состояние и SCADA | `/api/crm/post-states` |
| Карты клиентов | `/api/crm/cards` |
| Статистика | `/api/crm/usage-stats`, `/api/crm/finance-stats` |
| Валюты | `/api/crm/currencies` |
| Типы скидок | `/api/crm/discount-types` |
| Настройки | `/api/crm/settings` |
| Уведомления | `/api/crm/notifications` |
| Резервное копирование | `/api/crm/backups`, `/api/crm/archive-logs` |
| Телеметрия | `/api/crm/telemetry` |

Всего **52** CRM endpoint-определения (CRUD + списки). `init-seed` создаёт и обновляет их идемпотентно.

## CRM Endpoints (данные в `endpointdatas`)

| Ресурс | Path | Основные поля |
|--------|------|---------------|
| Автомойки | `/api/crm/washes` | name, description, address, registeredAt, cloudEnabled |
| Посты | `/api/crm/posts` | washId, postNumber, name, serialNumber, **settings** (см. ниже) |
| Состояние постов | `/api/crm/post-states` | postId, washId, mode, modeName, modeNumber, freePause, paidPause, balance, discount, modeTime, equipmentState, lastMessageAt, connected |
| Карты | `/api/crm/cards` | cardNumber, cardType (`regular`\|`service`\|`unlimited`\|`collection`), balance, discount, discountType (номер 1–5), status (`success`\|`rejected`), washId, postId, createdAt, validFrom, validUntil |
| Статистика использования | `/api/crm/usage-stats` | washId, postId, period (`before_collection`\|`after_collection`), category (`regular`\|`service`\|`unlimited`), launchCount, usageTime, avgWashTime, clientCount, recordedAt |
| Финансы | `/api/crm/finance-stats` | washId, postId, period, cash, cashless, discountOps, totalRevenue, avgCheck, recordedAt |
| Валюты | `/api/crm/currencies` | code, name, symbol, isDefault |
| Типы скидок | `/api/crm/discount-types` | number (1–5), name |
| Настройки | `/api/crm/settings` | key (`backup`/`archive`/`telegram`/`notifications`/`branding`/…), value (JSON) |
| Уведомления | `/api/crm/notifications` | type, severity, message, read, channels, washId, postId, createdAt |
| Резервные копии | `/api/crm/backups` | filename, size, type (`manual`\|`auto`), status (`completed`\|`failed`\|`in_progress`), createdAt, error |
| Архив | `/api/crm/archive-logs` | action, recordsAffected, policyDays, groupKey |
| Телеметрия | `/api/crm/telemetry` | washSerial, postSerial, messageType, payload, receivedAt |

**Индексы телеметрии (v1.1.48+):** составные индексы по `resourcePath` + `postSerial` + `receivedAt` (+ опционально `messageType`) — см. [Архитектура — индексы MongoDB](architecture.md#индексы-mongodb-v148).

### Справочник типов скидок (по умолчанию)

| № | Название |
|---|----------|
| 1 | Карта такси |
| 2 | Постоянный клиент |
| 3 | Корпоративный клиент |
| 4 | Сотрудник |
| 5 | Промоакция |

В картах поле `discountType` хранит номер (`"1"` … `"5"`); Dashboard подставляет название из справочника.

### Поле `posts.settings` (JSON)

| Ключ | Описание |
|------|----------|
| `firmwareVersion` | Legacy JSON; **в UI Dashboard не редактируется** (только из устройства/настроек, если есть) |
| `warrantyUntil` | Legacy JSON; **в UI Dashboard не редактируется** |
| `maintenance` | Заметки по ТО |
| `features` | Описание возможностей поста |
| `mqttPrefix` | Префикс MQTT (`dt_pref`), по умолчанию `washpro` |
| `mqttLogin` | Логин MQTT для панели поста (по умолчанию = `serialNumber`) |
| `mqttPassword` | Пароль MQTT для панели поста |
| `modePrices` | Цены режимов: `{ "0": 50, "1": 80, … }` (рубли) |
| `pricesUpdatedAt` | Время последнего сохранения цен из CRM |
| `pricesSyncedAt` | Время синхронизации цен с устройства |
| `lastCommand` | Последняя команда (`soft_reset`, `credit_balance`, …) |
| `lastCommandAt` | Время последней команды |

Управление ценами и командами: Dashboard → пост → **Настройки устройства** или [MQTT HTTP API](mqtt.md).

## Каскадное удаление

`DELETE /api/crm/posts/:id` удаляет пост и связанные записи: состояния, карты, статистику использования и финансов, уведомления, MQTT-телеметрию (по `postId` и `postSerial`). Операция пишется в журнал архивирования (`action: delete`).

`DELETE /api/crm/washes/:id` удаляет автомойку, **все посты** объекта и их данные (каскад как при удалении поста), а также уведомления по объекту.

## RBAC

| Роль | Группа Dynamic API | Права |
|------|-------------------|-------|
| Administrator | Administrator | Полный доступ |
| Operator | Operator | view, create, update |
| Viewer | Viewer | view |
| Service | Service | view, create, update, delete, manage_api (внутренние сервисы) |

Внутренний service account используется message-processor, backup и pyorch-bridge (JWT для `GET /api/users/telegram/{id}/auth`).

### Telegram auth API

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/users/telegram/:telegramUserId/auth` | Разрешения пользователя по Telegram ID (для бота) |

## Резервное копирование

Файлы: bind mount `DATA_DIR/backups` → `/backups` в контейнере `wash-backup`.  
Формат: `mongodump --archive --gzip` → `wash-pro-crm-{timestamp}.archive.gz`

При включённом **полном пакете** в настройках CRM (`backup.fullBundle`, по умолчанию `true` с v1.1.44):

- Дополнительный файл: `wash-pro-crm-{timestamp}-extras.tar.gz`
- Содержимое: `settings/crm-settings.json` (все строки `/api/crm/settings`) и `modules-data/{moduleId}/` (из `modules/installed/*/data/`)
- `wash-backup` монтирует `modules/` хоста read-only в `/modules`

Восстановление сейчас: архив MongoDB через `./scripts/restore.sh` или Dashboard → Резервные копии. Extras — для ручного восстановления настроек и data модулей.

### Настройка `branding` (v1.1.44)

| Поле | Описание |
|------|----------|
| `productName` | Отображаемое имя (сайдбар, вход, приветствие) |
| `tagline` | Подзаголовок |
| `logoUrl` | URL изображения (пусто = иконка по умолчанию) |
| `supportUrl` | Ссылка поддержки |
| `docsUrl` | Базовый URL документации |

## Миграции и seed

При старте `init-seed`:

- создаёт группы endpoints и CRM endpoints;
- настраивает RBAC;
- добавляет настройки по умолчанию, валюту RUB, типы скидок 1–5, **`setup.complete: false`** для мастера настройки;
- идемпотентен — безопасно запускать повторно (`./scripts/run-init-seed.sh`).
