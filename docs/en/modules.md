---
layout: default
title: Modules
description: WASH PRO CRM extension catalog — install modules, configure PyOrchestrator packages, and manage settings in the Dashboard UI.
---

Modules are CRM extensions from **separate GitHub repositories**. Manage them in **Dashboard → Automation → Modules** (Administrator role).

## Architecture

```
Dashboard  →  /api/crm/modules/*  →  modules-bridge  →  git clone / lifecycle
                                              ↓
                                    PyOrchestrator (daemon script)
                                              ↓
                              Dynamic API  http://dynamic-api:3001
```

| Component | Purpose |
|-----------|---------|
| `modules/registry.json` | Available modules catalog in the CRM repo |
| `modules-bridge` | Install, start/stop/update/uninstall, serve module UI |
| `modules/installed/` | Installed module files + per-module `data/` |
| PyOrchestrator | Separate process (daemon) for module `src/main.py` |

## Catalog

[`modules/registry.json`](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/modules/registry.json) lists repository URLs. It can be refreshed from GitHub **without a CRM release** — use **Refresh catalog** on the modules page.

Each module repo must include **`wash-module.json`**:

| Field | Description |
|-------|-------------|
| `id` | Unique identifier |
| `name`, `description` | Localized `{ ru, en }` |
| `version`, `author`, `license`, `category` | Metadata |
| `dependencies` | Other module IDs (installed first) |
| `entrypoint` | Python script path, e.g. `src/main.py` |
| `settingsSchema` | Settings fields → PyOrchestrator secrets |
| `icon` | SVG/PNG in the repo |

## Lifecycle

1. **Install** — `git clone` to `modules/installed/{id}/`, register PyOrch script
2. **Start / Stop** — orchestrator run/stop
3. **Settings** — iframe with module `ui/index.html`
4. **Update** — re-clone (preserves `data/settings.json`)
5. **Uninstall** — stop + delete script + remove folder

Running modules requires PyOrchestrator: `PYORCHESTRATOR_ENABLED=true ./scripts/start.sh`

## Sample modules

| Module | API | Repository |
|--------|-----|------------|
| Post Occupancy Monitor | `GET /api/crm/post-states` | [wash-module-post-occupancy](https://github.com/WASH-PRO/wash-module-post-occupancy) |
| Usage Stats Collector | `GET /api/crm/usage-stats` | [wash-module-usage-stats](https://github.com/WASH-PRO/wash-module-usage-stats) |
| Starter (template) | heartbeat | [wash-module-starter](https://github.com/WASH-PRO/wash-module-starter) |
| VK Publisher | CRM Publications → **text** on VK wall (no images) | [wash-module-vk-publisher](https://github.com/WASH-PRO/wash-module-vk-publisher) |
| Washes Nearby | CRM washes → Washes Nearby site (prices, posts, news); linked via `mapsExternalId` (UUID) | [wash-module-washesnearby](https://github.com/WASH-PRO/wash-module-washesnearby) |

## Washes Nearby and wash UUID

Each CRM wash has **`mapsExternalId`** (UUID v4):

1. CRM assigns the UUID on wash create (Dashboard) or during `init-seed` (backfill for older rows).
2. The **Washes Nearby** module reads `mapsExternalId` and sends it to the site as Owner API **`external_id`**.
3. Later patch/telemetry calls use `ext:{uuid}` — CRM does not depend on the site’s numeric wash id.

Module settings: shared fields (token, site URL, interval, news/promo limit) plus a **dynamic list of CRM washes** — each with its own coordinates, city and type. Address comes from the CRM wash card.

After upgrading CRM: wait for `init-seed` (or **Integrity → init-seed**), then **Modules → Washes Nearby → Update → Start**.

## VK Publisher *(v1.1.42, module v1.2.0)*

The **VK Publisher** module syncs **Publications** with a VK community feed:

| Content | CRM / Telegram | VK |
|---------|----------------|-----|
| Title and body | ✅ | ✅ (HTML stripped) |
| `imageUrl`, HTML markup | ✅ | ❌ not sent |
| Access token | — | **Community** key (`wall`, `groups`) — **photos not required** |

After upgrading CRM: **Automation → Modules → VK Publisher → Update → Restart**.

Demo publications: `node scripts/reset-info-messages-vk-demo.mjs`

## Modules page *(v1.1.30)*

- Search by name/description, filters: installed / running / category
- Pagination and **Load more**
- Card title and icon link to module settings; action buttons are icon-only with tooltips
- **Refresh catalog** reloads `registry.json` from GitHub without a CRM release

### Installed / Available sections *(v1.1.38)*

The catalog is split into two blocks: **Installed** (running modules with lifecycle actions) and **Available** (not yet installed). Each section has its own pagination. Status and category filters apply to both blocks.

## Safari & browser repair *(v1.1.33)*

If **Automation → Modules** fails in Safari with *"The string did not match the expected pattern"*, update to **v1.1.33+** or use **Settings → Integrity repair** to rebuild `modules-bridge` and the dashboard without SSH.

## Module notifications *(v1.1.34)*

Install, uninstall, start, stop, update, and error events appear in **System → Notifications** (web + Telegram when configured). See [Dashboard](dashboard.md).

## Creating a module

```bash
git clone https://github.com/WASH-PRO/wash-module-starter my-module
cd my-module
# edit wash-module.json and src/main.py
```

Layout:

```
my-module/
├── wash-module.json
├── src/main.py
├── ui/index.html
├── ui/wash-module-sdk.js
├── assets/icon.svg
├── README.md          # English (default)
├── README.ru.md       # Russian
├── ui/help.html       # Help (English)
└── ui/help.ru.html    # Help (Russian)
```

Runtime secrets: `API_BASE_URL`, `MODULE_DATA_DIR`, settings from schema (e.g. `POLL_INTERVAL`).

UI uses `WashModule.api()` — token from `localStorage` (`wash_crm_token`).

## modules-bridge API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/crm/modules/health` | Health (+ PyOrch availability) |
| GET | `/api/crm/modules/catalog` | Catalog |
| POST | `/api/crm/modules/install/:id` | Install |
| POST | `/api/crm/modules/installed/:id/start` | Start |
| POST | `/api/crm/modules/installed/:id/stop` | Stop |
| POST | `/api/crm/modules/installed/:id/update` | Update |
| DELETE | `/api/crm/modules/installed/:id` | Uninstall |
| GET | `/api/crm/modules/icon/:id` | Module icon (SVG/PNG) |
| GET | `/api/crm/modules/installed/:id/logs` | PyOrchestrator run logs |
| GET | `/api/crm/modules/ui/:id/` | Module UI |

Mutating endpoints require administrator JWT (`manage_users` / `manage_api`).

## Publishing to the catalog

1. Create a public repo with `wash-module.json`
2. Add an entry to CRM `modules/registry.json`
3. Push to `main` — catalog picks it up after refresh

See also [Embedded services](embedded-services.md), [Telegram bots](telegram.md), [Troubleshooting](troubleshooting.md).
