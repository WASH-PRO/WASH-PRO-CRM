---
layout: default
---

{% assign ui = site.data.ui[page.lang] %}

<div class="hero">
  <img class="banner" src="{{ '/assets/banner.png' | relative_url }}" alt="WASH PRO CRM / SCADA">
  {% include hero-badges.html %}
  <p class="hero-lead">
    {{ ui.hero_lead }}
    <a href="https://github.com/Dynamic-API-Platform/Dynamic-API-Platform">Dynamic API Platform</a>
    {{ ui.hero_optional }} <a href="https://github.com/PyOrchestrator/PyOrchestrator">PyOrchestrator</a>
  </p>
</div>

**{{ ui.hero_summary }}**

<p class="quick-links">
  {% assign nav_items = site.data.nav[page.lang] %}
  {% for item in nav_items offset:1 limit:8 %}
    <a href="{% include lhref.html slug=item.slug %}">{{ item.title }}</a>{% unless forloop.last %} · {% endunless %}
  {% endfor %}
</p>

## WASH PRO CRM Features

| Module | Description |
|--------|-------------|
| **Overview** | KPIs, usage and payment pie charts, live notifications |
| **Status** | All posts, online/offline, live timer, **interactive chart** *(Main)* |
| **Information** | News and promotions for the **information Telegram bot** *(Automation)* |
| **SCADA / MQTT** | Telemetry, commands, and post prices |
| **Setup wizard** | Initial configuration after installation (`/setup`) |
| **Sites** | Car washes, posts, **MQTT accounts**, **device settings** (prices, commands) |
| **Cards** | Discount / service / VIP; NFC application log |
| **Analytics** | Usage and finances before/after collection |
| **System** | Notifications (web + Telegram), users (Telegram ID), RBAC groups, settings, logs |
| **Automation** | **Information**, **Telegram bots** (management / service / **information v1.9**), **MCP server**, backups |
| **Resources** | Status and links to Dynamic API and PyOrchestrator panels |
| **Live data** | Auto-refresh every 3–15 s; tables with pagination 20–100 and "Load more" |

## Embedded Platforms

| Platform | Version | Panel | In WASH |
|----------|---------|-------|---------|
| [Dynamic API Platform](https://dynamic-api-platform.github.io/Dynamic-API-Platform/) | **v1.5.13** | `:8080` | Backend CRM, endpoints, RBAC, automation |
| [PyOrchestrator](https://pyorchestrator.github.io/PyOrchestrator/) | **v0.1.13** *(opt.)* | `:8090` | Telegram bots, Python scripts |

Details: [Embedded services](embedded-services.md).

## Stack

| Component | Technology |
|-----------|------------|
| API | Dynamic API Platform v1.5.13 (Node.js + MongoDB) |
| Dashboard | React 18 + TypeScript + Vite + Tailwind + Recharts |
| Queue | MQTT (Mosquitto) |
| Telemetry | message-processor (Node.js) |
| Python automation | PyOrchestrator v0.1.13 *(opt.)* |
| Infrastructure | Docker Compose |

## Quick Start

```bash
git clone https://github.com/WASH-PRO/WASH-PRO-CRM.git
cd WASH-PRO-CRM
cp .env.example .env
chmod +x scripts/*.sh
./scripts/start.sh
```

| Service | URL |
|---------|-----|
| Dashboard | http://localhost |
| Dynamic API Panel | http://localhost:8080 |
| Dynamic API health | http://localhost:3001/api/health |
| PyOrchestrator Panel *(if enabled)* | http://localhost:8090 |

**Dashboard login:** `admin` / `Admin123!`  
On first login, the **setup wizard** opens — see [Setup wizard](setup-wizard.md).

### PyOrchestrator (optional)

```bash
# In .env: PYORCHESTRATOR_ENABLED=true
./scripts/start.sh
```

### Demo data

```bash
./scripts/generate-demo-data.sh
./scripts/generate-demo-cards.sh
```

## Repository Structure

```
WASH-PRO-CRM/
├── dashboard/                 # React CRM
├── dynamic-api/               # Dynamic API Platform (vendored)
├── pyorchestrator/            # PyOrchestrator (vendored, opt.)
├── services/
│   ├── init-seed/             # CRM endpoints + RBAC
│   ├── message-processor/
│   ├── backup/
│   ├── pyorch-bridge/         # Telegram ↔ PyOrchestrator
│   ├── dynamic-api-panel/
│   └── pyorchestrator-panel/
├── scripts/                   # start, update, demo, backup
├── docs/                      # GitHub Pages
└── wiki/                      # GitHub Wiki
```

## License

WASH PRO CRM is a proprietary project.  
Dynamic API Platform — Apache 2.0 · PyOrchestrator — MIT.

## Changelog

See [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md) in the repository.
