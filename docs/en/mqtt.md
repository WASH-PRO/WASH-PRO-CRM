---
layout: default
title: MQTT
description: Connect self-service post controllers to WASH PRO CRM over MQTT — topics, status updates, commands, and live SCADA integration.
---

## Connection parameters

| Parameter | Value |
|-----------|-------|
| Broker | Mosquitto 2.x |
| Publish topic | `wash/telemetry/{type}` or `wash/telemetry/#` |
| DLQ | `wash/dlq` |
| QoS | 1 (recommended) |
| Port | `1883` (default on all host interfaces) |
| Address | `<CRM-server-IP>:1883` from local network |
| User (post) | `settings.mqttLogin` / `settings.mqttPassword` from post card in CRM (edit via **Posts list** form; saving the name on the post detail page does not clear the password since *v1.1.54*) |
| User (CRM) | `system` — password in **Settings → MQTT (CRM)**; on first launch also `MQTT_PASSWORD` in `.env` |

Inside Docker: `mosquitto:1883` (CRM connects as `system`).  
From local network, post: `mqtt://<mqttLogin>:<mqttPassword>@192.168.1.10:1883` (CRM server IP).

Port **1883** is published automatically with `./scripts/start.sh`. Controllers on the same LAN can connect without additional overlay files.

To accept MQTT **localhost only** (not from LAN), in `.env`:

```env
MQTT_BIND=127.0.0.1
```

## Message format

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

### Top-level fields

| Field | Description |
|-------|-------------|
| `washSerial` | Car wash serial number (optional, for logs) |
| `postSerial` | **Required** — post serial number from CRM |
| `messageType` | Message type (see below) |
| `payload` | Type-dependent data |
| `timestamp` | ISO 8601 |

### Message types (`messageType`)

| Type | Purpose | Example topic |
|------|---------|---------------|
| `mode` | Current post operating mode | `wash/telemetry/mode` |
| `state` | General state | `wash/telemetry/state` |
| `card` | Card operations | `wash/telemetry/card` |
| `statistics` | Usage statistics | `wash/telemetry/statistics` |
| `finance` | Financial data | `wash/telemetry/finance` |
| `equipment` | Equipment state | `wash/telemetry/equipment` |
| `event` | Events and alerts | `wash/telemetry/event` |
| `settings` | Post settings change | `wash/telemetry/settings` |

`message-processor` subscribes to:

- `wash/telemetry/#` — legacy envelope (integrations, tests)
- `+/+/#` — WASH-PRO native protocol: `state/*`, `set/*` (ETH module and panel)

The **MQTT** log in CRM stores **every** inbound message with original JSON (one row per publication).

### Viewing the log in Dashboard (`/mqtt`)

| Level | Element | Description |
|-------|---------|-------------|
| **API** | **Load more (100 rows)** above table | Next telemetry page from server (100 rows each) |
| **Table** | DataTable footer | **Per page:** 20 / 40 / 60 / 80 / 100 · **Back / Next** · **Load more** among loaded rows |

