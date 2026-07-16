---
layout: default
title: Dashboard
description: CRM web interface modules
---

React application with **light**, **dark**, and **system** themes (follows OS settings without reload), fixed sidebar, **live data refresh**, and a two-column login page (layout like PyOrchestrator, custom background).

## Navigation

| Group | Sections |
|-------|----------|
| **Main** | Overview, **Status** (all posts, chart, online/offline) |
| **Sites** | Car washes, Posts |
| **Data** | MQTT |
| **Cards** | Discount, Service, VIP, Collection |
| **Analytics** | Usage, Finance, Archive |
| **Reference data** | Work modes, Currencies, Discount types *(Admin)* |
| **Automation** | **Publications**, **Telegram**, **MCP server**, **Modules**, Backups *(Admin)* |
| **System** | **Information** (server resources, CRM & stack versions), Notifications, **Users**, **Groups & permissions**, **Settings**, Logs *(Admin)* |

Sections marked admin are available only to **Administrator** (`manage_users` or `view_logs` in JWT).  
**Profile** — link in the header (`/profile`). **Setup wizard** — `/setup` (on first login or `?restart=1`).

## Built-in help (v1.1.22, placement v1.1.28)

| Element | Description |
|---------|-------------|
| **Sidebar** | **Help** item at the bottom — between Setup wizard and Resources, above the Documentation link (same style as other items) |
| **Window** | Fullscreen help: TOC by menu group, search, screen wireframes, examples |
| **Close** | Close button or **Esc** |
| **Languages** | EN / RU (same as CRM UI) |
| **Docs** | Link to GitHub Pages at the bottom of the help panel |

## Breadcrumbs (v1.1.22)

Above page content — **menu group → section** (same labels as the sidebar).

| Example URL | Trail |
|-------------|-------|
| `/usage` | Analytics → Usage |
| `/system` | System → Information |
| `/info-messages` | Automation → Publications |
| `/cards/discount` | Cards → Discount |
| `/posts/:id` | Sites → Posts → *serial number* |

The group is not a link; intermediate sections (e.g. Posts on post detail) are clickable.

### Resources (sidebar)

| Item | Description |
|------|-------------|
| **Dynamic API** | Panel `:8080`, online/offline status |
| **PyOrchestrator** | Panel `:8090`, status via bridge health |
| **Documentation / GitHub** | External links |

More about embedded platforms: [Embedded services](embedded-services.md).

## Interface language (v1.1.13+)

| Element | Description |
|---------|-------------|
| **Locales** | English (default), Russian |
| **Switcher** | Header (🇺🇸/🇷🇺 flags; single flag icon) and **Settings → Language** |
| **Scope** | Menu, statuses, messages, table labels, logs UI; user data is not translated |
| **Storage** | `localStorage` (`wash_locale`) |

### i18n file layout (v1.1.37+)

Core strings live in `dashboard/src/i18n/messages/{en,ru}.ts`. Feature-specific catalogs are split out:

| Module | Files |
|--------|--------|
| Help | `messages/help/{en,ru}.ts` |
| Modules page | `messages/features/modules.{en,ru}.ts` |
| Updates & repair | `messages/features/updates.{en,ru}.ts` |
| Module/update notifications | `messages/features/notifications-features.{en,ru}.ts` |

See [i18n README](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/dashboard/src/i18n/README.md) in the repository.

## Notifications (v1.1.14, pagination v1.1.52)

The **Notifications** page and Overview widget display **localized message templates by event type** (`mqtt_credit`, `user_login`, `wash_created`, etc.), not the raw text stored when the record was created. Parameters (amount, login, entity name) are parsed from legacy messages. Severity labels and CSV export follow the active UI language.

### Full notifications page (`/notifications`) — v1.1.52

Same **server-side pagination** pattern as the MQTT log:

| Element | Behavior |
|---------|----------|
| **Page size** | **100** rows per API request |
| **Load more** | Single button **above the table** — «Load more (100 rows)» |
| **Subtitle** | Shown count, total, last refresh time |
| **Polling** | Live refresh every **3 s** (`usePolling`) |

Overview widget remains a compact preview (**10** rows, separate from the full page).

### Software updates & modules (v1.1.34)

Additional event types (EN/RU templates in `notifications-features.{en,ru}.ts`):

- **Software updates** — job started, completed, failed (CRM, Dynamic API, PyOrchestrator)
- **Modules** — install, uninstall, start, stop, update, errors

