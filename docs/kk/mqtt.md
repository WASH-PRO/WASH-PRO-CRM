---
layout: default
title: MQTT
description: Пост контроллерлерін MQTT арқылы интеграциялау
---

## Қосылу параметрлері

| Параметр | Мән |
|----------|-----|
| Брокер | Mosquitto 2.x |
| Жариялау топигі | `wash/telemetry/{тип}` немесе `wash/telemetry/#` |
| DLQ | `wash/dlq` |
| QoS | 1 (ұсынылады) |
| Порт | `1883` (әдепкі бойынша хосттың барлық интерфейстерінде) |
| Мекенжай | Жергілікті желіден CRM-серверінің `<IP>:1883` |
| Пайдаланушы (пост) | CRM пост карточкасынан `settings.mqttLogin` / `settings.mqttPassword` |
| Пайдаланушы (CRM) | `system` — пароль **Баптаулар → MQTT (CRM)** ішінде; бірінші іске қосуда `.env` ішіндегі `MQTT_PASSWORD` |

Docker ішінде: `mosquitto:1883` (CRM `system` ретінде қосылады).  
Жергілікті желіден пост: `mqtt://<mqttLogin>:<mqttPassword>@192.168.1.10:1883` (CRM серверінің IP).

Порт **1883** `./scripts/start.sh` кезінде автоматты жарияланады. Сол LAN ішіндегі контроллерлер қосымша overlay-файлдарсыз қосыла алады.

MQTT-ті **тек localhost** қабылдау үшін (LAN-сыз), `.env` ішінде:

```env
MQTT_BIND=127.0.0.1
```

## Хабарлама форматы

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

### Жоғарғы деңгей өрістері

| Өріс | Сипаттама |
|------|----------|
| `washSerial` | Автомойка сериялық нөмірі (опционалды, логтар үшін) |
| `postSerial` | **Міндетті** — CRM-дегі пост сериялық нөмірі |
| `messageType` | Хабарлама түрі (төменге қараңыз) |
| `payload` | Түрге байланысты деректер |
| `timestamp` | ISO 8601 |

### Хабарлама түрлері (`messageType`)

| Түр | Мақсаты | Топик мысалы |
|-----|---------|--------------|
| `mode` | Посттың ағымдағы жұмыс режимі | `wash/telemetry/mode` |
| `state` | Жалпы күй | `wash/telemetry/state` |
| `card` | Карта операциялары | `wash/telemetry/card` |
| `statistics` | Пайдалану статистикасы | `wash/telemetry/statistics` |
| `finance` | Қаржы деректері | `wash/telemetry/finance` |
| `equipment` | Жабдық күйі | `wash/telemetry/equipment` |
| `event` | Оқиғалар және алерттер | `wash/telemetry/event` |
| `settings` | Пост баптауларын өзгерту | `wash/telemetry/settings` |

`message-processor` жазылған:

- `wash/telemetry/#` — legacy envelope (интеграциялар, тесттер)
- `+/+/#` — WASH-PRO native протокол: `state/*`, `set/*` (ETH-модуль және панель)

CRM **MQTT** журналы **әр** кіріс хабарламасын бастапқы JSON-мен сақтайды (бір жариялауға бір жол).

### Dashboard-та журналды көру (`/mqtt`)

| Деңгей | Элемент | Сипаттама |
|--------|---------|----------|
| **API** | Кесте үстіндегі **Тағы жүктеу (100 жазба)** | Серверден телеметрияның келесі беті (100 жазбадан) |
| **Кесте** | DataTable төменгі бөлігі | **Бетте:** 20 / 40 / 60 / 80 / 100 · **Артқа / Алға** · жүктелген жолдар арасында **Тағы жүктеу** |

