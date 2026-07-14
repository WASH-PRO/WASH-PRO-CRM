**Language:** **English** · [Русский](README.ru.md)

<p align="center">
  <img src="docs/assets/banner.png" alt="WASH PRO CRM / SCADA" width="100%">
</p>

<p align="center">
  <a href="https://github.com/WASH-PRO/WASH-PRO-CRM/actions/workflows/pages.yml"><img src="https://github.com/WASH-PRO/WASH-PRO-CRM/actions/workflows/pages.yml/badge.svg" alt="GitHub Pages"></a>
  <a href="https://wash-pro.github.io/WASH-PRO-CRM/en/"><img src="https://img.shields.io/badge/Docs-GitHub_Pages-14b8a6?style=flat-square&logo=github&logoColor=white" alt="Documentation"></a>
  <img src="https://img.shields.io/badge/version-1.1.49-0d9488?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/MongoDB-7-47A248?style=flat-square&logo=mongodb&logoColor=white" alt="MongoDB">
  <img src="https://img.shields.io/badge/MQTT-Telemetry-3C5280?style=flat-square&logo=eclipsemosquitto&logoColor=white" alt="MQTT">
  <a href="https://github.com/Dynamic-API-Platform/Dynamic-API-Platform"><img src="https://img.shields.io/badge/Dynamic_API-v1.5.13-3b82f6?style=flat-square" alt="Dynamic API Platform v1.5.13"></a>
  <a href="https://github.com/PyOrchestrator/PyOrchestrator"><img src="https://img.shields.io/badge/PyOrchestrator-v0.1.13-22d3ee?style=flat-square" alt="PyOrchestrator v0.1.13"></a>
  <img src="https://img.shields.io/badge/License-Proprietary-red?style=flat-square" alt="License">
</p>

<p align="center">
  Local CRM/SCADA for self-service car washes powered by
  <a href="https://github.com/Dynamic-API-Platform/Dynamic-API-Platform">Dynamic API Platform</a>
</p>

<p align="center">
  <a href="https://wash-pro.github.io/WASH-PRO-CRM/en/"><strong>Documentation</strong></a>
  ·
  <a href="https://wash-pro.github.io/WASH-PRO-CRM/en/getting-started/">Quick start</a>
  ·
  <a href="https://wash-pro.github.io/WASH-PRO-CRM/en/architecture/">Architecture</a>
  ·
  <a href="https://github.com/WASH-PRO/WASH-PRO-CRM/issues">Issues</a>
</p>

<p align="center">
  <div style="font-family: -apple-system, BlinkMacSystemFont, &quot;Segoe UI&quot;, Roboto, &quot;Helvetica Neue&quot;, Arial, sans-serif; border: 1px solid rgb(224, 224, 224); border-radius: 12px; padding: 20px; max-width: 500px; background: rgb(255, 255, 255); box-shadow: rgba(0, 0, 0, 0.05) 0px 2px 8px; display: inline-block; text-align: left;">
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
      <img alt="WASH PRO CRM" src="https://ph-files.imgix.net/793ec01f-0bb7-45d5-bf27-6f416bb165b6.png?auto=compress,format&amp;codec=mozjpeg&amp;cs=strip&amp;fit=crop&amp;h=80&amp;w=80" style="width: 64px; height: 64px; border-radius: 8px; object-fit: cover; flex-shrink: 0;">
      <div style="flex: 1 1 0%; min-width: 0px;">
        <h3 style="margin: 0px; font-size: 18px; font-weight: 600; color: rgb(26, 26, 26); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">WASH PRO CRM</h3>
        <p style="margin: 4px 0px 0px; font-size: 14px; color: rgb(102, 102, 102); line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">Turn your carwash data into your competitive edge.</p>
      </div>
    </div>
    <a href="https://www.producthunt.com/products/wash-pro-crm?embed=true&amp;utm_source=embed&amp;utm_medium=post_embed" target="_blank" rel="noopener" style="display: inline-flex; align-items: center; gap: 4px; margin-top: 12px; padding: 8px 16px; background: rgb(255, 97, 84); color: rgb(255, 255, 255); text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">Check it out on Product Hunt →</a>
  </div>
</p>

---

## Features

