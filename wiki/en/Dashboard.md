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
| **Automation** | **Publications**, **Telegram**, **MCP Server**, **Modules**, Backups *(Admin)* |
| **System** | **Information**, Notifications, Users, Groups, Settings, Logs |

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

## Publications section

News and promotions for the information Telegram bot (**Automation → Publications**, `/info-messages`). Status **"Scheduled"** with a past publish date is shown as **"Published"** (v1.1.12).

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
| 30 s | **Information** (`/system`, platform status) |
| 10–15 s | Others |

## Recent changes (v1.1.40)

- **Software updates / repair** — cross-OS compose env; integrity repair uses full compose stack

## Recent changes (v1.1.38)

- **Modules** — Installed and Available sections; per-section pagination; removed Installation filter

## Recent changes (v1.1.37)

- **i18n** — split into feature modules (`features/modules`, `updates`, `notifications-features`); help in `help/`

## Recent changes (v1.1.34)

- **Notifications** — software update progress and module install/start/stop/update events

## Recent changes (v1.1.33)

- **Modules** — Safari JWT decode fix; integrity repair rebuilds modules-bridge from Settings
- **PasswordInput** — show password for administrators

## Recent changes (v1.1.32)

- **Modules** — compact filter toolbar; refresh catalog button with label

## Recent changes (v1.1.30)

- **Modules** — `/modules` catalog: search, filters, pagination; clickable titles; icon-only actions
- **Module settings** — iframe auto-height, CRM theme sync, breadcrumbs on `/modules/:id`

## Recent changes (v1.1.29)

- **Build** — fixed TypeScript error on `docker compose build dashboard`

## Recent changes (v1.1.28)

- **Help** — sidebar footer item above Documentation, normal style; removed from header

## Recent changes (v1.1.27)

- **Help** — header button and sidebar item
- **JS cache** — nginx 404 for stale `/assets/`; clearer chunk load error message

## Recent changes (v1.1.26)

- **CRM version** — `APP_VERSION` in `.env` only after **successful** update; build uses target version via env without persisting; revert on failure

## Recent changes (v1.1.25)

- **Docker Hub** — clear timeout error; troubleshooting for Mac/localhost
- **Help and hints** — failed job and Settings section

## Recent changes (v1.1.24)

- **Failed job** — stale error hidden when version is already newer

## Recent changes (v1.1.23)

- **Auto-update** — `APP_VERSION` in `.env` only after successful job; revert on failure
- **CRM version** — from running dashboard `/version.json`
- **Failed job** — Retry and Hide error buttons

## Recent changes (v1.1.22)

- **Built-in help** — fullscreen modal from header (book icon), 26 sections, screen wireframes, EN/RU
- **Menu** — `/system` moved to **System** group and renamed **Information**; bot content section — **Publications**
- **Breadcrumbs** — menu group → section trail; fixed links
- **i18n** — Russian short label for Usage in collapsed sidebar

## Recent changes (v1.1.21)

- **Integrity** — false “/deploy not a git repo” fixed (`git safe.directory`)
- **Update card** — stale failed job hidden after successful update

## Recent changes (v1.1.20)

- **CRM auto-update** — `git reset --hard origin/main`; no longer blocked by accidental tracked-file edits
- **Error on card** — failed job with step log stays visible
- **Compose override** — build/seed via `scripts/compose-files.sh`

## Recent changes (v1.1.19)

- **Integrity check** — external `DATA_DIR` paths (`/mnt/hdd/data`, `/var/lib/wash-pro-crm`) no longer flagged; warning only when `DATA_DIR` points inside `/deploy`

## Recent changes (v1.1.18)

- **Software updates** — release checks via `git ls-remote` without `GITHUB_TOKEN`; page load no longer clears the banner
- **Check now** — only explicit GitHub poll; job progress polling uses cache
- **Examples** — `docker-compose.override.yml.example`, `local/apply-server-patches.sh.example` for server-specific overrides

## Recent changes (v1.1.17)

- **Settings → Integrity and repair** — diagnose `WASH_HOST_PROJECT_ROOT`, `DATA_DIR`, key files; apply fixes (Mosquitto, `init-seed`, stuck updates)
- **`update-bridge`** — `GET/POST /api/crm/updates/repair`

## Recent changes (v1.1.16)

- **Information** (`/system`) in **System** group — server resources, WASH PRO CRM version, Dynamic API / PyOrchestrator stack
- **CPU model** — readable in Docker containers (via `/proc/cpuinfo`)

## Recent changes (v1.1.15)

- **Overview** — **daily workload** line chart below revenue
- **Notifications** — delete all button
- **Telegram** — reliable stop, `stop-all`, demo bots on install; informational bot v2.2 (free only in `program_9`)

## Recent changes (v1.1.14)

- **Notifications i18n** — prepared phrases by event type; legacy records follow active language
- **Header** — language and Live/Static as single icons on all screen sizes

## Earlier (v1.1.13)

- **Automation** group: Information, Telegram, **MCP**, **Modules**, Backups
- **Status** under **Main**
- MCP: HTTP for Cursor without build
- Navigation stability (chunk retry, error boundary)

## Earlier

- v1.1.12: **Automation** group, MCP, navigation stability
- Table pagination: 20/40/60/80/100
- Setup wizard, post online/offline
- Web + Telegram notifications