See also [Dashboard — server-side Load more](dashboard.md#large-logs-server-side-load-more).

## WASH-PRO native protocol (ETH / panel)

Controllers publish **flat JSON** to topic:

```
{dt_pref}/{serial_number}/state/{suffix}
```

Example: `washpro/WP-001/state/process`

| Suffix | Source | CRM `messageType` |
|--------|--------|-------------------|
| `process` | Post state (~1 s) | `state` |
| `totals` | Finance counters (~30 s) | `finance` (2 records: before/after collection) |
| `usages` | Usage counters (~30 s) | `statistics` (6 records: regular/service/unlimited × before/after collection) |
| `credit` | Credit (panel) | `event` (`eventType: credit`) |
| `card` | NFC / collection (panel) | `card` |

**Post identification:** second topic segment (`serial_number`) is passed to CRM **as-is**, without transformation — it must **exactly match** the post `serialNumber` field in CRM.

**Monetary fields** (`balance`, `tcash`, `acash`, `summ`, etc.) — in **rubles** (integer or fractional, no kopeck conversion).

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

Mapping: `pause` → `freePause`, `number` → `modeNumber`, `card`/`type`/`inactiv`/`light` → `equipmentState`.

`card` field in `state/process`: `0` — card not active; **otherwise — NFC card number** (synced with CRM record along with `balance` and `discount`).

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

- `a*` → `finance` / `before_collection` (current period)
- `t*` → `finance` / `after_collection` (cumulative totals)

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

Values are **minutes** of usage by card category:

| Field | Period | CRM category |
|-------|--------|--------------|
| `aclients` | before collection | `regular` (discount clients) |
| `aservices` | before collection | `service` (service maintenance) |
| `aunlims` | before collection | `unlimited` (VIP) |
| `tclients` | after collection | `regular` |
| `tservices` | after collection | `service` |
| `tunlims` | after collection | `unlimited` |

Stored in CRM as `usageTime` (seconds = minutes × 60) and `clientCount` (minutes from panel).

### state/credit (panel)

```json
{ "type": 1, "summ": 100 }
```

`type`: 0 — cash, 1 — cashless, 2 — discount.

### state/card (panel)

```json
{ "type": 0, "number": 10, "card": 1234567890 }
```

`type`: 0 — discount, 1 — service, 2 — VIP, 3 — collection.

## Post control from CRM (`set/*`)

CRM sends commands and prices to topics:

```
{dt_pref}/{serial_number}/set/prices
{dt_pref}/{serial_number}/set/command
{dt_pref}/{serial_number}/set/surge
```

Prefix `dt_pref` matches panel NVS (default `washpro`). Serial number — as in CRM (`posts.serialNumber`).

Web UI requests go through `message-processor` (HTTP → MQTT). Outbound publications also appear in the MQTT log.

### Delivery settings (Settings → MQTT)

| Field | Default | Description |
|-------|---------|-------------|
| `outboundRetentionHours` | 168 (7 days) | Retention of outbound commands/prices in CRM **outbox** |
| `requireDeliveryConfirmation` | `false` | Enable acknowledgment protocol (`set/ack`) |
| `redeliverOnNoAck` | `false` | Republish if ack not received (only when confirmation enabled) |
| `redeliverIntervalSec` | 30 | Pause between retries |
| `redeliverMaxAttempts` | 5 | Max attempts (including first) |

With `requireDeliveryConfirmation=false` (default) behavior is as before: CRM publishes `set/*`, for prices the device may echo on `set/prices`.

With `requireDeliveryConfirmation=true` CRM adds `message_id` (UUID) to payload, saves record in `/api/crm/mqtt-outbox`, and waits for response on topic:

```
{dt_pref}/{serial_number}/set/ack
```

ETH acknowledgment format:

```json
{
  "kind": "prices",
  "status": "ok",
  "message_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

Error:

```json
{
  "kind": "command",
  "status": "error",
  "message_id": "550e8400-e29b-41d4-a716-446655440000",
  "cmd": 3,
  "error_message": "INVALID_AMOUNT"
}
```

| `kind` | Source topic |
|--------|--------------|
| `prices` | `set/prices` |
| `command` | `set/command` |
| `surge` | `set/surge` |

Inbound MQTT log (`/api/crm/telemetry`) still stores all messages; log cleanup period is set in **archive** settings (`archive.retentionDays`), separate from outbox.

### set/prices

Keys — mode codes (`0`–`9`), values — price in rubles:

```json
{
  "0": 50,
  "1": 80,
  "2": 120
}
```

On device response to `set/prices`, CRM may sync `posts.settings.modePrices`.

### set/command

```json
{ "cmd": 1 }
```

| `cmd` | Action |
|-------|--------|
| 1 | Soft reset |
| 2 | Hard reset |
| 3 | Credit balance (extra field `summ` — amount in rubles) |
| 4 | Fault mode |
| 5 | Bay maintenance |
| 6 | VIP mode |
| 7 | Collection mode |

Credit example:

```json
{ "cmd": 3, "summ": 100 }
```

### set/surge *(Dynamic Pricing module, v1.1.0+)*

Debit coefficient **without changing the price list**. Published by CRM as user `system`. Device must apply it **until the current session balance reaches zero** (see `CLIENT.md` in the module repo).

Enable (+10%):

```json
{
  "coefficient": 1.10,
  "active": 1,
  "until_balance_zero": 1
}
```

Disable:

```json
{
  "coefficient": 1.0,
  "active": 0,
  "until_balance_zero": 0
}
```

| Field | Description |
|-------|-------------|
| `coefficient` | Debit multiplier (≥ 1.0) |
| `active` | `1` — apply, `0` — clear for new sessions |
| `until_balance_zero` | `1` — active until `balance == 0`, then auto-reset on device |

### From CRM web UI

On the post page (**Posts → ⚙ → Device settings** or `/posts/{id}#device-settings`):

1. **Mode prices** — grid from work mode reference (codes `0`–`9`). "Save prices" writes values to `posts.settings.modePrices` and, if checkbox enabled, publishes MQTT `set/prices`.
2. **Commands** — dropdown (resets, credit balance, service modes). For credit, specify amount. Confirm → MQTT `set/command`.
3. **MQTT prefix** (`dt_pref`) — must match panel setting (default `washpro`).

Requires **create** or **update** permission (Administrator / Operator roles).

### HTTP API (via Dashboard)

Internal HTTP server `message-processor` (port `3022`) proxied by nginx:

| Method | Path (via Dashboard) | Purpose |
|--------|----------------------|---------|
| `POST` | `/api/crm/post-device/posts/{serial}/prices` | Save prices and/or send to post |
| `POST` | `/api/crm/post-device/posts/{serial}/command` | Send command to post |
| `POST` | `/api/crm/post-device/posts/{serial}/surge` | Dynamic debit coefficient (`set/surge`) |
| `POST` | `/api/crm/post-device/mqtt/sync-users` | Apply post accounts in Mosquitto |

Authorization: `Authorization: Bearer <JWT>` header (same token as Dashboard).

#### POST …/prices

Request body:

```json
{
  "prices": { "0": 50, "1": 80, "2": 120 },
  "mqttPrefix": "washpro",
  "sendToDevice": true,
  "persist": true
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `prices` | — | Object "mode code → price in rubles" |
| `mqttPrefix` | `washpro` or `MQTT_DEVICE_PREFIX` | Topic prefix |
| `sendToDevice` | `true` | Publish to MQTT |
| `persist` | `true` | Save to `posts.settings` |

Response: `{ "success": true, "data": { "topic": "washpro/SN123/set/prices", "prices": {...}, "mqttPrefix": "washpro" } }`

#### POST …/command

```json
{
  "command": "credit_balance",
  "amount": 100,
  "mqttPrefix": "washpro"
}
```

`command` values: `soft_reset`, `hard_reset`, `credit_balance`, `fault_mode`, `service_mode`, `vip_mode`, `collection_mode`.

Outbound publications logged in `/api/crm/telemetry` with `payload.direction: "outbound"`.

### mosquitto_pub examples (commands and prices)

Substitute `PASSWORD`, server IP, and post serial from CRM:

```bash
# Mode prices
mosquitto_pub -h localhost -p 1883 -u system -P 'PASSWORD' -q 1 \
  -t 'washpro/SN123/set/prices' \
  -m '{"0":50,"1":80,"2":120,"3":40}'

# Soft reset
mosquitto_pub -h localhost -p 1883 -u system -P 'PASSWORD' -q 1 \
  -t 'washpro/SN123/set/command' \
  -m '{"cmd":1}'

# Credit 100 ₽
mosquitto_pub -h localhost -p 1883 -u system -P 'PASSWORD' -q 1 \
  -t 'washpro/SN123/set/command' \
  -m '{"cmd":3,"summ":100}'

# Collection mode
mosquitto_pub -h localhost -p 1883 -u system -P 'PASSWORD' -q 1 \
  -t 'washpro/SN123/set/command' \
  -m '{"cmd":7}'
```

### curl examples (via Dashboard)

```bash
TOKEN="..."   # JWT from browser after login

curl -s -X POST http://localhost/api/crm/post-device/posts/SN123/prices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prices":{"0":50,"1":80},"mqttPrefix":"washpro"}'

curl -s -X POST http://localhost/api/crm/post-device/posts/SN123/command \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"command":"soft_reset","mqttPrefix":"washpro"}'
```

### Price sync from device

If the panel publishes a response to `set/prices`, `message-processor` updates `posts.settings.modePrices` in CRM automatically.

### ETH configuration for CRM broker

In panel NVS (`get_settings.remote`):

| Field | Value for CRM |
|-------|---------------|
| `rm_en` | `1` |
| `rm_addr` | CRM server IP |
| `rm_port` | `1883` |
| `rm_login` / `rm_pass` | Login and password from post card in CRM (`settings.mqttLogin` / `settings.mqttPassword`) |
| `dt_pref` | e.g. `washpro` |

## Legacy envelope (wash/telemetry)

For third-party integrations, JSON wrapper (see [Message format](#message-format)) in topic `wash/telemetry/{type}` is supported.

## Post identification

`message-processor` finds post by `serialNumber` in `/api/crm/posts`:

- **Native protocol** — serial from topic (`{dt_pref}/{serial}/state/...`), 1:1
- **Legacy** — `postSerial` field in JSON

## Error handling

- Successful message — processed and written to CRM
- Processing error — message published to `wash/dlq`, notification on overflow
- On broker unavailability processor reconnects every 5 seconds

## Publication example (Node.js)

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

## Publication example (mosquitto_pub)

```bash
# From CRM server itself
mosquitto_pub -h localhost -p 1883 -u system -P 'PASSWORD' \
  -t 'wash/telemetry/mode' -q 1 \
  -m '{"postSerial":"POST-001","messageType":"mode","payload":{"mode":"idle"},"timestamp":"2024-06-22T12:00:00Z"}'

# From another device on local network
mosquitto_pub -h 192.168.1.10 -p 1883 -u system -P 'PASSWORD' \
  -t 'wash/telemetry/mode' -q 1 \
  -m '{"postSerial":"POST-001","messageType":"mode","payload":{"mode":"idle"},"timestamp":"2024-06-22T12:00:00Z"}'
```

## Port change

```env
MQTT_EXTERNAL_PORT=1883
```

After change: `docker compose up -d mosquitto`.

## Security

Port 1883 is available to devices on the local network. In `mosquitto.conf`, `per_listener_settings true` is required: otherwise `allow_anonymous true` on healthcheck port 1884 disables auth on 1883.

- Post panel connects with **login/password from post card** (`settings.mqttLogin` / `settings.mqttPassword`).
- Mosquitto passwd allows only **system** (CRM) and post accounts. Anonymous access on 1883 is forbidden.
- **Post isolation:** ACL allows each post to publish and read only topics with **its own serial number** (`washpro/{serial}/#`). Serial spoofing in payload does not affect CRM — serial from topic is used.
- `system` has full access to all topics (CRM and debugging).
- Logins `system`, `superadmin`, and `wash` cannot be assigned to posts — they are reserved.
- After password or serial change in CRM, click "Sync MQTT" in wizard or save post (sync runs automatically).

Set a strong `MQTT_PASSWORD` in `.env` and restrict access with firewall if needed.
