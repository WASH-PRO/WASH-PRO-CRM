> **English** · **[Русский](ru-Database-Schema)** · [← Wiki](Home)

# Database Schema

Full description: [docs/database-schema.md](https://wash-pro.github.io/WASH-PRO-CRM/en/database-schema/)

## Endpoint groups

| Group | Path |
|-------|------|
| Car Washes | `/api/crm/washes` |
| Posts | `/api/crm/posts` |
| SCADA | `/api/crm/post-states` |
| Cards | `/api/crm/cards` |
| Statistics | `/api/crm/usage-stats`, `/api/crm/finance-stats` |
| Currencies | `/api/crm/currencies` |
| Discount Types | `/api/crm/discount-types` |
| Settings | `/api/crm/settings` |
| Notifications | `/api/crm/notifications` |
| Backups | `/api/crm/backups`, `/api/crm/archive-logs` |
| Telemetry | `/api/crm/telemetry` |

## Discount types

Reference `/api/crm/discount-types`: numbers **1–5** and names. In cards, field `discountType` is the number; Dashboard shows the name.

## `posts.settings`

JSON with post metadata: `mqttLogin`, `mqttPassword`, `modePrices`, `mqttPrefix`, `lastCommand`, `firmwareVersion`, `maintenance`, and more. See [docs/database-schema.md](https://wash-pro.github.io/WASH-PRO-CRM/en/database-schema/).

## Deleting posts and car washes

`DELETE /api/crm/posts/:id` — cascades deletion of states, cards, statistics, finance, notifications, and post MQTT telemetry.

`DELETE /api/crm/washes/:id` — deletes the car wash, all its posts, and their data.
