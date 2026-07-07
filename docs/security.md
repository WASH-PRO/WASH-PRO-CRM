---
layout: default
title: Безопасность
description: RBAC, сеть и рекомендации
---

## Принципы

1. **Минимальная поверхность атаки** — наружу: Dashboard, Dynamic API, панели платформ
2. **Нет прямого доступа к MongoDB** — только через API с JWT
3. **Изолированная сеть** `wash-internal` для БД и очередей
4. **RBAC** — группы Dynamic API + разделы Admin в Dashboard

## Роли CRM (init-seed)

| Группа | Permissions | Dashboard |
|--------|-------------|-----------|
| **Administrator** | view, create, update, delete, manage_users, manage_api, view_logs | Полный доступ + Система (admin) |
| **Operator** | view, create, update | CRM без admin-разделов |
| **Viewer** | view | Только просмотр |
| **Service** | view (+ API для automation) | Внутренние сервисы |

Admin-разделы Dashboard (пользователи, группы, бэкапы, Telegram, логи…) требуют `manage_users` **или** `view_logs` в JWT.

Управление: **Dashboard → Пользователи / Группы и права** или **Dynamic API Panel → Users / Groups**.

## Секреты (обязательно сменить)

- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CSRF_SECRET`
- `ADMIN_PASSWORD`, `SERVICE_PASSWORD`, `MQTT_PASSWORD`
- `PYORCH_JWT_SECRET`, `PYORCH_SECRET_MASTER_KEY`, `PYORCH_INTERNAL_API_KEY` *(если PyOrch)*

`.env` в `.gitignore`.

## CORS

```env
CORS_ORIGIN=http://localhost,http://localhost:3001,http://localhost:8080,https://crm.example.com
```

## pyorch-bridge

- Доступен только через Dashboard nginx `/api/telegram-bots/`
- Проверяет CRM JWT + права admin
- Хранит учётные данные PyOrchestrator в env (`PYORCH_DASHBOARD_*`)

## Управление постом (post-device API)

- Путь `/api/crm/post-device/` проксируется на `message-processor:3022` (не публикуется наружу отдельным портом)
- Требуется валидный JWT пользователя (проверка через `/api/profile`)
- Отправка команд и цен доступна ролям с правами **create** / **update** (Operator, Administrator)
- Любая публикация в MQTT `set/command` выполняется без дополнительного подтверждения на уровне брокера — ограничьте сеть и учётные записи CRM

## MQTT

Порт **1883** открыт на всех интерфейсах хоста — посты в локальной сети подключаются к `<IP-сервера>:1883` с логином/паролем из карточки поста. В passwd Mosquitto допускаются только **superadmin** (`MQTT_USER` / `MQTT_PASSWORD` в `.env`) и учётные записи постов; анонимный доступ запрещён.

Обязательно задайте сложный `MQTT_PASSWORD` для `superadmin`. Не назначайте постам логин `superadmin` или `wash`.

**Изоляция постов:** при синхронизации MQTT генерируется ACL — каждый пост только в топиках `washpro/{serial}/#`. Подмена serial в JSON не влияет на чужую статистику.

## Аудит

Dashboard → **Логи** (Admin) и Dynamic API Panel → Audit Logs.

## Dynamic API Platform

Rate limiting, login lockout, Helmet, network access rules — см. [upstream security](https://dynamic-api-platform.github.io/Dynamic-API-Platform/security/) и `dynamic-api/docs/`.

## PyOrchestrator

JWT, RBAC (Administrator/Developer/Operator/Viewer), encrypted script secrets — см. [PyOrchestrator security](https://pyorchestrator.github.io/PyOrchestrator/security/).

## Резервное копирование

Файлы в `DATA_DIR/backups` (bind mount). Тестируйте `./scripts/restore.sh` на стенде.