Сондай-ақ қараңыз [Dashboard — кесте беттеу](dashboard.md#беттеу-v115).

## WASH-PRO native протокол (ETH / панель)

Контроллерлер топикке **жазық JSON** жариялайды:

```
{dt_pref}/{serial_number}/state/{suffix}
```

Мысал: `washpro/WP-001/state/process`

| Suffix | Көз | CRM `messageType` |
|--------|-----|-------------------|
| `process` | Пост күйі (~1 с) | `state` |
| `totals` | Қаржы есептегіштері (~30 с) | `finance` (2 жазба: инкассациядан бұрын/кейін) |
| `usages` | Пайдалану есептегіштері (~30 с) | `statistics` (6 жазба: regular/service/unlimited × инкассациядан бұрын/кейін) |
| `credit` | Төлем (панель) | `event` (`eventType: credit`) |
| `card` | NFC / инкассация (панель) | `card` |

**Пост идентификациясы:** топиктің екінші сегменті (`serial_number`) CRM-ге **өзгертілмей** жіберіледі — ол CRM-дегі пост `serialNumber` өрісімен **дәл сәйкес** келуі керек.

**Ақша өрістері** (`balance`, `tcash`, `acash`, `summ` т.б.) — **рубльде** (бүтін немесе бөлшек, тиыннан түрлендіру жоқ).

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

`state/process` ішіндегі `card` өрісі: `0` — карта белсенді емес; **басқаша — NFC карта нөмірі** (`balance` және `discount`-пен бірге CRM жазбасымен синхрондалады).

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

- `a*` → `finance` / `before_collection` (ағымдағы кезең)
- `t*` → `finance` / `after_collection` (жинақталған итогтар)

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

Мәндер — карта категориялары бойынша **пайдалану минуттары**:

| Өріс | Кезең | CRM категориясы |
|------|-------|-----------------|
| `aclients` | инкассациядан бұрын | `regular` (жеңілдік клиенттері) |
| `aservices` | инкассациядан бұрын | `service` (сервистік қызмет) |
| `aunlims` | инкассациядан бұрын | `unlimited` (VIP) |
| `tclients` | инкассациядан кейін | `regular` |
| `tservices` | инкассациядан кейін | `service` |
| `tunlims` | инкассациядан кейін | `unlimited` |

CRM-де `usageTime` (секунд = минут × 60) және `clientCount` (панельден минут) ретінде сақталады.

### state/credit (панель)

```json
{ "type": 1, "summ": 100 }
```

`type`: 0 — қолма-қол, 1 — қолма-қолсыз, 2 — жеңілдік.

### state/card (панель)

```json
{ "type": 0, "number": 10, "card": 1234567890 }
```

`type`: 0 — жеңілдік, 1 — сервистік, 2 — VIP, 3 — инкассация.

## CRM-ден постты басқару (`set/*`)

CRM командалар мен бағаларды топиктерге жібереді:

```
{dt_pref}/{serial_number}/set/prices
{dt_pref}/{serial_number}/set/command
```

`dt_pref` префиксі панель NVS-імен сәйкес (әдепкі `washpro`). Сериялық нөмір — CRM-дегідей (`posts.serialNumber`).

Веб-интерфейстен сұраулар `message-processor` арқылы өтеді (HTTP → MQTT). Шығыс жариялаулар MQTT журналына да түседі.

### Жеткізу баптаулары (Баптаулар → MQTT)

| Өріс | Әдепкі | Сипаттама |
|------|--------|----------|
| `outboundRetentionHours` | 168 (7 тәулік) | CRM **outbox** ішіндегі шығыс командалар/бағалар сақтау мерзімі |
| `requireDeliveryConfirmation` | `false` | Растау протоколын қосу (`set/ack`) |
| `redeliverOnNoAck` | `false` | ack алынбаса қайта жариялау (тек растау қосылғанда) |
| `redeliverIntervalSec` | 30 | Қайталаулар арасындағы пауза |
| `redeliverMaxAttempts` | 5 | Максималды әрекеттер (біріншісі қоса) |

`requireDeliveryConfirmation=false` (әдепкі) кезінде бұрынғыдай: CRM `set/*` жариялайды, бағалар үшін құрылғы `set/prices`-қа эхо жауабы беруі мүмкін.

`requireDeliveryConfirmation=true` кезінде CRM payload-қа `message_id` (UUID) қосады, `/api/crm/mqtt-outbox`-қа жазба сақтайды және топикте жауап күтеді:

```
{dt_pref}/{serial_number}/set/ack
```

ETH-тан растау форматы:

```json
{
  "kind": "prices",
  "status": "ok",
  "message_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

Қате:

```json
{
  "kind": "command",
  "status": "error",
  "message_id": "550e8400-e29b-41d4-a716-446655440000",
  "cmd": 3,
  "error_message": "INVALID_AMOUNT"
}
```

| `kind` | Бастапқы топик |
|--------|----------------|
| `prices` | `set/prices` |
| `command` | `set/command` |

Кіріс MQTT журналы (`/api/crm/telemetry`) барлық хабарламаларды сақтайды; журнал тазалау мерзімі **архив** баптауларында (`archive.retentionDays`), outbox-тан бөлек.

### set/prices

Кілттер — режим кодтары (`0`–`9`), мәндер — рубльдегі баға:

```json
{
  "0": 50,
  "1": 80,
  "2": 120
}
```

Құрылғы `set/prices`-қа жауап бергенде CRM `posts.settings.modePrices` синхрондай алады.

### set/command

```json
{ "cmd": 1 }
```

| `cmd` | Әрекет |
|-------|--------|
| 1 | Жұмсақ қайта жүктеу |
| 2 | Қатты қайта жүктеу |
| 3 | Баланс енгізу (қос. өріс `summ` — рубль сомасы) |
| 4 | Ақау режимі |
| 5 | Бокс техникалық қызметі |
| 6 | VIP-режим |
| 7 | Инкассация режимі |

Енгізу мысалы:

```json
{ "cmd": 3, "summ": 100 }
```

### CRM веб-интерфейсінен

Пост бетінде (**Посттар → ⚙ → Құрылғы баптаулары** немесе `/posts/{id}#device-settings`):

1. **Режим бағалары** — жұмыс режимдері анықтамалығы бойынша тор (`0`–`9` кодтары). «Бағаларды сақтау» батырмасы мәндерді `posts.settings.modePrices`-ке жазады және чекбокс қосылған болса MQTT `set/prices` жариялайды.
2. **Командалар** — ашылмалы тізім (қайта жүктеулер, баланс енгізу, сервистік режимдер). Енгізу үшін соманы көрсетіңіз. Растау → MQTT `set/command`.
3. **MQTT префиксі** (`dt_pref`) — панель баптауымен сәйкес келуі керек (әдепкі `washpro`).

**create** немесе **update** құқығы қажет (Administrator / Operator рөлдері).

### HTTP API (Dashboard арқылы)

`message-processor` ішкі HTTP-сервері (порт `3022`) nginx арқылы проксиленеді:

| Әдіс | Жол (Dashboard арқылы) | Мақсаты |
|------|------------------------|---------|
| `POST` | `/api/crm/post-device/posts/{serial}/prices` | Бағаларды сақтау және/немесе постқа жіберу |
| `POST` | `/api/crm/post-device/posts/{serial}/command` | Постқа команда жіберу |
| `POST` | `/api/crm/post-device/mqtt/sync-users` | Пост есептерін Mosquitto-ға қолдану |

Авторизация: `Authorization: Bearer <JWT>` тақырыбы (Dashboard-тағы токенмен бірдей).

#### POST …/prices

Сұрау денесі:

```json
{
  "prices": { "0": 50, "1": 80, "2": 120 },
  "mqttPrefix": "washpro",
  "sendToDevice": true,
  "persist": true
}
```

| Өріс | Әдепкі | Сипаттама |
|------|--------|----------|
| `prices` | — | «Режим коды → рубль бағасы» объектісі |
| `mqttPrefix` | `washpro` немесе `MQTT_DEVICE_PREFIX` | Топик префиксі |
| `sendToDevice` | `true` | MQTT-ке жариялау |
| `persist` | `true` | `posts.settings`-ке сақтау |

Жауап: `{ "success": true, "data": { "topic": "washpro/SN123/set/prices", "prices": {...}, "mqttPrefix": "washpro" } }`

#### POST …/command

```json
{
  "command": "credit_balance",
  "amount": 100,
  "mqttPrefix": "washpro"
}
```

`command` мәндері: `soft_reset`, `hard_reset`, `credit_balance`, `fault_mode`, `service_mode`, `vip_mode`, `collection_mode`.

Шығыс жариялаулар `/api/crm/telemetry`-де `payload.direction: "outbound"` ретінде логталады.

### mosquitto_pub мысалдары (командалар және бағалар)

`PASSWORD`, сервер IP және CRM-дегі пост сериялық нөмірін қойыңыз:

```bash
# Режим бағалары
mosquitto_pub -h localhost -p 1883 -u system -P 'PASSWORD' -q 1 \
  -t 'washpro/SN123/set/prices' \
  -m '{"0":50,"1":80,"2":120,"3":40}'

# Жұмсақ қайта жүктеу
mosquitto_pub -h localhost -p 1883 -u system -P 'PASSWORD' -q 1 \
  -t 'washpro/SN123/set/command' \
  -m '{"cmd":1}'

# 100 ₽ енгізу
mosquitto_pub -h localhost -p 1883 -u system -P 'PASSWORD' -q 1 \
  -t 'washpro/SN123/set/command' \
  -m '{"cmd":3,"summ":100}'

# Инкассация режимі
mosquitto_pub -h localhost -p 1883 -u system -P 'PASSWORD' -q 1 \
  -t 'washpro/SN123/set/command' \
  -m '{"cmd":7}'
```

### curl мысалдары (Dashboard арқылы)

```bash
TOKEN="..."   # Кіргеннен кейін браузерден JWT

curl -s -X POST http://localhost/api/crm/post-device/posts/SN123/prices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prices":{"0":50,"1":80},"mqttPrefix":"washpro"}'

curl -s -X POST http://localhost/api/crm/post-device/posts/SN123/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"soft_reset","mqttPrefix":"washpro"}'
```

### Құрылғыдан баға синхрондауы

Панель `set/prices`-қа жауап жарияласа, `message-processor` CRM-дегі `posts.settings.modePrices` автоматты жаңартады.

### CRM брокеріне ETH баптау

Панель NVS-інде (`get_settings.remote`):

| Өріс | CRM үшін мән |
|------|--------------|
| `rm_en` | `1` |
| `rm_addr` | CRM сервер IP |
| `rm_port` | `1883` |
| `rm_login` / `rm_pass` | CRM пост карточкасынан логин/пароль (`settings.mqttLogin` / `settings.mqttPassword`) |
| `dt_pref` | мысалы `washpro` |

## Legacy envelope (wash/telemetry)

Сыртқы интеграциялар үшін JSON-қаптама қолдаулы (қараңыз [Хабарлама форматы](#хабарлама-форматы)) `wash/telemetry/{тип}` топигінде.

## Пост идентификациясы

`message-processor` `/api/crm/posts` ішінде `serialNumber` бойынша пост іздейді:

- **Native протокол** — топиктен serial (`{dt_pref}/{serial}/state/...`), 1:1
- **Legacy** — JSON ішіндегі `postSerial` өрісі

## Қателерді өңдеу

- Сәтті хабарлама — өңделді және CRM-ге жазылды
- Өңдеу қатесі — хабарлама `wash/dlq`-ға жарияланады, толыққанды болғанда хабарландыру жасалады
- Брокер қолжетімсіз болса процессор 5 секунд сайын қайта қосылады

## Жариялау мысалы (Node.js)

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

## Жариялау мысалы (mosquitto_pub)

```bash
# CRM серверінен
mosquitto_pub -h localhost -p 1883 -u system -P 'PASSWORD' \
  -t 'wash/telemetry/mode' -q 1 \
  -m '{"postSerial":"POST-001","messageType":"mode","payload":{"mode":"idle"},"timestamp":"2024-06-22T12:00:00Z"}'

# Жергілікті желідегі басқа құрылғыдан
mosquitto_pub -h 192.168.1.10 -p 1883 -u system -P 'PASSWORD' \
  -t 'wash/telemetry/mode' -q 1 \
  -m '{"postSerial":"POST-001","messageType":"mode","payload":{"mode":"idle"},"timestamp":"2024-06-22T12:00:00Z"}'
```

## Портты ауыстыру

```env
MQTT_EXTERNAL_PORT=1883
```

Өзгерткеннен кейін: `docker compose up -d mosquitto`.

## Қауіпсіздік

Порт 1883 жергілікті желідегі құрылғыларға қолжетімді. `mosquitto.conf` ішінде міндетті `per_listener_settings true`: әйтпесе healthcheck порты 1884-тегі `allow_anonymous true` 1883-тегі авторизацияны өшіреді.

- Пост панелі **пост карточкасынан логин/парольмен** қосылады (`settings.mqttLogin` / `settings.mqttPassword`).
- Mosquitto passwd ішінде тек **system** (CRM) және пост есептері рұқсат. 1883-те анонимдік қолжетімділік тыйым салынған.
- **Пост оқшаулауы:** ACL әр постқа тек **өз сериялық нөмірі** топиктерінде жариялау/оқуға рұқсат береді (`washpro/{serial}/#`). Payload-тағы serial ауыстыру CRM-ге әсер етпейді — топиктен serial ескеріледі.
- `system` барлық топиктерге толық қолжетімділікке ие (CRM және отладка).
- `system`, `superadmin` және `wash` логиндерін постқа тағайындауға болмайды — олар резервтелген.
- CRM-де пароль немесе serial өзгергеннен кейін шеберде «MQTT синхрондау» басыңыз немесе постты сақтаңыз (синхрондау автоматты).

`.env` ішінде сенімді `MQTT_PASSWORD` орнатыңыз және қажет болса файрволмен қолжетімділікті шектеңіз.
