**Language:** **English** · [Русский](README.ru.md)

<p align="center">
  <img src="docs/assets/banner.png" alt="WASH PRO CRM / SCADA" width="100%">
</p>

<p align="center">
  <a href="https://github.com/WASH-PRO/WASH-PRO-CRM/actions/workflows/pages.yml"><img src="https://github.com/WASH-PRO/WASH-PRO-CRM/actions/workflows/pages.yml/badge.svg" alt="GitHub Pages"></a>
  <a href="https://wash-pro.github.io/WASH-PRO-CRM/en/"><img src="https://img.shields.io/badge/Docs-GitHub_Pages-14b8a6?style=flat-square&logo=github&logoColor=white" alt="Documentation"></a>
  <img src="https://img.shields.io/badge/version-1.1.12-0d9488?style=flat-square" alt="Version">
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
  <a href="docs/en/getting-started.md">Quick start</a>
  ·
  <a href="docs/en/architecture.md">Architecture</a>
  ·
  <a href="https://github.com/WASH-PRO/WASH-PRO-CRM/issues">Issues</a>
</p>

---

## Features

- **Overview** — KPIs, usage and payment charts, live notifications
- **Status** — all posts, online/offline, interactive chart *(Main)*
- **SCADA** — MQTT telemetry, journal, post commands and prices
- **Setup wizard** — initial configuration after install
- **Sites & posts** — car washes, posts with serial number, **MQTT accounts**, device settings
- **Cards** — discount / service / VIP; NFC application log; discount types 1–5
- **Analytics** — usage and finances before/after collection
- **Automation** — news/promotions for Telegram, bots, **MCP server**, backups
- **System** — notifications (web + Telegram), users, RBAC groups, settings, logs
- **Resources** — links to Dynamic API (`:8080`) and PyOrchestrator (`:8090`) panels
- **Live mode** — auto-refresh every 3–15 s
- **Tables** — pagination 20/40/60/80/100, prev/next, load more
- **RBAC:** Administrator / Operator / Viewer / Service

## Embedded platforms

| Platform | Version | Role in WASH |
|----------|---------|--------------|
| [Dynamic API Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform) | **v1.5.13** | REST API, MongoDB, CRM endpoints, RBAC, automation |
| [PyOrchestrator](https://github.com/PyOrchestrator/PyOrchestrator) | **v0.1.13** *(opt.)* | Python scripts and Telegram bots via `pyorch-bridge` |

Details: [docs/en/embedded-services.md](docs/en/embedded-services.md)

## Architecture

```
Controllers ⇄ MQTT (Mosquitto) ⇄ Message Processor ⇄ Dynamic API ⇄ MongoDB
                                                      ↑
Dashboard (React) ──────────── nginx /api proxy ──────┘
                              post-device / backup / telegram-bots
                              pyorch-bridge → PyOrchestrator (opt.)
```

| Service | Purpose | Port |
|---------|---------|------|
| `dashboard` | CRM UI | 80 |
| `dynamic-api` | REST API | 3001 |
| `dynamic-api-panel` | Dynamic API panel | 8080 |
| `pyorchestrator-panel` *(opt.)* | PyOrchestrator Control Plane | 8090 |
| `pyorch-bridge` *(opt.)* | CRM Telegram bots | internal |
| `crm-mcp` *(opt.)* | MCP server for AI agents (Cursor) | stdio |
| `mosquitto`, `mosquitto-init` | MQTT broker, ACL/passwd | — |

More: [docs/en/architecture.md](docs/en/architecture.md)

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
| [Quick start](docs/en/getting-started.md) | Installation and first login |
| [Setup wizard](docs/en/setup-wizard.md) | Initial CRM setup |
| [Architecture](docs/en/architecture.md) | Services and data flow |
| [Dashboard](docs/en/dashboard.md) | UI modules, live mode, RBAC |
| [MCP](docs/en/mcp.md) | HTTP MCP for AI agents |
| [MQTT](docs/en/mqtt.md) | Telemetry and post control |
| [Changelog](CHANGELOG.md) | Release history |
| [Wiki (EN)](wiki/en/Home.md) | GitHub Wiki (English) |
| [Wiki (RU)](wiki/ru/Home.md) | GitHub Wiki (Russian) |

## Project structure

```
WASH-PRO-CRM/
├── dashboard/                # React CRM Dashboard
├── dynamic-api/              # Dynamic API Platform
├── pyorchestrator/           # PyOrchestrator (opt.)
├── services/                 # init-seed, message-processor, backup, …
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

More: [docs/en/troubleshooting.md](docs/en/troubleshooting.md)

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
