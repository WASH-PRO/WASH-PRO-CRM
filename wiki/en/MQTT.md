> **English** · **[Русский](ru-MQTT)** · [← Wiki](Home)

# MQTT and Post Control

Full documentation: [docs/mqtt.md](https://wash-pro.github.io/WASH-PRO-CRM/en/mqtt/)

## Controller connection (post)

- Broker: `mqtt://<mqttLogin>:<mqttPassword>@<CRM-IP>:1883`
- Login/password — from the post card in CRM (`settings.mqttLogin` / `settings.mqttPassword`)
- Change credentials in the **Posts list** create/edit form. Saving the post name on the detail page does **not** clear the MQTT password *(v1.1.54)*
- Default login = `serialNumber`
- Native protocol: `{dt_pref}/{serial}/state/{suffix}`
- Default `dt_pref` = `washpro`
- `serial` = `posts.serialNumber` in CRM (exact match in topic)

## CRM (inside Docker)

- User: `system` (password — **Settings → MQTT (CRM)**; bootstrap — `MQTT_PASSWORD` in `.env`)
- Do not use `system` on post panels

## Post isolation

- Mosquitto ACL: post writes only to `washpro/{own-serial}/#`
- Serial spoofing in JSON does not affect other posts' statistics
- Sync: setup wizard → MQTT or post save

## Telemetry (post → CRM)

| Suffix | Content |
|--------|---------|
| `process` | balance, pause, mode, card |
| `totals` | finance before/after collection |
| `usages` | client/service counters |
| `credit` | credit from panel |
| `card` | NFC / collection |

## Control (CRM → post)

### From Dashboard

**Posts → ⚙** or post page → **Device Settings**:

- mode prices 0–9;
- commands (dropdown);
- MQTT prefix.

### MQTT topics

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

### mosquitto_pub (debug from CRM server)

```bash
mosquitto_pub -h localhost -p 1883 -u system -P 'PASS' -q 1 \
  -t 'washpro/SN123/set/prices' -m '{"0":50,"1":80}'
```

## MQTT log in Dashboard

- Above the table: **Load more (100 records)** — server-side pages via `usePolling`
- Subtitle: shown count, total, last refresh time
- Same pattern on **post state history** *(v1.1.51)* and **Notifications** page *(v1.1.52)*

See [Dashboard — server-side Load more](en-Dashboard).

## Migration from RabbitMQ

```bash
./scripts/migrate-to-mqtt.sh
```

## MQTT reset

```bash
./scripts/fix-mqtt.sh
```
