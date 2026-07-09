> **English** · **[Русский](ru-Dashboard)** · [← Wiki](Home)

# Dashboard

Full description: [docs/dashboard.md](https://wash-pro.github.io/WASH-PRO-CRM/en/dashboard/)

## Menu (v1.1.14)

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

## Interface language (v1.1.13+)

- **English** (default) and **Russian** — menu, statuses, messages, logs UI
- Switcher in the **header** (🇺🇸/🇷🇺 flags; single flag icon) and in **Settings**
- Choice is saved in the browser (`wash_locale`); user-entered data is not translated

## Notifications (v1.1.14)

The **Notifications** list and Overview widget show **localized message templates by event type** (`mqtt_credit`, `user_login`, `wash_created`, etc.), not the raw text stored when the record was created. Parameters (amount, login, entity name) are parsed from legacy messages. Severity labels and CSV export follow the active language.

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

See [MCP](en-MCP).

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

## Recent changes (v1.1.14)

- **Notifications i18n** — prepared phrases by event type; legacy records follow active language
- **Header** — language and Live/Static as single icons on all screen sizes

## Earlier (v1.1.13)

- **Automation** group: Information, Telegram, **MCP**, Backups
- **Status** under **Main**
- MCP: HTTP for Cursor without build
- Navigation stability (chunk retry, error boundary)

## Earlier

- v1.1.12: **Automation** group, MCP, navigation stability
- Table pagination: 20/40/60/80/100
- Setup wizard, post online/offline
- Web + Telegram notifications
