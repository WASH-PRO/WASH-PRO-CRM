> **[English](en-Database-Schema)** · **Русский** · [← Wiki](Home)

# Схема данных

Полное описание: [docs/database-schema.md](https://wash-pro.github.io/WASH-PRO-CRM/ru/database-schema/)

## Группы endpoints

| Группа | Path |
|--------|------|
| Автомойки | `/api/crm/washes` |
| Посты | `/api/crm/posts` |
| SCADA | `/api/crm/post-states` |
| Карты | `/api/crm/cards` |
| Статистика | `/api/crm/usage-stats`, `/api/crm/finance-stats` |
| Валюты | `/api/crm/currencies` |
| Типы скидок | `/api/crm/discount-types` |
| Настройки | `/api/crm/settings` |
| Уведомления | `/api/crm/notifications` |
| Бэкапы | `/api/crm/backups`, `/api/crm/archive-logs` |
| Телеметрия | `/api/crm/telemetry` |

## Типы скидок

Справочник `/api/crm/discount-types`: номера **1–5** и названия. В картах поле `discountType` — номер; Dashboard показывает название.

## `posts.settings`

JSON с метаданными поста: `mqttLogin`, `mqttPassword`, `modePrices`, `mqttPrefix`, `lastCommand`, `firmwareVersion`, `maintenance` и др. См. [docs/database-schema.md](https://wash-pro.github.io/WASH-PRO-CRM/ru/database-schema/).

## Удаление поста и автомойки

`DELETE /api/crm/posts/:id` — каскадно удаляет состояния, карты, статистику, финансы, уведомления и MQTT-телеметрию поста.

`DELETE /api/crm/washes/:id` — удаляет автомойку, все её посты и их данные.