- **Overview** — KPIs, usage and payment charts, **daily workload chart**, live notifications
- **Status** — all posts, online/offline, interactive chart *(Main)*
- **System** — server resources, WASH CRM version, embedded stack versions *(Main)* (v1.1.16)
- **Integrity repair** — Settings wizard for paths, `.env`, and failed updates; external `DATA_DIR` paths no longer flagged (v1.1.19)
- **Software updates** — reliable Dashboard auto-update (`git reset --hard`), failed job visible on card (v1.1.20)
- **Built-in help** — fullscreen in-app help; **Help** item at the bottom of the sidebar (v1.1.22, v1.1.29); **Setup / Welcome / Profile** sections *(v1.1.44)*
- **White-label branding** — product name, tagline, logo URL in Settings *(v1.1.44)*
- **Toast & confirm dialogs** — no browser `alert`/`confirm` on critical actions *(v1.1.44)*
- **Full backup bundle** — MongoDB + CRM settings + module `data/` *(v1.1.44)*
- **Support diagnostics** — JSON report download on System page *(v1.1.44)*
- **SCADA** — MQTT telemetry, journal, post commands and prices
- **Setup wizard** — initial configuration after install
- **Sites & posts** — car washes, posts with serial number, **MQTT accounts**, device settings
- **Cards** — discount / service / VIP; NFC application log; discount types 1–5
- **Analytics** — usage and finances before/after collection
- **Automation** — news/promotions for Telegram, bots, **MCP server**, **Modules** (GitHub extensions), backups
- **Update & module notifications** — CRM stack updates and module lifecycle in web + Telegram (v1.1.34)
- **Modules browser repair** — Safari JWT fix; rebuild modules-bridge from Settings without SSH (v1.1.33)
- **Modules page sections** — Installed and Available blocks with per-section pagination (v1.1.38)
- **System** — notifications (web + Telegram), users, RBAC groups, settings, logs
- **Resources** — links to Dynamic API (`:8080`) and PyOrchestrator (`:8090`) panels
- **Live mode** — auto-refresh every 3–15 s
- **Interface languages** — English and Russian; default English; switcher in header and Settings (v1.1.13+)
- **Localized notifications** — list messages by event type follow the active UI language, including legacy records (v1.1.14)
- **Telegram bot lifecycle** — reliable stop/restart, demo bots on install, occupancy v2.2 (`program_9` = free) (v1.1.15)
- **Tables** — pagination 20/40/60/80/100, prev/next, load more
- **RBAC:** Administrator / Operator / Viewer / Service

## Embedded platforms

