---
layout: default
title: Деректер схемасы
description: CRM endpoints және MongoDB коллекциялары
---

Деректер [Dynamic API Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform) **v1.5.13** арқылы **MongoDB**-де сақталады.

Пайдаланушылар мен топтарды басқару: `/api/users`, `/api/groups` (management API) — UI Dashboard → Жүйе немесе `:8080` панелінде.

## Dynamic API жүйелік коллекциялары

| Коллекция | Мақсаты |
|-----------|---------|
| `users` | Dashboard пайдаланушылары (`telegramUserId` — бот үшін Telegram байланысы) |
| `groups` | RBAC топтары (Administrator, Operator, Viewer, Service) |
| `endpoints` | CRM API endpoints анықтамалары |
| `endpointdatas` | Барлық CRM бизнес-деректері |
| `logs` | Аудит және жүйелік логтар |
| `systemsettings` | Платформа баптаулары |

## Endpoint топтары (Dynamic API Panel)

| Топ | Endpoints |
|-----|-----------|
| Автомойкалар | `/api/crm/washes` |
| Посттар | `/api/crm/posts` |
| Күй және SCADA | `/api/crm/post-states` |
| Клиент карталары | `/api/crm/cards` |
| Статистика | `/api/crm/usage-stats`, `/api/crm/finance-stats` |
| Валюталар | `/api/crm/currencies` |
| Жеңілдік түрлері | `/api/crm/discount-types` |
| Баптаулар | `/api/crm/settings` |
| Хабарландырулар | `/api/crm/notifications` |
| Резервтік көшіру | `/api/crm/backups`, `/api/crm/archive-logs` |
| Телеметрия | `/api/crm/telemetry` |

Барлығы **52** CRM endpoint анықтамасы (CRUD + тізімдер). `init-seed` оларды идемпотентті түрде жасайды және жаңартады.

## CRM Endpoints (`endpointdatas` ішіндегі деректер)

| Ресурс | Path | Негізгі өрістер |
|--------|------|-----------------|
| Автомойкалар | `/api/crm/washes` | name, description, address, registeredAt, cloudEnabled |
| Посттар | `/api/crm/posts` | washId, postNumber, name, serialNumber, **settings** (төменге қараңыз) |
| Пост күйі | `/api/crm/post-states` | postId, washId, mode, modeName, modeNumber, freePause, paidPause, balance, discount, modeTime, equipmentState, lastMessageAt, connected |
| Карталар | `/api/crm/cards` | cardNumber, cardType (`regular`\|`service`\|`unlimited`\|`collection`), balance, discount, discountType (1–5 нөмірі), status (`success`\|`rejected`), washId, postId, createdAt, validFrom, validUntil |
| Пайдалану статистикасы | `/api/crm/usage-stats` | washId, postId, period (`before_collection`\|`after_collection`), category (`regular`\|`service`\|`unlimited`), launchCount, usageTime, avgWashTime, clientCount, recordedAt |
| Қаржы | `/api/crm/finance-stats` | washId, postId, period, cash, cashless, discountOps, totalRevenue, avgCheck, recordedAt |
| Валюталар | `/api/crm/currencies` | code, name, symbol, isDefault |
| Жеңілдік түрлері | `/api/crm/discount-types` | number (1–5), name |
| Баптаулар | `/api/crm/settings` | key (backup/archive/telegram/notifications), value (JSON) |
| Хабарландырулар | `/api/crm/notifications` | type, severity, message, read, channels, washId, postId, createdAt |
| Резервтік көшірмелер | `/api/crm/backups` | filename, size, type (`manual`\|`auto`), status (`completed`\|`failed`\|`in_progress`), createdAt, error |
| Архив | `/api/crm/archive-logs` | action, recordsAffected, policyDays, groupKey |
| Телеметрия | `/api/crm/telemetry` | washSerial, postSerial, messageType, payload, receivedAt |

### Жеңілдік түрлері анықтамалығы (әдепкі)

| № | Атауы |
|---|-------|
| 1 | Такси картасы |
| 2 | Тұрақты клиент |
| 3 | Корпоративтік клиент |
| 4 | Қызметкер |
| 5 | Промоакция |

Карталарда `discountType` өрісі нөмірді (`"1"` … `"5"`) сақтайды; Dashboard анықтамалықтан атауын қояды.

### `posts.settings` өрісі (JSON)

| Кілт | Сипаттама |
|------|----------|
| `firmwareVersion` | Прошивка нұсқасы (құрылғыдан / қолмен) |
| `warrantyUntil` | Кепілдік аяқталу күні |
| `maintenance` | ТО жазбалары |
| `features` | Пост мүмкіндіктерінің сипаттамасы |
| `mqttPrefix` | MQTT префиксі (`dt_pref`), әдепкі `washpro` |
| `mqttLogin` | Пост панелі үшін MQTT логин (әдепкі = `serialNumber`) |
| `mqttPassword` | Пост панелі үшін MQTT пароль |
| `modePrices` | Режим бағалары: `{ "0": 50, "1": 80, … }` (рубль) |
| `pricesUpdatedAt` | CRM-ден бағалар соңғы сақталған уақыт |
| `pricesSyncedAt` | Құрылғыдан баға синхрондау уақыты |
| `lastCommand` | Соңғы команда (`soft_reset`, `credit_balance`, …) |
| `lastCommandAt` | Соңғы команда уақыты |

Бағалар мен командаларды басқару: Dashboard → пост → **Құрылғы баптаулары** немесе [MQTT HTTP API](mqtt.md).

## Каскадты жою

`DELETE /api/crm/posts/:id` постты және байланысты жазбаларды жояды: күйлер, карталар, пайдалану және қаржы статистикасы, хабарландырулар, MQTT телеметриясы (`postId` және `postSerial` бойынша). Операция архивтеу журналына жазылады (`action: delete`).

`DELETE /api/crm/washes/:id` автомойканы, объектінің **барлық посттарын** және олардың деректерін (пост жою каскады сияқты), сондай-ақ объект бойынша хабарландыруларды жояды.

## RBAC

| Рөл | Dynamic API тобы | Құқықтар |
|-----|------------------|----------|
| Administrator | Administrator | Толық қолжетімділік |
| Operator | Operator | view, create, update |
| Viewer | Viewer | view |
| Service | Service | view, create, update, delete, manage_api (ішкі сервистер) |

Ішкі service account message-processor, backup және pyorch-bridge қолданады (`GET /api/users/telegram/{id}/auth` үшін JWT).

### Telegram auth API

| Әдіс | Жол | Сипаттама |
|------|-----|----------|
| GET | `/api/users/telegram/:telegramUserId/auth` | Telegram ID бойынша пайдаланушы рұқсаттары (бот үшін) |

## Резервтік көшіру

Файлдар: bind mount `DATA_DIR/backups` → `wash-backup` контейнеріндегі `/backups`.  
Формат: `mongodump --archive --gzip`

## Миграциялар және seed

`init-seed` іске қосылғанда:

- endpoint топтарын және CRM endpoints жасайды;
- RBAC баптайды;
- әдепкі баптаулар, RUB валютасы, жеңілдік түрлері 1–5, баптау шебері үшін **`setup.complete: false`** қосады;
- идемпотентті — қайта іске қосу қауіпсіз (`./scripts/run-init-seed.sh`).
