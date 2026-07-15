---
layout: default
title: MQTT
description: Интеграция контроллеров постов через MQTT
---

## Параметры подключения

| Параметр | Значение |
|----------|----------|
| Брокер | Mosquitto 2.x |
| Топик публикации | `wash/telemetry/{тип}` или `wash/telemetry/#` |
| DLQ | `wash/dlq` |
| QoS | 1 (рекомендуется) |
| Порт | `1883` (по умолчанию на всех интерфейсах хоста) |
| Адрес | `<IP-сервера-CRM>:1883` из локальной сети |
| Пользователь (пост) | `settings.mqttLogin` / `settings.mqttPassword` из карточки поста в CRM (правка — форма в **списке постов**; сохранение названия на странице поста не трогает пароль с *v1.1.54*) |
| Пользователь (CRM) | `system` — пароль в **Настройки → MQTT (CRM)**; при первом запуске также `MQTT_PASSWORD` в `.env` |

Внутри Docker: `mosquitto:1883` (CRM подключается как `system`).  
С локальной сети пост: `mqtt://<mqttLogin>:<mqttPassword>@192.168.1.10:1883` (IP сервера с CRM).

Порт **1883** публикуется автоматически при `./scripts/start.sh`. Контроллеры в той же LAN могут подключаться без дополнительных overlay-файлов.

Чтобы принимать MQTT **только с localhost** (не из LAN), в `.env`:

```env
MQTT_BIND=127.0.0.1
```

## Формат сообщения

```json
{
  "washSerial": "WASH-001",
  "postSerial": "POST-001",
  "messageType": "mode",
  "payload": {
    "mode": "wash",
    "modeName": "Мойка",
    "modeNumber": 1,
    "freePause": 30,
    "paidPause": 15,
    "modeTime": 120
  },
  "timestamp": "2024-06-22T12:00:00Z"
}
```

### Поля верхнего уровня

| Поле | Описание |
|------|----------|
| `washSerial` | Серийный номер автомойки (опционально, для логов) |
| `postSerial` | **Обязательно** — серийный номер поста из CRM |
| `messageType` | Тип сообщения (см. ниже) |
| `payload` | Данные, зависящие от типа |
| `timestamp` | ISO 8601 |

### Типы сообщений (`messageType`)

| Тип | Назначение | Пример топика |
|-----|------------|---------------|
| `mode` | Текущий режим работы поста | `wash/telemetry/mode` |
| `state` | Общее состояние | `wash/telemetry/state` |
| `card` | Операции с картой | `wash/telemetry/card` |
| `statistics` | Статистика использования | `wash/telemetry/statistics` |
| `finance` | Финансовые данные | `wash/telemetry/finance` |
| `equipment` | Состояние оборудования | `wash/telemetry/equipment` |
| `event` | События и алерты | `wash/telemetry/event` |
| `settings` | Изменение настроек поста | `wash/telemetry/settings` |

`message-processor` подписан на:

- `wash/telemetry/#` — legacy envelope (интеграции, тесты)
- `+/+/#` — нативный протокол WASH-PRO: `state/*`, `set/*` (ETH-модуль и панель)

Журнал **MQTT** в CRM сохраняет **каждое** входящее сообщение с исходным JSON (одна строка на публикацию).

### Просмотр журнала в Dashboard (`/mqtt`)

| Уровень | Элемент | Описание |
|---------|---------|----------|
| **API** | **Загрузить ещё (100 записей)** над таблицей | Следующая страница телеметрии с сервера (по 100 записей) |
| **Таблица** | Подвал DataTable | **На странице:** 20 / 40 / 60 / 80 / 100 · **Назад / Далее** · **Загрузить ещё** среди уже загруженных строк |

