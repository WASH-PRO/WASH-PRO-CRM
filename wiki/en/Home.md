> **English** · **[Русский](ru-Home)** · [← Wiki](Home)

# WASH PRO CRM / SCADA

Local CRM/SCADA for car washes built on [Dynamic API Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform) **v1.5.13** and optionally [PyOrchestrator](https://github.com/PyOrchestrator/PyOrchestrator) **v0.1.13**.

**WASH PRO version:** **v1.1.23** · **Documentation:** https://wash-pro.github.io/WASH-PRO-CRM/en/  
Languages: [EN](https://wash-pro.github.io/WASH-PRO-CRM/en/) · [RU](https://wash-pro.github.io/WASH-PRO-CRM/ru/)

## Features

- **Setup wizard** — initial configuration after installation (`/setup`)
- **Status** — all posts, online/offline, interactive chart *(Main)*
- **Integrity repair** — Settings wizard for paths, `.env`, failed updates; external `DATA_DIR` paths no longer flagged (v1.1.19)
- **Software updates** — reliable Dashboard auto-update, failed job visible on card (v1.1.20)
- **Information** — server resources, WASH CRM version, embedded stack *(System → Information)* (v1.1.22)
- **Publications** — news and promotions for the **information Telegram bot** *(Automation)* (v1.1.22)
- **Built-in help** — fullscreen in-app help from the header (v1.1.22)
- SCADA: MQTT, telemetry, commands, and post prices
- Car washes, posts, **MQTT accounts**, device settings
- Cards (regular/service/VIP), NFC application log
- Analytics before/after collection, archive, MongoDB backups
- Web + Telegram notifications, configurable event types
- Users and RBAC groups, **Telegram user_id**, profile
- **Telegram bots:** Management / Service / **Information (v2.2)**; QR link; **private chats only**; demo bots on install (v1.1.15)
- **Workload chart** on Overview — daily line chart below revenue (v1.1.15)
- **Dashboard localization** — English / Russian; default English; switcher in header and Settings (v1.1.13+)
- **Localized notifications** — list messages by event type follow UI language, including legacy DB records (v1.1.14)
- **MCP server** in Dashboard — Dynamic API + PyOrchestrator for AI agents (v1.1.12)
- Stdio MCP `services/crm-mcp` for Cursor (v1.1.9+)
- MQTT (Mosquitto): post isolation by serial
- Live updates 3–15 s; global Live/Static toggle (v1.1.8)

## Quick start

```bash
git clone https://github.com/WASH-PRO/WASH-PRO-CRM.git
cd WASH-PRO-CRM
cp .env.example .env
chmod +x scripts/*.sh
./scripts/start.sh
```

| Interface | URL |
|-----------|-----|
| Dashboard | http://localhost |
| Dynamic API Panel | http://localhost:8080 |
| PyOrchestrator Panel *(optional)* | http://localhost:8090 |

Dashboard login: `admin` / `Admin123!` → setup wizard on first login.

PyOrchestrator: `PYORCHESTRATOR_ENABLED=true` in `.env`

## Wiki

- [Getting Started](en-Getting-Started)
- [Setup Wizard](en-Setup-Wizard)
- [Dashboard](en-Dashboard)
- [Architecture](en-Architecture)
- [MQTT and post control](en-MQTT)
- [Telegram bots](en-Telegram)
- [MCP for AI agents](en-MCP)
- [Embedded services](en-Embedded-Services)
- [Database schema](en-Database-Schema)

## Changelog v1.1.23

- **Auto-update** — `APP_VERSION` only after success; revert on failure; version from dashboard `version.json`
- **UI** — Retry and Hide error on failed job card

Full list: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.22

- **Help** — fullscreen modal from header, 26 sections, screen wireframes, EN/RU
- **Menu** — `/system` → **System → Information**; bot content → **Publications**
- **Breadcrumbs** — menu group → section; fixed paths

Full list: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.21

- **Git /deploy** — `safe.directory` on startup and in integrity check (dubious ownership)
- **Updates UI** — no stale failed job after successful update

Full list: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.20

- **Auto-update** — `git reset --hard origin/main` instead of `git pull`; preserves `.env`, override, `local/`
- **UI** — failed job stays on component card with step log
- **`scripts/compose-files.sh`** — updater build/seed with override and PyOrchestrator

Full list: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.19

- **Integrity check** — external `DATA_DIR` paths (`/mnt/hdd/data`, `/var/lib/wash-pro-crm`) no longer flagged as suspicious
- **i18n** — clearer warning when `DATA_DIR` actually points inside `/deploy`

Full list: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.18

- **Update system** — `git ls-remote` without GitHub token; cache on page load; **Check now** for API
- **Examples** — `docker-compose.override.yml.example`, `local/apply-server-patches.sh.example`

Full list: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.17

- **Integrity & repair wizard** in Settings — path/`.env` diagnostics and one-click fixes via `update-bridge`
- **`scripts/start.sh`** — optional `docker-compose.override.yml`

Full list: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.16

- **System page** (`/system`) in Main — server metrics, WASH PRO CRM info, component versions
- **CPU model** — improved detection in Docker via `/proc/cpuinfo`

Full list: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.15

- **Workload chart** on Overview (daily, below revenue)
- **Telegram** — reliable bot stop, `stop-all`, demo bots on install; occupancy v2.2 (`program_9` = free)
- **Notifications** — delete all button

Full list: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.14

- **Notifications i18n** — prepared phrases by event type; legacy Russian records display in the active language
- **Header toggles** — language and Live/Static as single icons on all screen sizes
- **Wiki links** — fixed bilingual navigation; Product Hunt embed in README

Full list: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.13

- **Dashboard i18n (EN/RU)** — full UI translation; English default; 🇺🇸/🇷🇺 flags in header
- **Docs and wiki** — `en/` and `ru/` catalogs; README EN + README.ru.md
- **Mobile header** — compact language and Live/Static icon toggles
- **Information** — green "Published" badge when scheduled time has passed

Full list: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.12

- **MCP server** section in Dashboard (Dynamic API + PyOrchestrator)
- Menu: **Automation** group; **Status** under **Main**
- **Information**: "Scheduled" → "Published" after the publish time passes
- Information bot v1.9; fixed gray screen during navigation

Full list: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Repository

https://github.com/WASH-PRO/WASH-PRO-CRM