Configure web and Telegram channels on **Overview** or **Notifications**.

## Live mode

Operational data refreshes automatically (`usePolling`). Header shows a live-mode indicator.

| Interval | Pages |
|----------|-------|
| 3 s | Current post status, **Posts**, **post card**, **MQTT**, **Notifications** |
| 5 s | Overview |
| 10 s | Cards, finances, usage |
| 15 s | Car washes, archive, backups, currencies, discount types, logs, users, groups, setup wizard |

On the **Current status** page, mode time ticks in real time (`LiveModeTimer`).

## Tables (DataTable)

All main CRM tables use the shared **DataTable** component with unified pagination.

### Features

- search across text fields;
- sort by clicking column headers;
- filters (dropdowns);
- **visible column selection** (table settings icon);
- **pagination** (see below);
- bulk actions (CSV export, delete — where available).

### Pagination (v1.1.5+)

In the **footer of each table**:

| Element | Description |
|---------|-------------|
| **Per page** | Dropdown: **20 / 40 / 60 / 80 / 100** rows (default **20**) |
| **Back / Next** | Navigate among already loaded rows |
| **Load more (N rows)** | Fetch the next batch from the filtered set (N = selected page size) |

Footer label: `N rows · page X of Y · loaded M` — when more rows exist in the current dataset.

Changing page size, search, or filters resets to page 1.

### Large logs (server-side Load more)

Pages with very large data volumes use **server-side pagination** (button above the table). **DataTable** footer pagination (20–100 rows) applies only to already loaded rows — no second «Load more» in the footer on these pages.

| Section | Server loading | Notes |
|---------|----------------|-------|
| **MQTT** (`/mqtt`) | **Load more (100 rows)** above table | Full count in subtitle |
| **Cards** | Same, batches of **100** from API | |
| **Notifications** (`/notifications`) | **Load more (100 rows)** above table *(v1.1.52)* | Web notifications only (`isWebNotification`) |
| **Post state history** (`/posts/:id`) | **Load more (100 rows)** above table *(v1.1.51)* | Telemetry `state/process`; API uses `count=false` for speed; `hasMore` from page size |

**Recent notifications** widget on Overview — compact preview (10 rows by default).

## Sections in detail

### Overview (`/`)

KPI cards before collection: cash / cashless / total revenue / discount total / active errors.

Finance and usage totals — **sum of the latest record per post** (not all historical rows).

Charts (Recharts): post status, **pie charts** for "Usage" (clients / service / VIP) and payment shares (cash / cashless / discounts), revenue by date, **workload by date** (v1.1.15). Recent notifications table.

### Car washes (`/washes`)

Site reference: name, description, address, creation date, cloud, **UUID** (`mapsExternalId`) for external maps. "Post count" column.

**UUID (`mapsExternalId`):** assigned automatically on create (and by `init-seed` for existing washes missing the field). The **Washes Nearby** module sends it to the Washes Nearby site as Owner API `external_id`, so the platform identifies the wash without CRM Mongo ids or the site’s numeric id.

### Posts (`/posts`)

Posts linked to a car wash: **online/offline status**, number, name, **serial number**, **MQTT login**, site. Cascade delete of related data.

Actions column — **⚙** icon (device settings) → post page. On create/edit — MQTT login and password for the post panel.

**Online** — if `lastMessageAt` is not older than 30 seconds (same as Overview).

### Post card (`/posts/:id`)

| Block | Description |
|-------|-------------|
| Header | **Online/offline status**, name, serial number |
| Post description | Name, site address, serial number, maintenance, features *(firmware/warranty fields are legacy JSON only — not shown in UI)*; saving does **not** wipe `mqttLogin`/`mqttPassword` *(v1.1.54)* |
| **Device settings** | Mode prices, MQTT commands, `dt_pref` prefix — see [MQTT](mqtt.md) |
| State history | Telemetry `state/process` with date filter; **Load more (100 rows)** above table; server-side pages via `usePolling` *(v1.1.51)* |

Anchor `#device-settings` scrolls to the device settings block.

### Current status (`/states`)

All posts across all sites. **Status** column (online/offline), status filter.

**Interactive chart** full width (Recharts): metric switching (mode time / balance / free pause), tooltip with details, brush for many posts, live mode time refresh.

Table: address, post number, balance, pause, discount, live mode timer, mode name, last message date.

### Information (`/system`) — v1.1.16, v1.1.22

