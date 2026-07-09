> **English** · **[Русский](../ru/Dashboard.md)**

# Dashboard

Full description: [docs/dashboard.md](https://wash-pro.github.io/WASH-PRO-CRM/en/dashboard/)

## Menu (v1.1.12)

| Group | Sections |
|-------|----------|
| **Main** | Overview, **Status** |
| **Sites** | Car Washes, Posts |
| **Data** | MQTT |
| **Cards** | Discount, Service, VIP, Collection |
| **Analytics** | Usage, Finance, Archive |
| **Reference** | Work Modes, Currencies, Discount Types *(Admin)* |
| **Automation** | **Information**, **Telegram**, **MCP Server**, Backups *(Admin)* |
| **System** | Notifications, Users, Groups, Settings, Logs |

Admin sections — **Administrator** only. Profile — in the header (`/profile`). Setup wizard — `/setup`.

## Post online/offline status

On **Posts**, **Status**, and **post detail** pages.

- **Online** — telemetry within the last 30 s (`lastMessageAt`)
- **Offline** — no data or stale

## Information section

News and promotions for the information Telegram bot. Status **"Scheduled"** with a past publish date is shown as **"Published"** (v1.1.12).

Bulk create test entries:

```bash
node scripts/seed-info-messages.mjs
# COUNT=50 START_DELAY_MIN=5 INTERVAL_MIN=10
```

## MCP server (`/mcp`)

- Dynamic API and PyOrchestrator (if enabled)
- HTTP URL and config for Cursor
- Table of registered tools

See [MCP](MCP).

## Post device settings

On the post page (`/posts/:id#device-settings`) or via **⚙** in the posts list:

- **Mode prices** — work-modes 0–9, MQTT `set/prices`
- **Commands** — reboots, credit, service modes → `set/command`
- **MQTT prefix** (`dt_pref`, usually `washpro`)
- **MQTT login/password** — in the post create/edit form

## Resources (sidebar)

- **Dynamic API** → `:8080` + status
- **PyOrchestrator** → `:8090` + status
- Documentation, GitHub

## Live updates

| Interval | Pages |
|----------|-------|
| 3 s | Status, Posts, post detail |
| 5 s | Overview |
| 10–15 s | Others |

## Recent changes (v1.1.12)

- **Automation** group: Information, Telegram, **MCP**, Backups
- **Status** under **Main**
- MCP: HTTP for Cursor without build
- Information: actual publish status
- Navigation stability (chunk retry, error boundary)

## Earlier

- v1.1.11: information bot, private chat isolation
- Table pagination: 20/40/60/80/100
- Setup wizard, post online/offline
- Web + Telegram notifications