См. также [Dashboard — серверная «Загрузить ещё»](dashboard.md#крупные-журналы-серверная-загрузить-ещё).

## Нативный протокол WASH-PRO (ETH / панель)

Контроллеры публикуют **плоский JSON** в топик:

```
{dt_pref}/{serial_number}/state/{suffix}
```

Пример: `washpro/WP-001/state/process`

| Suffix | Источник | CRM `messageType` |
|--------|----------|-------------------|
| `process` | Состояние поста (~1 с) | `state` |
| `totals` | Счётчики финансов (~30 с) | `finance` (2 записи: до/после инкассации) |
| `usages` | Счётчики использования (~30 с) | `statistics` (6 записей: regular/service/unlimited × до/после инкассации) |
| `credit` | Зачисление (панель) | `event` (`eventType: credit`) |
| `card` | NFC / инкассация (панель) | `card` |

**Идентификация поста:** второй сегмент топика (`serial_number`) передаётся в CRM **как есть**, без преобразований — он должен **точно совпадать** с полем `serialNumber` поста в CRM.

**Денежные поля** (`balance`, `tcash`, `acash`, `summ` и т.д.) — в **рублях** (целые или дробные, без перевода из копеек).

### state/process

```json
{
  "balance": 120,
  "discount": 0,
  "pause": 30,
  "inactiv": 0,
  "light": 0,
  "card": 0,
  "type": 0,
  "number": 2
}
```

Маппинг: `pause` → `freePause`, `number` → `modeNumber`, `card`/`type`/`inactiv`/`light` → `equipmentState`.

Поле `card` в `state/process`: `0` — карта не активна; **иначе — номер NFC-карты** (синхронизируется с записью в CRM вместе с `balance` и `discount`).

### state/totals

```json
{
  "tcash": 45600,
  "tnoncash": 78900,
  "tdiscount": 12300,
  "acash": 2300,
  "anoncash": 4500,
  "adiscount": 890
}
```

- `a*` → `finance` / `before_collection` (текущий период)
- `t*` → `finance` / `after_collection` (накопительные итоги)

### state/usages

```json
{
  "tclients": 1234,
  "tservices": 890,
  "tunlims": 45,
  "aclients": 56,
  "aservices": 12,
  "aunlims": 3
}
```

Значения — **минуты** использования по категориям карт:

| Поле | Период | Категория CRM |
|------|--------|----------------|
| `aclients` | до инкассации | `regular` (скидочные клиенты) |
| `aservices` | до инкассации | `service` (сервисное обслуживание) |
| `aunlims` | до инкассации | `unlimited` (VIP) |
| `tclients` | после инкассации | `regular` |
| `tservices` | после инкассации | `service` |
| `tunlims` | после инкассации | `unlimited` |

В CRM сохраняются как `usageTime` (секунды = минуты × 60) и `clientCount` (минуты с панели).

### state/credit (панель)

```json
{ "type": 1, "summ": 100 }
```

`type`: 0 — наличные, 1 — безнал, 2 — скидка.

### state/card (панель)

```json
{ "type": 0, "number": 10, "card": 1234567890 }
```

`type`: 0 — скидочная, 1 — сервисная, 2 — VIP, 3 — инкассация.

## Управление постом из CRM (`set/*`)

CRM отправляет команды и цены в топики:

```
{dt_pref}/{serial_number}/set/prices
{dt_pref}/{serial_number}/set/command
{dt_pref}/{serial_number}/set/surge
```

Префикс `dt_pref` совпадает с NVS панели (по умолчанию `washpro`). Серийный номер — как в CRM (`posts.serialNumber`).

Запросы из веб-интерфейса идут через `message-processor` (HTTP → MQTT). Исходящие публикации также попадают в журнал MQTT.

### Настройки доставки (Настройки → MQTT)

| Поле | По умолчанию | Описание |
|------|--------------|----------|
| `outboundRetentionHours` | 168 (7 суток) | Срок хранения исходящих команд/цен в **outbox** CRM |
| `requireDeliveryConfirmation` | `false` | Включить протокол подтверждения (`set/ack`) |
| `redeliverOnNoAck` | `false` | Повторять публикацию, если ack не получен (только при включённом подтверждении) |
| `redeliverIntervalSec` | 30 | Пауза между повторами |
| `redeliverMaxAttempts` | 5 | Максимум попыток (включая первую) |

При `requireDeliveryConfirmation=false` (по умолчанию) поведение как раньше: CRM публикует `set/*`, для цен устройство может ответить эхом на `set/prices`.

При `requireDeliveryConfirmation=true` CRM добавляет в payload поле `message_id` (UUID), сохраняет запись в `/api/crm/mqtt-outbox` и ждёт ответ в топике:

```
{dt_pref}/{serial_number}/set/ack
```

Формат подтверждения от ETH:

```json
{
  "kind": "prices",
  "status": "ok",
  "message_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

Ошибка:

```json
{
  "kind": "command",
  "status": "error",
  "message_id": "550e8400-e29b-41d4-a716-446655440000",
  "cmd": 3,
  "error_message": "INVALID_AMOUNT"
}
```

| `kind` | Исходный топик |
|--------|----------------|
| `prices` | `set/prices` |
| `command` | `set/command` |
| `surge` | `set/surge` |

Журнал входящих MQTT (`/api/crm/telemetry`) по-прежнему хранит все сообщения; срок очистки журнала задаётся в настройках **архива** (`archive.retentionDays`), отдельно от outbox.

### set/prices

Ключи — коды режимов (`0`–`9`), значения — цена в рублях:

```json
{
  "0": 50,
  "1": 80,
  "2": 120
}
```

При ответе устройства на `set/prices` CRM может синхронизировать `posts.settings.modePrices`.

### set/command

```json
{ "cmd": 1 }
```

| `cmd` | Действие |
|-------|----------|
| 1 | Мягкая перезагрузка |
| 2 | Жёсткая перезагрузка |
| 3 | Зачисление баланса (доп. поле `summ` — сумма в рублях) |
| 4 | Режим неисправности |
| 5 | Обслуживание бокса |
| 6 | VIP-режим |
| 7 | Режим инкассации |

Пример зачисления:

```json
{ "cmd": 3, "summ": 100 }
```

### set/surge *(модуль «Динамические цены», v1.1.0+)*

Коэффициент списания баланса **без изменения прайс-листа**. Публикуется CRM от учётной записи `system`. На устройстве должен применяться **до обнуления баланса** текущей сессии (см. `CLIENT.md` в репозитории модуля).

Включить (+10%):

```json
{
  "coefficient": 1.10,
  "active": 1,
  "until_balance_zero": 1
}
```

Отключить:

```json
{
  "coefficient": 1.0,
  "active": 0,
  "until_balance_zero": 0
}
```

| Поле | Описание |
|------|----------|
| `coefficient` | Множитель списания (≥ 1.0) |
| `active` | `1` — принять, `0` — сброс для новых сессий |
| `until_balance_zero` | `1` — действует до `balance == 0`, затем автосброс на устройстве |

### Из веб-интерфейса CRM

На странице поста (**Посты → ⚙ → Настройки устройства** или `/posts/{id}#device-settings`):

1. **Цены режимов** — сетка по справочнику режимов работы (коды `0`–`9`). Кнопка «Сохранить цены» записывает значения в `posts.settings.modePrices` и при включённом чекбоксе публикует MQTT `set/prices`.
2. **Команды** — выпадающий список (перезагрузки, зачисление баланса, сервисные режимы). Для зачисления укажите сумму. Подтверждение → MQTT `set/command`.
3. **Префикс MQTT** (`dt_pref`) — должен совпадать с настройкой панели (по умолчанию `washpro`).

Требуется право **create** или **update** (роли Administrator / Operator).

### HTTP API (через Dashboard)

Внутренний HTTP-сервер `message-processor` (порт `3022`) проксируется nginx:

| Метод | Путь (через Dashboard) | Назначение |
|-------|------------------------|------------|
| `POST` | `/api/crm/post-device/posts/{serial}/prices` | Сохранить цены и/или отправить на пост |
| `POST` | `/api/crm/post-device/posts/{serial}/command` | Отправить команду на пост |
| `POST` | `/api/crm/post-device/posts/{serial}/surge` | Коэффициент динамического списания (`set/surge`) |
| `POST` | `/api/crm/post-device/mqtt/sync-users` | Применить учётные записи постов в Mosquitto |

Авторизация: заголовок `Authorization: Bearer <JWT>` (тот же токен, что у Dashboard).

#### POST …/prices

Тело запроса:

```json
{
  "prices": { "0": 50, "1": 80, "2": 120 },
  "mqttPrefix": "washpro",
  "sendToDevice": true,
  "persist": true
}
```

| Поле | По умолчанию | Описание |
|------|--------------|----------|
| `prices` | — | Объект «код режима → цена в рублях» |
| `mqttPrefix` | `washpro` или `MQTT_DEVICE_PREFIX` | Префикс топика |
| `sendToDevice` | `true` | Публиковать в MQTT |
| `persist` | `true` | Сохранить в `posts.settings` |

Ответ: `{ "success": true, "data": { "topic": "washpro/SN123/set/prices", "prices": {...}, "mqttPrefix": "washpro" } }`

#### POST …/command

```json
{
  "command": "credit_balance",
  "amount": 100,
  "mqttPrefix": "washpro"
}
```

Значения `command`: `soft_reset`, `hard_reset`, `credit_balance`, `fault_mode`, `service_mode`, `vip_mode`, `collection_mode`.

Исходящие публикации логируются в `/api/crm/telemetry` с `payload.direction: "outbound"`.

### Примеры mosquitto_pub (команды и цены)

Подставьте `PASSWORD`, IP сервера и серийный номер поста из CRM:

```bash
# Цены режимов
mosquitto_pub -h localhost -p 1883 -u system -P 'PASSWORD' -q 1 \
  -t 'washpro/SN123/set/prices' \
  -m '{"0":50,"1":80,"2":120,"3":40}'

# Мягкая перезагрузка
mosquitto_pub -h localhost -p 1883 -u system -P 'PASSWORD' -q 1 \
  -t 'washpro/SN123/set/command' \
  -m '{"cmd":1}'

# Зачисление 100 ₽
mosquitto_pub -h localhost -p 1883 -u system -P 'PASSWORD' -q 1 \
  -t 'washpro/SN123/set/command' \
  -m '{"cmd":3,"summ":100}'

# Режим инкассации
mosquitto_pub -h localhost -p 1883 -u system -P 'PASSWORD' -q 1 \
  -t 'washpro/SN123/set/command' \
  -m '{"cmd":7}'
```

### Примеры curl (через Dashboard)

```bash
TOKEN="..."   # JWT из браузера после входа

curl -s -X POST http://localhost/api/crm/post-device/posts/SN123/prices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prices":{"0":50,"1":80},"mqttPrefix":"washpro"}'

curl -s -X POST http://localhost/api/crm/post-device/posts/SN123/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"soft_reset","mqttPrefix":"washpro"}'
```

### Синхронизация цен с устройства

Если панель публикует ответ на `set/prices`, `message-processor` обновляет `posts.settings.modePrices` в CRM автоматически.

### Настройка ETH на CRM-брокер

В NVS панели (`get_settings.remote`):

| Поле | Значение для CRM |
|------|------------------|
| `rm_en` | `1` |
| `rm_addr` | IP сервера CRM |
| `rm_port` | `1883` |
| `rm_login` / `rm_pass` | Логин и пароль из карточки поста в CRM (`settings.mqttLogin` / `settings.mqttPassword`) |
| `dt_pref` | например `washpro` |

## Legacy envelope (wash/telemetry)

Для сторонних интеграций поддерживается JSON-обёртка (см. [Формат сообщения](#формат-сообщения)) в топике `wash/telemetry/{тип}`.

## Идентификация поста

`message-processor` ищет пост по `serialNumber` в `/api/crm/posts`:

- **Нативный протокол** — serial из топика (`{dt_pref}/{serial}/state/...`), 1:1
- **Legacy** — поле `postSerial` в JSON

## Обработка ошибок

- Успешное сообщение — обработано и записано в CRM
- Ошибка обработки — сообщение публикуется в `wash/dlq`, создаётся уведомление при переполнении
- При недоступности брокера процессор переподключается каждые 5 секунд

## Пример публикации (Node.js)

```javascript
import mqtt from 'mqtt';

const client = mqtt.connect('mqtt://system:PASSWORD@192.168.1.10:1883');

client.on('connect', () => {
  const msg = {
    postSerial: 'POST-001',
    messageType: 'mode',
    payload: { mode: 'idle', modeName: 'Ожидание', modeNumber: 0 },
    timestamp: new Date().toISOString(),
  };

  client.publish('wash/telemetry/mode', JSON.stringify(msg), { qos: 1 }, () => {
    client.end();
  });
});
```

## Пример публикации (mosquitto_pub)

```bash
# С самого сервера CRM
mosquitto_pub -h localhost -p 1883 -u system -P 'PASSWORD' \
  -t 'wash/telemetry/mode' -q 1 \
  -m '{"postSerial":"POST-001","messageType":"mode","payload":{"mode":"idle"},"timestamp":"2024-06-22T12:00:00Z"}'

# С другого устройства в локальной сети
mosquitto_pub -h 192.168.1.10 -p 1883 -u system -P 'PASSWORD' \
  -t 'wash/telemetry/mode' -q 1 \
  -m '{"postSerial":"POST-001","messageType":"mode","payload":{"mode":"idle"},"timestamp":"2024-06-22T12:00:00Z"}'
```

## Смена порта

```env
MQTT_EXTERNAL_PORT=1883
```

После изменения: `docker compose up -d mosquitto`.

## Безопасность

Порт 1883 доступен устройствам в локальной сети. В `mosquitto.conf` обязательно `per_listener_settings true`: иначе `allow_anonymous true` на healthcheck-порту 1884 отключает авторизацию на 1883.

- Панель поста подключается с **логином/паролем из карточки поста** (`settings.mqttLogin` / `settings.mqttPassword`).
- В passwd Mosquitto допускаются только **system** (CRM) и учётные записи постов. Анонимный доступ на 1883 запрещён.
- **Изоляция постов:** ACL разрешает каждому посту публиковать и читать только топики со **своим серийным номером** (`washpro/{serial}/#`). Подмена serial в payload не влияет на CRM — учитывается serial из топика.
- `system` имеет полный доступ ко всем топикам (CRM и отладка).
- Логины `system`, `superadmin` и `wash` нельзя назначать посту — они зарезервированы.
- После смены пароля или serial в CRM нажмите «Синхронизировать MQTT» в мастере или сохраните пост (синхронизация выполняется автоматически).

Задайте надёжный `MQTT_PASSWORD` в `.env` и при необходимости ограничьте доступ файрволом.