| Platform | Version | Role in WASH |
|----------|---------|--------------|
| [Dynamic API Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform) | **v1.5.13** | REST API, MongoDB, CRM endpoints, RBAC, automation |
| [PyOrchestrator](https://github.com/PyOrchestrator/PyOrchestrator) | **v0.1.13** *(opt.)* | Python scripts and Telegram bots via `pyorch-bridge` |

Details: [docs/en/embedded-services.md](https://wash-pro.github.io/WASH-PRO-CRM/en/embedded-services/)

## Architecture

```
Controllers ⇄ MQTT (Mosquitto) ⇄ Message Processor ⇄ Dynamic API ⇄ MongoDB
                                                      ↑
Dashboard (React) ──────────── nginx /api proxy ──────┘
                              post-device / backup / telegram-bots
                              pyorch-bridge → PyOrchestrator (opt.)
                              modules-bridge → module catalog & lifecycle (v1.1.30)
```

| Service | Purpose | Port |
|---------|---------|------|
| `dashboard` | CRM UI | 80 |
| `dynamic-api` | REST API | 3001 |
| `dynamic-api-panel` | Dynamic API panel | 8080 |
| `pyorchestrator-panel` *(opt.)* | PyOrchestrator Control Plane | 8090 |
| `pyorch-bridge` *(opt.)* | CRM Telegram bots | internal |
| `crm-mcp` *(opt.)* | MCP server for AI agents (Cursor) | stdio |
| `modules-bridge` | Module catalog, install/lifecycle, UI proxy | `127.0.0.1:3024` |
| `mosquitto`, `mosquitto-init` | MQTT broker, ACL/passwd | — |

More: [docs/en/architecture.md](https://wash-pro.github.io/WASH-PRO-CRM/en/architecture/)

## Quick start

### Requirements

- Docker 24+, Docker Compose v2
- 4 GB RAM minimum

### Run

```bash
git clone https://github.com/WASH-PRO/WASH-PRO-CRM.git
cd WASH-PRO-CRM
cp .env.example .env
# Change JWT_SECRET, passwords!

chmod +x scripts/*.sh
./scripts/start.sh
```

| Interface | URL |
|-----------|-----|
| Dashboard | http://localhost |
| Dynamic API Panel | http://localhost:8080 |
| API health | http://localhost:3001/api/health |
| PyOrchestrator Panel *(opt.)* | http://localhost:8090 |

**Default credentials:** `admin` / `Admin123!`  
On first login, the **setup wizard** opens (`/setup`).

### Options

```bash
REDIS_ENABLED=true docker compose -f docker-compose.yml -f docker-compose.redis.yml up -d --build
PYORCHESTRATOR_ENABLED=true ./scripts/start.sh
```

## Documentation

| Language | URL |
|----------|-----|
| **English** | https://wash-pro.github.io/WASH-PRO-CRM/en/ |
| [Русский](https://wash-pro.github.io/WASH-PRO-CRM/ru/) | GitHub Pages |

| Section | Description |
|---------|-------------|
| [Quick start](https://wash-pro.github.io/WASH-PRO-CRM/en/getting-started/) | Installation and first login |
| [Setup wizard](https://wash-pro.github.io/WASH-PRO-CRM/en/setup-wizard/) | Initial CRM setup |
| [Architecture](https://wash-pro.github.io/WASH-PRO-CRM/en/architecture/) | Services and data flow |
| [Dashboard](https://wash-pro.github.io/WASH-PRO-CRM/en/dashboard/) | UI modules, live mode, RBAC |
| [Modules](https://wash-pro.github.io/WASH-PRO-CRM/en/modules/) | GitHub extension catalog, PyOrchestrator |
| [MCP](https://wash-pro.github.io/WASH-PRO-CRM/en/mcp/) | HTTP MCP for AI agents |
| [MQTT](https://wash-pro.github.io/WASH-PRO-CRM/en/mqtt/) | Telemetry and post control |
| [Changelog](CHANGELOG.md) | Release history |
| [Wiki (EN)](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/en-Home) | GitHub Wiki (English) |
| [Wiki (RU)](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/ru-Home) | GitHub Wiki (Russian) |

## Project structure

```
WASH-PRO-CRM/
├── dashboard/                # React CRM Dashboard
├── dynamic-api/              # Dynamic API Platform
├── pyorchestrator/           # PyOrchestrator (opt.)
├── services/                 # init-seed, message-processor, modules-bridge, …
├── modules/                  # registry.json, installed/, bundled icons
├── docs/en/                  # Documentation (English)
├── docs/ru/                  # Документация (Russian)
├── wiki/en/                  # Wiki (English)
└── wiki/ru/                  # Wiki (Russian)
```

### Demo data

```bash
./scripts/generate-demo-data.sh
./scripts/generate-demo-cards.sh
```

## Update & backup

```bash
./scripts/update-dynamic-api.sh
docker compose up -d --build dynamic-api dynamic-api-panel

./scripts/update-pyorchestrator.sh
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build pyorch-backend pyorchestrator-panel pyorch-bridge

docker compose up -d --build
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| init-seed `Exited (0)` | Normal — one-shot container |
| MQTT auth / ACL | `./scripts/fix-mqtt.sh`, then sync MQTT in setup wizard |
| Missing CRM endpoints | `./scripts/run-init-seed.sh` |

More: [docs/en/troubleshooting.md](https://wash-pro.github.io/WASH-PRO-CRM/en/troubleshooting/)

## Security

1. Change all secrets in `.env` before production
2. Expose only Dashboard, Dynamic API, and (optionally) PyOrchestrator
3. MongoDB and Mosquitto stay on the internal Docker network
4. RBAC via Dynamic API groups
5. MQTT: change `system` password in **Settings → MQTT (CRM)**; each post has its own login

## License

WASH PRO CRM is a proprietary project.  
[Dynamic API Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform) — Apache License 2.0.  
[PyOrchestrator](https://github.com/PyOrchestrator/PyOrchestrator) — Apache License 2.0.
