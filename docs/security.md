---
layout: default
title: Безопасность
description: RBAC, сеть и рекомендации
---

## Принципы

1. **Минимальная поверхность атаки** — наружу доступны только Dashboard, Dynamic API и панель Dynamic API
2. **Нет прямого доступа к MongoDB** — все запросы через API с JWT
3. **Изолированная сеть** — `wash-internal` без маршрутизации в интернет
4. **RBAC** — разграничение прав по группам

## Роли (RBAC)

| Группа | Права | Использование |
|--------|-------|---------------|
| Super Admin / Administrator | Полный доступ | Владельцы системы |
| Operator | view, create, update | Операторы автомойки |
| Viewer | view | Только просмотр |
| Service | API для внутренних сервисов | message-processor, backup, telegram-bot |

Группы и права настраиваются в Dynamic API Panel. `init-seed` создаёт CRM endpoints с `allowedGroupIds`, включающими Super Admin.

## Секреты

Обязательно смените перед production:

- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CSRF_SECRET`
- `ADMIN_PASSWORD`, `SERVICE_PASSWORD`
- `RABBITMQ_PASSWORD`

Не коммитьте `.env` в git — файл в `.gitignore`.

## CORS

`CORS_ORIGIN` поддерживает несколько origin через запятую:

```env
CORS_ORIGIN=http://localhost,http://localhost:3001,https://crm.example.com
```

## RabbitMQ

По умолчанию RabbitMQ доступен только внутри Docker. При открытии порта для контроллеров:

- Используйте сложный пароль
- Ограничьте IP на файрволе
- Рассмотрите VPN между контроллерами и сервером

## Аудит

Системные логи Dynamic API доступны в Dashboard → **Логи** (только администратор). Логируются действия пользователей, HTTP-запросы к API, ошибки аутентификации.

## Резервное копирование

Регулярные бэкапы MongoDB хранятся в volume `wash_backup_data`. Проверяйте восстановление на тестовом стенде.

## Dynamic API Platform

Дополнительные механизмы безопасности платформы: rate limiting, login lockout, Helmet, JWT refresh. Подробнее — [документация Dynamic API](https://dynamic-api-platform.github.io/Dynamic-API-Platform/).