Platform status page in the **System** group (**Information** menu item). Not to be confused with **Publications** under Automation.

| Block | Description |
|-------|-------------|
| Summary cards | OS, CPU cores, hostname, server uptime |
| Memory / Disk | Usage bars and totals |
| Components | WASH PRO CRM, Dynamic API, PyOrchestrator versions (`update-bridge`) |
| Application | CRM name, version, environment, Docker platform, API Node.js runtime |
| CPU details | Model (with Docker `/proc/cpuinfo` fallback), cores, load average |
| Network | Host interfaces table with search |

Live refresh every **30 s** (`GET /api/dashboard/system` via Dynamic API).

### Integrity and repair (`/settings`) — v1.1.21

Section in **Settings** (before Software updates). Administrators only (`manage_users` / `manage_api`).

| Action | Description |
|--------|-------------|
| **Check integrity** | Diagnose `/deploy` mount, `WASH_HOST_PROJECT_ROOT`, `DATA_DIR`, `.env`, critical files, Docker socket, `docker compose config`, stuck update jobs |
| **Apply fixes** | Selected repairs: sync host root to `.env`, normalize `DATA_DIR` (only when path wrongly points inside `/deploy`), `git safe.directory`, clear stuck job, Mosquitto repair (`fix-mqtt.sh`), `init-seed` |

**`DATA_DIR` *(v1.1.19+)*:** absolute host paths (`/mnt/hdd/data`, `/var/lib/wash-pro-crm`) are **valid**; warning only when `DATA_DIR` is inside `/deploy`.

**Git *(v1.1.21+)*:** `/deploy` is a project bind mount; check registers `git safe.directory` (dubious ownership). Without `.git` on the host, auto-update is unavailable.

API: `GET/POST /api/crm/updates/repair` (`update-bridge`).

### Software updates (`/settings#updates`) — v1.1.20

**Software updates** section in **Settings** and header banner. Administrators only.

| Element | Description |
|---------|-------------|
| **Component cards** | WASH PRO CRM, Dynamic API, PyOrchestrator — current and latest version |
| **Check now** | Force release check (GitHub API or `git ls-remote` without token) |
| **Update** | Start job via `update-bridge` (fetch + reset → build → seed → health) |
| **Hide notification** | Dismiss until next release |
| **Error on card** | Failed job stays visible with error text and step log *(v1.1.20)* |

**CRM pull step *(v1.1.20+)*:** `git fetch` + `git reset --hard origin/main` — resets tracked files only; preserves `.env`, `DATA_DIR`, `docker-compose.override.yml`, `local/`.

**Build *(v1.1.20+)*:** `scripts/compose-files.sh` — same `-f` flags as `scripts/start.sh` (override, Redis, PyOrchestrator).

**v1.1.18+ behavior:** page load and job progress polling **do not** call GitHub — cache only. `GITHUB_TOKEN` in `.env` is **optional** (release notes, API quota).

**v1.1.50+:** banner no longer spins on a stale `queued` job when the target version is already installed; `update-bridge` auto-closes such jobs and runs the next queued update.

**v1.1.51+:** before starting a new update, `update-bridge` reconciles a stale active job (same repair logic as integrity check).

State: `DATA_DIR/update-bridge/state.json`. API: `GET /api/crm/updates/status`, `POST /api/crm/updates/check`, `POST /api/crm/updates/apply/{component}`.

### Cards (`/cards`)

| Subsection | `cardType` |
|------------|------------|
| Discount | `regular` |
| Service | `service` |
| VIP | `unlimited` |

**Application log:** each NFC event (`state/card` from post) creates a new row. Active session updates from `state/process` data (balance, discount).

Discount type — number `1`–`5` from reference. Statuses: `success`, `rejected`. Collection (`cardType: collection` on device) — CRM notification, no row in the cards section.

### Analytics (`/usage`, `/finance`, `/archive`)

- **Usage** — before/after collection, categories regular/service/unlimited.
- **Finances** — cash, cashless, discount, revenue.
- **Archiving** — policies by data group (including **MQTT telemetry** retention), operation log with **Result** column, scanned count, clear zero-record display, **manual telemetry purge** *(v1.1.49)*.

### System and automation

