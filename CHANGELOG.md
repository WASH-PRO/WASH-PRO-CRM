# Changelog

Все значимые изменения WASH PRO CRM документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/).

## [Unreleased]

## [1.1.1] — 2026-07-08

### Исправлено

- **Апдейтер зависал на «Сборка и перезапуск CRM»** — шаг `build` пересобирал сам `update-bridge`, из-за чего процесс обновления убивался (exit 137) и UI зависал навсегда; `update-bridge` исключён из этого шага (обновляется при полном `docker compose up -d --build`)
- **Незавершённые задачи обновления** после перезапуска сервиса больше не блокируют UI и новые запуски: при старте `update-bridge` помечает прерванные задачи как failed и очищает `activeJobId` (`recoverInterruptedJobs`)

## [1.1.0] — 2026-07-07

### Добавлено

- **Мастер настройки** (`/setup`, `/welcome`) — первичная настройка: объект, посты, MQTT, валюта, справочники; RBAC (Viewer — только просмотр)
- **Статус поста онлайн/оффлайн** — индикатор на страницах «Посты», «Текущее состояние» и карточке поста (порог 30 с по `lastMessageAt`)
- **Учётные записи MQTT постов** — `settings.mqttLogin` / `settings.mqttPassword` в карточке поста; синхронизация passwd и ACL через `POST /api/crm/post-device/mqtt/sync-users`
- **Изоляция постов в MQTT** — динамический ACL по `serialNumber`; подмена serial в payload игнорируется CRM
- Учётная запись **`system`** для CRM; пароль в **Настройки → MQTT (CRM)** (`mqtt-broker`); bootstrap — `MQTT_PASSWORD` в `.env`
- **Настройки устройства поста** в Dashboard: цены режимов (0–9), команды MQTT (перезагрузки, зачисление баланса, сервисные режимы), префикс `dt_pref`
- HTTP API `message-processor` (`:3022`) → nginx `/api/crm/post-device/` для публикации `set/prices` и `set/command`
- Нативный протокол WASH-PRO: топики `{dt_pref}/{serial}/state/*` (process, totals, usages, credit, card)
- Журнал применений карт: новая строка на каждое событие `state/card`; синхронизация баланса/скидки из `state/process`
- Уведомления в web и Telegram (настраиваемые типы событий на Обзоре); события `mqtt_credit`, `mqtt_collection`
- Страница профиля (`/profile`): имя, email, смена пароля
- Выбор видимых колонок в таблицах (DataTable)
- Автоматический редирект на `/login` при истечении сессии
- **Telegram-бот v2.7** — единый UI отчётов, детальные `/status`, `/washes`, `/posts`, `/revenue`, `/statistics`, `/cards`; режимы из справочника «Режимы работы»
- **Авторизация Telegram по CRM** — поле `telegramUserId` у пользователя; `GET /api/users/telegram/{id}/auth`; RBAC в боте (Viewer — только просмотр); посторонним — «Частный бот»
- **Обзор Dashboard** — круговые диаграммы «Использование» (клиенты/сервис/VIP) и доли оплаты (наличные/безнал/скидки)
- Документация: [Мастер настройки](docs/setup-wizard.md), [MQTT](docs/mqtt.md), [Telegram-боты](docs/telegram.md)

### Изменено

- **RabbitMQ заменён на MQTT (Mosquitto)** — телеметрия и DLQ через MQTT; скрипт `./scripts/migrate-to-mqtt.sh`
- Mosquitto: `per_listener_settings true`, динамический ACL, автоперезагрузка passwd/ACL после синхронизации
- `message-processor`: upsert статистики finance/usage по post+period; обработка credit и collection; DLQ-журнал
- Каскадное удаление автомоек и постов — `deleteMany` в MongoDB (без зависаний на больших объёмах)
- Бэкапы: bind mount `./data/backups`; исправлен статус «В процессе» при ручном бэкапе; автоархив по cron для 4 групп данных
- Карты: тип `collection` для инкассации на устройстве (уведомление без строки в разделе карт)
- Пагинация «Загрузить ещё» на страницах MQTT и карт
- **Telegram Dashboard** — список ботов не пропадает при старт/стоп; убрано поле admin Telegram IDs (доступ через Пользователи CRM)
- **pyorch-bridge** — остановка legacy-ботов PyOrchestrator, `refreshAllWashBots`, lock по токену, дедупликация сообщений
- PyOrchestrator vendored **v0.1.13** (submodule)

### Исправлено

- Анонимный MQTT на порту 1883 при `allow_anonymous` на healthcheck-порту 1884 (без `per_listener_settings`)
- `mosquitto_passwd ENOENT` в message-processor (пакет `mosquitto` в образе)
- UI после массового удаления моек (`clearCatalogCache`)
- Белый экран на `/profile` (populate `groupIds`)
- Скидка `0.00` на картах при рассинхроне `state/card` и `state/process`
- PATCH бэкапов без обязательного `filename`
- Дублирование ответов Telegram-бота (два процесса polling + старый шаблон PyOrchestrator)
- Иконка «прочитано» в уведомлениях на Обзоре

## [1.0.0] — начальный релиз

- Dashboard CRM/SCADA на React 18 + Dynamic API Platform v1.5.13
- Объекты, посты, состояние, карты, аналитика, RBAC
- Опциональный PyOrchestrator v0.1.10 (Telegram-боты)
- Резервное копирование MongoDB, архивирование

[Unreleased]: https://github.com/WASH-PRO/WASH-PRO-CRM/compare/v1.1.1...HEAD
[1.1.1]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.1
[1.1.0]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.0
[1.0.0]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.0.0
