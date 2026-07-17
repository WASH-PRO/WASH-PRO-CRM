> **[English](en-MQTT)** · **Русский** · [← Wiki](Home)

# MQTT и управление постами

Полная документация: [docs/mqtt.md](https://wash-pro.github.io/WASH-PRO-CRM/ru/mqtt/)

## Подключение контроллера (пост)

- Брокер: `mqtt://<mqttLogin>:<mqttPassword>@<IP-CRM>:1883`
- Логин/пароль — из карточки поста в CRM (`settings.mqttLogin` / `settings.mqttPassword`)
- Меняйте учётки в **списке постов** (форма create/edit). Сохранение названия на странице поста **не трогает** MQTT-пароль *(v1.1.54)*
- По умолчанию логин = `serialNumber`
- Нативный протокол: `{dt_pref}/{serial}/state/{suffix}`
- По умолчанию `dt_pref` = `washpro`
- `serial` = `posts.serialNumber` в CRM (точное совпадение в топике)

## CRM (внутри Docker)

- Пользователь: `system` (пароль — **Настройки → MQTT (CRM)**; bootstrap — `MQTT_PASSWORD` в `.env`)
- С **v1.1.57**: seed `washpro` лечится до `MQTT_PASSWORD` при старте processor; `mosquitto-init` не перезаписывает существующий passwd на каждый рестарт
- Не используйте `system` на панелях постов

## Изоляция постов

- ACL Mosquitto: пост пишет только в `washpro/{свой-serial}/#`
- Подмена serial в JSON не влияет на чужую статистику
- Синхронизация: мастер настроек → MQTT или сохранение поста

## Телеметрия (пост → CRM)

| Suffix | Содержимое |
|--------|------------|
| `process` | balance, pause, mode, card |
| `totals` | финансы до/после инкассации |
| `usages` | счётчики клиентов/услуг |
| `credit` | зачисление с панели |
| `card` | NFC / инкассация |

## Управление (CRM → пост)

### Из Dashboard

**Посты → ⚙** или страница поста → **Настройки устройства**:

- цены режимов 0–9;
- команды (выпадающий список);
- префикс MQTT.

### Топики MQTT

```
{dt_pref}/{serial}/set/prices
{dt_pref}/{serial}/set/command
```

### HTTP API (JWT)

```
POST /api/crm/post-device/posts/{serial}/prices
POST /api/crm/post-device/posts/{serial}/command
POST /api/crm/post-device/mqtt/sync-users
```

### mosquitto_pub (отладка с сервера CRM)

```bash
mosquitto_pub -h localhost -p 1883 -u system -P 'PASS' -q 1 \
  -t 'washpro/SN123/set/prices' -m '{"0":50,"1":80}'
```

## Журнал MQTT в Dashboard

- Над таблицей: **Загрузить ещё (100 записей)** — серверные страницы через `usePolling`
- Подзаголовок: показано, всего, время обновления
- Тот же паттерн — **история состояний поста** *(v1.1.51)* и **страница уведомлений** *(v1.1.52)*

См. [Dashboard — серверная «Загрузить ещё»](ru-Dashboard).

## Миграция с RabbitMQ

```bash
./scripts/migrate-to-mqtt.sh
```

## Сброс MQTT

```bash
./scripts/fix-mqtt.sh
```
