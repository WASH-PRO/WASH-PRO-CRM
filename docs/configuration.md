---
layout: default
title: Конфигурация
description: Переменные окружения .env
---

Все настройки задаются в файле `.env` (шаблон — `.env.example`).

## Dashboard

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `DASHBOARD_PORT` | `80` | Порт веб-интерфейса CRM |

## Dynamic API

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `DYNAMIC_API_PORT` | `3001` | Порт REST API |
| `DYNAMIC_API_PANEL_PORT` | `8080` | Порт панели Dynamic API |
| `CORS_ORIGIN` | localhost URLs | Разрешённые origin через запятую |
| `JWT_SECRET` | — | Секрет access-токена (мин. 32 символа) |
| `JWT_REFRESH_SECRET` | — | Секрет refresh-токена |
| `CSRF_SECRET` | — | CSRF-защита |
| `ADMIN_LOGIN` | `admin` | Логин администратора |
| `ADMIN_EMAIL` | `admin@wash-pro-crm.local` | Email администратора |
| `ADMIN_PASSWORD` | `Admin123!` | Пароль администратора |

## Внутренние сервисы

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `SERVICE_LOGIN` | `service` | Service account для message-processor |
| `SERVICE_PASSWORD` | — | Пароль service account |

## RabbitMQ

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `RABBITMQ_USER` | `wash` | Пользователь RabbitMQ |
| `RABBITMQ_PASSWORD` | — | Пароль |
| `RABBITMQ_EXTERNAL_PORT` | пусто | Внешний порт для контроллеров |

## Redis (опционально)

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `REDIS_ENABLED` | `false` | Включить Redis |
| `REDIS_PASSWORD` | пусто | Пароль Redis |

## Telegram

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `TELEGRAM_BOT_TOKEN` | пусто | Токен бота от @BotFather |
| `TELEGRAM_ADMIN_IDS` | пусто | ID администраторов через запятую |

## Резервное копирование

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `BACKUP_RETENTION_COUNT` | `7` | Сколько бэкапов хранить |
| `BACKUP_CRON` | `0 2 * * *` | Расписание (cron) |

## Версия

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `APP_VERSION` | `1.0.0` | Версия приложения |

## Пример production .env

```env
DASHBOARD_PORT=80
DYNAMIC_API_PORT=3001
CORS_ORIGIN=https://crm.example.com,https://api.example.com

JWT_SECRET=your-very-long-random-secret-at-least-32-chars
JWT_REFRESH_SECRET=another-long-random-secret
CSRF_SECRET=csrf-random-secret

ADMIN_LOGIN=admin
ADMIN_PASSWORD=StrongP@ssw0rd!

RABBITMQ_USER=wash
RABBITMQ_PASSWORD=secure-rabbit-password

TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_ADMIN_IDS=123456789
```
