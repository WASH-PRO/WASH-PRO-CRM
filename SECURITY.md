# Политика безопасности WASH PRO CRM

## Поддерживаемые версии

| Версия | Поддержка |
|--------|-----------|
| 1.1.x  | ✅ Активная |
| < 1.1  | ❌ Без гарантий патчей |

Исправления безопасности выпускаются в patch-релизах (например `1.1.17`) и описываются в [CHANGELOG.md](CHANGELOG.md).

## Сообщить об уязвимости

**Не создавайте публичный Issue** для уязвимостей безопасности.

Сообщите приватно одним из способов:

1. [GitHub Security Advisory](https://github.com/WASH-PRO/WASH-PRO-CRM/security/advisories/new) в репозитории **WASH-PRO/WASH-PRO-CRM**, **или**
2. Контакт через профиль maintainer на GitHub (private message)

Укажите:

- Описание уязвимости и потенциальный impact
- Шаги воспроизведения
- Версию WASH PRO CRM (`APP_VERSION` / тег релиза) или commit hash
- Предложение по исправлению (если есть)

Мы постараемся ответить в течение **72 часов** и сообщим о сроках исправления.

## Перед production

1. **Смените все секреты по умолчанию** в `.env`:
   - `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CSRF_SECRET`
   - `ADMIN_PASSWORD`, `SERVICE_PASSWORD`, `MQTT_PASSWORD`
   - `PYORCH_JWT_SECRET`, `PYORCH_SECRET_MASTER_KEY`, `PYORCH_INTERNAL_API_KEY` *(если включён PyOrchestrator)*
2. **Не публикуйте MongoDB** (порт 27017) и внутренние сервисы (`wash-internal`) в интернет
3. **Используйте HTTPS** за reverse proxy (nginx, Traefik, Caddy)
4. **Ограничьте `CORS_ORIGIN`** реальными доменами CRM
5. **Отключите регистрацию** в Dynamic API Settings, если она не нужна
6. **Проверьте rate limiting** и lockout в Dynamic API
7. **Регулярно просматривайте аудит** — Dashboard → Логи, Dynamic API Panel → Audit Logs
8. **Тестируйте восстановление** из `DATA_DIR/backups` на стенде (`./scripts/restore.sh`)

### Учётные данные по умолчанию (только dev)

| Поле     | Значение     |
|----------|--------------|
| Login    | `admin`      |
| Password | `Admin123!`  |

Создаются при первом запуске `init-seed`. **В production обязательно сменить.**

Сервисный аккаунт `service` / `ServiceInternal123!` — только для внутренних контейнеров (message-processor, backup, pyorch-bridge).

## Архитектура и поверхность атаки

- **Снаружи** обычно доступны: Dashboard, Dynamic API, панели Dynamic API / PyOrchestrator (по вашей конфигурации nginx)
- **Внутри** `wash-internal`: MongoDB, Redis, Mosquitto, message-processor, pyorch-bridge
- **Доступ к данным CRM** — через Dynamic API с JWT и RBAC; прямой доступ к MongoDB не предусмотрен

Подробнее: [Architecture](https://wash-pro.github.io/WASH-PRO-CRM/en/architecture/) · [Security (docs)](https://wash-pro.github.io/WASH-PRO-CRM/en/security/)

## RBAC

| Группа          | Права | Dashboard |
|-----------------|-------|-----------|
| Administrator   | view, create, update, delete, manage_users, manage_api, view_logs | Полный доступ + System |
| Operator        | view, create, update | CRM без admin-разделов |
| Viewer          | view  | Только просмотр |
| Service         | view (+ API для automation) | Внутренние сервисы |

Admin-разделы (пользователи, группы, бэкапы, Telegram, логи…) требуют `manage_users` **или** `view_logs` в JWT.

## Публичные CRM endpoints

Часть `GET`-эндпоинтов Dynamic API намеренно **public** — для информационного Telegram-бота и публичных справочников:

- `/api/crm/washes`, `/api/crm/posts`, `/api/crm/post-states`
- `/api/crm/info-messages`, `/api/crm/work-modes`, `/api/crm/currencies`
- `/api/crm/usage-stats` *(только чтение агрегированной статистики для графика загруженности)*

**Не размещайте** в этих коллекциях персональные данные, токены, пароли или коммерческую тайну. Запись и изменение данных по-прежнему требуют JWT и RBAC.

## Telegram-боты (pyorch-bridge)

- Управление ботами — только через Dashboard (`/api/telegram-bots/`) с CRM JWT и правами admin
- **Управляющие/сервисные боты** — авторизация по `telegramUserId` пользователя CRM
- **Информационный бот** — публичный, без привязки к Telegram ID; читает только public endpoints
- Токены Telegram и секреты API хранятся в PyOrchestrator (шифрование AES-GCM) и не попадают в git

## MQTT

- Порт **1883** на хосте — для контроллеров постов в локальной сети
- Анонимный доступ запрещён; ACL изолирует топики `washpro/{serial}/#` по serial поста
- Не используйте логины `system`, `superadmin`, `wash` для постов

## Управление постом (post-device)

- `/api/crm/post-device/` проксируется на `message-processor` (не отдельный внешний порт)
- Требуется JWT пользователя с правами **create** / **update**
- Команды уходят в MQTT без дополнительного подтверждения на брокере — ограничивайте сеть и учётные записи CRM

## Встроенные платформы

WASH PRO CRM включает форки/субмодули с собственными политиками:

| Компонент | Политика |
|-----------|----------|
| [Dynamic API Platform](dynamic-api/SECURITY.md) | JWT, RBAC, rate limit, Helmet |
| [PyOrchestrator](pyorchestrator/SECURITY.md) | JWT, RBAC, encrypted script secrets |

Upstream-документация:

- [Dynamic API security](https://dynamic-api-platform.github.io/Dynamic-API-Platform/security/)
- [PyOrchestrator security](https://pyorchestrator.github.io/PyOrchestrator/security/)

## `.env` и секреты

Файл `.env` в `.gitignore`. **Никогда** не коммитьте пароли, токены Telegram, ключи JWT и MQTT.

При подозрении на компрометацию:

1. Смените затронутые секреты в `.env`
2. Перезапустите затронутые контейнеры (`docker compose up -d`)
3. Отзовите refresh-тokens пользователей (смена пароля / `JWT_SECRET`)
4. При утечке Telegram-токена — перевыпустите токен у @BotFather и обновите бота в CRM
