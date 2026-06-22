---
layout: default
title: Схема данных
description: CRM endpoints и коллекции MongoDB
---

Данные хранятся в **MongoDB** (часть [Dynamic API Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform)).

## Системные коллекции Dynamic API

| Коллекция | Назначение |
|-----------|------------|
| `users` | Пользователи Dashboard |
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
| Настройки | `/api/crm/settings` |
| Уведомления | `/api/crm/notifications` |
| Резервное копирование | `/api/crm/backups`, `/api/crm/archive-logs` |
| Телеметрия | `/api/crm/telemetry` |

## CRM Endpoints (данные в `endpointdatas`)

| Ресурс | Path | Поля |
|--------|------|------|
| Автомойки | `/api/crm/washes` | name, description, address, registeredAt, cloudEnabled |
| Посты | `/api/crm/posts` | washId, postNumber, name, serialNumber, status, settings |
| Состояние постов | `/api/crm/post-states` | postId, washId, mode, modeName, modeNumber, freePause, paidPause, modeTime, equipmentState, lastMessageAt, connected |
| Карты | `/api/crm/cards` | cardNumber, cardType, balance, discount, status, washId, postId |
| Статистика | `/api/crm/usage-stats` | washId, postId, period, category, launchCount, usageTime, avgWashTime, clientCount |
| Финансы | `/api/crm/finance-stats` | washId, postId, period, cash, cashless, discountOps, totalRevenue, avgCheck |
| Настройки | `/api/crm/settings` | key (backup/archive/telegram/notifications), value (JSON) |
| Уведомления | `/api/crm/notifications` | type, severity, message, read, channels |
| Резервные копии | `/api/crm/backups` | filename, size, type, status |
| Архив | `/api/crm/archive-logs` | action, recordsAffected, policyDays |
| Телеметрия | `/api/crm/telemetry` | washSerial, postSerial, messageType, payload |

## RBAC

| Роль | Группа Dynamic API | Права |
|------|-------------------|-------|
| Administrator | Administrator / Super Admin | Полный доступ |
| Operator | Operator | view, create, update |
| Viewer | Viewer / User | view |

Внутренний service account (`Service`) используется message-processor, backup и telegram-bot.

## Резервное копирование

Файлы бэкапов: Docker volume `wash_backup_data` → `/backups` в контейнере `wash-backup`.

Формат: `mongodump --archive --gzip`

## Миграции

При обновлении контейнер `init-seed` создаёт недостающие endpoints и группы (идемпотентно).
