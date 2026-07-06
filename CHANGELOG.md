# Changelog

Все значимые изменения WASH PRO CRM документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/).

## [Unreleased]

### Добавлено

- **Настройки устройства поста** в Dashboard: цены режимов (0–9), команды MQTT (перезагрузки, зачисление баланса, сервисные режимы), префикс `dt_pref`
- HTTP API `message-processor` (`:3022`) → nginx `/api/crm/post-device/` для публикации `set/prices` и `set/command`
- Нативный протокол WASH-PRO: топики `{dt_pref}/{serial}/state/*` (process, totals, usages, credit, card)
- Журнал применений карт: новая строка на каждое событие `state/card`; синхронизация баланса/скидки из `state/process`
- Уведомления в web и Telegram (настраиваемые типы событий на Обзоре); события `mqtt_credit`, `mqtt_collection`
- Страница профиля (`/profile`): имя, email, смена пароля
- Выбор видимых колонок в таблицах (DataTable)
- Автоматический редирект на `/login` при истечении сессии
- Документация: управление постом через MQTT и HTTP ([docs/mqtt.md](docs/mqtt.md))

### Изменено

- **RabbitMQ заменён на MQTT (Mosquitto)** — телеметрия и DLQ через MQTT; скрипт `./scripts/migrate-to-mqtt.sh`
- `message-processor`: upsert статистики finance/usage по post+period; обработка credit и collection
- Бэкапы: bind mount `./data/backups`; исправлен статус «В процессе» при ручном бэкапе
- Карты: тип `collection` для инкассации на устройстве (уведомление без строки в разделе карт)

### Исправлено

- Белый экран на `/profile` (populate `groupIds`)
- Скидка `0.00` на картах при рассинхроне `state/card` и `state/process`
- PATCH бэкапов без обязательного `filename`

## [1.0.0] — начальный релиз

- Dashboard CRM/SCADA на React 18 + Dynamic API Platform v1.5.13
- Объекты, посты, состояние, карты, аналитика, RBAC
- Опциональный PyOrchestrator v0.1.10 (Telegram-боты)
- Резервное копирование MongoDB, архивирование

[Unreleased]: https://github.com/WASH-PRO/WASH-PRO-CRM/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.0.0