| Section | Route | Description |
|---------|-------|-------------|
| **Information** | `/system` | Server resources, CRM version, Dynamic API / PyOrchestrator; **support diagnostics JSON download** *(v1.1.44)* *(System group)* |
| Notifications | `/notifications` | CRM notifications (web), mark as read; **Load more (100)** server pagination *(v1.1.52)*; channel settings on **Overview** |
| **Profile** | `/profile` | Name, email, password change *(link in header)* |
| **Setup wizard** | `/setup` | Initial CRM setup; restart `/setup?restart=1` *(Admin/Operator)* |
| **Users** | `/users` | Dynamic API accounts, **Telegram user_id**, group assignment *(Admin)* |
| **Groups & permissions** | `/groups` | RBAC groups and permission matrix *(Admin)* |
| **Settings** | `/settings` | MQTT, Telegram notify, **integrity repair**, CRM update, default currency, **interface language**, **branding** *(v1.1.44)*, **full backup bundle** *(v1.1.44)* |
| Logs | `/logs` | Dynamic API audit *(Admin)* |
| **Publications** | `/info-messages` | News for information bot (images in Telegram); optional **VK Publisher** — **text only** to VK *(v1.1.42)* *(Admin)* |
| Telegram | `/telegram` | PyOrchestrator bots: **Management** / **Service** / **Information**; QR link; bulk actions; templates v3.2 / **v2.2**; `stop-all` *(Admin, PyOrch)* |
| **MCP server** | `/mcp` | Dynamic API and PyOrchestrator HTTP MCP; tools table; Cursor config *(Admin)* |
| **Modules** | `/modules` | GitHub extension catalog; install/start/stop; settings UI iframe; `modules-bridge` *(Admin)* |
| Backups | `/backups` | MongoDB backup, manual run, download; optional **full bundle** (`*-extras.tar.gz`) *(v1.1.44)* *(Admin)* |
| Work modes | `/work-modes` | Mode reference 0–9 *(Admin)* |
| Currencies | `/currency` | Reference `/api/crm/currencies` *(Admin)* |
| Discount types | `/discount-types` | Numbers 1–5 and names *(Admin)* |

### Navigation stability (v1.1.12)

- retry loading JS chunks on network failure (`lazyPage`);
- `RouteErrorBoundary` instead of gray screen;
- polling timeout 60 s; on Overview — error message instead of endless Loading.

### Header toggles (v1.1.14)

- language switcher — single icon with the current locale flag (all screen sizes);
- Live/Static — single icon (radio / pause) on all screen sizes.

### Dialogs and feedback (v1.1.44)

- **Toast** — success/error/info messages (bottom-right), auto-dismiss
- **Confirm modal** — destructive actions (delete user/group, backup, updates, integrity fixes) use in-app dialog instead of browser `confirm`

### In-app help (v1.1.44)

Help sidebar includes **Setup wizard**, **Welcome**, and **Profile** sections. Link to full documentation on GitHub Pages (locale-aware).

### Login page (`/login`)

Two-column layout (like PyOrchestrator): branding with SVG background (waves/SCADA) on the left, form on the right. **Product name and tagline** come from Settings → Branding *(v1.1.44)*. Theme switcher in the top-right corner. Auto JWT refresh; on session expiry — redirect to `/login`.

## User roles

| Group | Dashboard permissions |
|-------|----------------------|
| **Administrator** | Full access + System sections (admin) |
| **Operator** | view, create, update — CRM without admin sections |
| **Viewer** | view — read-only |
| **Service** | Internal API account (not for UI) |

User management: **Dashboard → Users / Groups & permissions** or **Dynamic API Panel → Users / Groups**.

## Dashboard proxy (nginx)

| Path | Upstream |
|------|----------|
| `/api/` | `dynamic-api:3001` |
| `/api/telegram-bots/` | `pyorch-bridge:3021` |
| `/api/crm/modules/` | `modules-bridge:3024` |
| `/api/crm/backup-files/` | `backup:3020` |
| `/api/crm/post-device/` | `message-processor:3022` (post prices and commands) |
| `/api/mcp` | Dynamic API MCP (JWT) |
| `/api/pyorch-mcp/` | PyOrchestrator MCP `:8010` *(if PyOrch enabled)* |
| `/pyorch/` | `pyorch-backend:8000` *(if PyOrch enabled)* |

## Demo data

```bash
./scripts/generate-demo-data.sh
./scripts/generate-demo-cards.sh
```

## Build

```bash
cd dashboard && npm install && npm run dev    # :5173
npm run build                                  # dist/ → Docker
```

## Technologies

React 18 · TypeScript · Vite · Tailwind · Lucide · Recharts · `usePolling` / `LiveModeContext`
