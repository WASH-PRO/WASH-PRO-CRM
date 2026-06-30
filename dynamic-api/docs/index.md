---
layout: default
---

<img class="banner" src="https://raw.githubusercontent.com/Dynamic-API-Platform/Dynamic-API-Platform/main/docs/banner.png" alt="Dynamic API Platform">

**Create, manage, and test REST APIs without writing backend code.**

Dynamic API Platform is an open-source full-stack application that lets you define REST endpoints through a web UI, attach JSON schemas, enforce access control, and serve data instantly — powered by MongoDB and a runtime API engine.

## About

The platform's defining capability is **zero-downtime API creation**: every endpoint you add or edit in the admin panel is registered in MongoDB and served on the next HTTP request. There is no need to restart Node.js, reload nginx, or redeploy containers when you ship a new route.

That sets it apart from tools like **Strapi**, **Directus**, and bespoke Express backends, where content models and routes are usually baked into code at build time or require a restart to pick up changes. Here, the route table is dynamic — save an endpoint in the UI and call it right away with `curl` or your frontend.

Ideal when you need APIs that evolve quickly: internal admin backends, MVPs, integration layers, or a lightweight alternative to a full headless CMS when you only need REST + schemas + access control.

## What's new

| Update | Summary |
|--------|---------|
| **v1.5.13 — MCP auth & UX** | MCP requires JWT/API key; database clear collection; API version in paths; login redesign — [Automation]({{ '/automation/' | relative_url }}) |
| **v1.5.12 — Live UI** | Header **Live** badge: auto-refresh on Dashboard/System, **статические данные** elsewhere — [Live UI]({{ '/live-ui/' | relative_url }}) |
| **v1.5.11 — Docker update fix** | In-app update uses host path `DAP_HOST_PROJECT_ROOT` for compose bind mounts (macOS / updater container) — [Updates]({{ '/updates/' | relative_url }}) |
| **v1.5.10 — Security** | `githubRepo` validation, HSTS, Referrer-Policy — [Updates]({{ '/updates/' | relative_url }}) |
| **v1.5.9 — UI themes** | **Ocean** & **Forest** themes + palette switcher — [UI Themes]({{ '/themes/' | relative_url }}) |
| **v1.5.8 — Update status** | Correct **Latest on GitHub** and **Up to date** in Settings — [Updates]({{ '/updates/' | relative_url }}) |
| **v1.5.7 — Endpoint data lifecycle** | Per-endpoint **data retention** (days, or forever); **editable path** after creation — [Dynamic Engine]({{ '/dynamic-api-engine/' | relative_url }}) |
| **v1.5.5 — Update reliability** | Stale job cleanup, **Cancel** in Settings, bash updater fix — [Updates]({{ '/updates/' | relative_url }}) |
| **v1.5 — Software updates** | In-app updates from GitHub Releases, **Update now**, auto-update in Docker, rollback — [Updates]({{ '/updates/' | relative_url }}) |
| **v1.4 — Deployment** | [Three variants]({{ '/deployment-variants/' | relative_url }}): Docker single, MongoDB replica set, Kubernetes |
| **v1.4 — Testing** | Vitest (38 tests), load test, CI — [Testing]({{ '/testing/' | relative_url }}) |
| **v1.4 — Observability** | Dashboard automation KPIs, charts, health widget; audit log `source` field |
| **v1.3 — Cron** | Scheduled jobs at `/cron` |
| **v1.3 — Webhooks** | Outbound events at `/webhooks` |
| **v1.3 — MCP** | JSON-RPC at `POST /api/mcp` + admin UI at `/mcp` |
| **v1.3 — API keys** | M2M auth via `X-API-Key` at `/api-keys` |
| **v1.2 — OpenAPI** | Swagger UI at `/api-docs` |
| **v1.2 — JS handlers** | Custom `handler(req, db)` per endpoint |
| **`reference` fields** | Foreign keys; `?populate=` on GET |
| **Network access** | Domains and IP/CIDR pools |
| **Database Explorer** | Raw MongoDB UI at `/database` |
| **API Schema** | ER diagram at `/api-schema` |
| **UI themes** | Light, dark, **Ocean**, **Forest** — [UI Themes]({{ '/themes/' | relative_url }}) |

Details: [Automation & Integrations]({{ '/automation/' | relative_url }}) · [Changelog on GitHub](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/blob/main/CHANGELOG.md)

<p class="quick-links">
  <a href="{{ '/getting-started/' | relative_url }}">Quick Start</a> ·
  <a href="{{ '/architecture/' | relative_url }}">Architecture</a> ·
  <a href="{{ '/automation/' | relative_url }}">Automation</a> ·
  <a href="{{ '/api-reference/' | relative_url }}">API Reference</a> ·
  <a href="https://github.com/Dynamic-API-Platform/Dynamic-API-Platform">GitHub</a>
</p>

## Features

| Category | Capabilities |
|----------|-------------|
| **Dynamic APIs** | CRUD endpoints defined in UI, **available instantly without server restart**, schema validation, path params, **editable path**, **optional data retention (TTL)**, **`reference` fields (foreign keys)**, `?populate=` on GET, **network access (domains / IP pools)**, **API versioning**, grouped organization |
| **Automation** | **Cron scheduler**, **outbound webhooks**, **JavaScript handlers**, **MCP server** for AI agents, **API keys** for M2M auth |
| **OpenAPI** | Auto-generated spec, Swagger UI, embedded **API Docs** in admin panel |
| **Security** | JWT auth with refresh, RBAC, **API keys**, **network access rules**, rate limiting, login lockout, audit logs, Helmet, CORS |
| **Admin Panel** | Dashboard, endpoint editor, **Handler tab**, **API Schema (ER diagram)**, **API Docs**, **Cron / Webhooks / API Keys / MCP Server**, linked-endpoint picker, **Network Access** tab, **Database Explorer (raw JSON)**, API tester, users & groups, **project export/import**, scrollable sidebar, **Live header badge** |
| **DevOps** | Docker Compose (**in-app software updates**), **MongoDB replica set**, **Kubernetes**, health checks, CI/tests |
| **Software updates** | GitHub release checks, notification banner, **Update now**, scheduled auto-update, rollback — [Updates]({{ '/updates/' | relative_url }}) |
| **Search** | Full-text search on all data list pages (client + server side) |
| **Testing** | Vitest unit tests, autocannon load tests, GitHub Actions CI |

## Why Dynamic API Platform?

Most API solutions require developers to write backend code, modify source files, redeploy applications, or restart services when API structures change.

Dynamic API Platform is designed to eliminate that workflow.

**Key advantages:**

- Create and modify REST API endpoints through a web interface.
- Apply changes **without server restart**.
- Built-in MongoDB integration.
- User, group, and permission management.
- API key authentication.
- Endpoint-level access control.
- IP-based security restrictions.
- Request statistics and monitoring.
- Error tracking and logging.
- Three deployment options: Docker (single), Docker + MongoDB replica set, Kubernetes.
- Extensible architecture with JavaScript handlers, webhooks, cron jobs, MCP tools, and custom logic.

The platform focuses on **rapid API deployment and management** without requiring continuous backend development.

## Comparison with Alternative Solutions

| Feature | Dynamic API Platform | Express.js | Directus | Strapi |
|---------|---------------------|------------|----------|--------|
| Dynamic endpoint creation | ✅ | ❌ | ⚠️ Limited | ⚠️ Limited |
| No server restart required | ✅ | ❌ | ⚠️ | ⚠️ |
| Built-in API management UI | ✅ | ❌ | ✅ | ✅ |
| User and group permissions | ✅ | Manual | ✅ | ✅ |
| API key management | ✅ | Manual | ⚠️ | ⚠️ |
| Request analytics | ✅ | Manual | ⚠️ | ⚠️ |
| IP restrictions | ✅ | Manual | ❌ | ❌ |
| Cron jobs | ✅ | Manual | ❌ | ❌ |
| Webhooks | ✅ | Plugin | ✅ | Plugin |
| MongoDB support | ✅ | Manual | Plugin | Plugin |
| Docker deployment | ✅ | Manual | ✅ | ✅ |
| In-app software updates | ✅ | ❌ | ❌ | ❌ |
| MongoDB replica set / K8s | ✅ | Manual | ⚠️ | ⚠️ |

Dynamic API Platform is intended for situations where APIs must be created, modified, and managed quickly — without developing and redeploying backend applications.

## Example Use Cases

### Vending Machines

Manage thousands of vending machines through a centralized API:

- Product inventory tracking
- Sales reporting
- Device status monitoring
- Remote configuration updates
- Service notifications

Example endpoints:

```
POST /machine/sale
POST /machine/status
GET  /machine/statistics
```

### Car Wash Systems

Create APIs for self-service car wash infrastructure:

- Payment processing
- Wash program activation
- Equipment monitoring
- Operator dashboards
- Usage statistics

Example endpoints:

```
POST /payment
POST /wash/start
GET  /statistics
```

### IoT Device Management

Centralized management for connected devices:

- Sensor data collection
- Device registration
- Firmware update control
- Event notifications
- Telemetry storage

Example endpoints:

```
POST /sensor/data
POST /device/register
GET  /device/status
```

### Internal Business Tools

Rapidly build APIs for:

- CRM systems
- ERP integrations
- Inventory management
- Customer portals
- Reporting systems

Without creating a dedicated backend project for each new requirement.

### Automation Platforms

Combine APIs, cron jobs, webhooks, and custom scripts to build workflow automation systems:

- Scheduled tasks
- Event-driven integrations
- Third-party service synchronization
- Data processing pipelines

All managed from a single platform. See [Automation & Integrations]({{ '/automation/' | relative_url }}).

## Quick Start

```bash
git clone https://github.com/Dynamic-API-Platform/Dynamic-API-Platform.git
cd Dynamic-API-Platform
docker compose up -d
```

| Service | URL |
|---------|-----|
| Admin UI | http://localhost:8080 |
| Backend API | http://localhost:3001 |
| MongoDB | localhost:27017 |

**Default login:** `admin` / `Admin123!` — change immediately in production.

## Documentation

| Document | Description |
|----------|-------------|
| [Why Dynamic API Platform]({{ '/overview/' | relative_url }}) | Key advantages, comparison, example use cases |
| [Getting Started]({{ '/getting-started/' | relative_url }}) | Installation, first endpoint, curl examples |
| [Architecture]({{ '/architecture/' | relative_url }}) | System design, layers, data flow |
| [API Reference]({{ '/api-reference/' | relative_url }}) | All management API endpoints |
| [RBAC]({{ '/rbac/' | relative_url }}) | Permissions, groups, access types |
| [Dynamic API Engine]({{ '/dynamic-api-engine/' | relative_url }}) | How runtime endpoints work |
| [API Schema]({{ '/api-schema/' | relative_url }}) | ER-style diagram of endpoints and references |
| [Database Explorer]({{ '/database/' | relative_url }}) | Raw MongoDB admin UI and API |
| [Network Access]({{ '/network-access/' | relative_url }}) | Domain and IP/CIDR restrictions for dynamic APIs |
| [Automation]({{ '/automation/' | relative_url }}) | Cron, webhooks, MCP, API keys, JS handlers, OpenAPI |
| [Deployment]({{ '/deployment/' | relative_url }}) | Docker, production, reverse proxy |
| [Deployment Variants]({{ '/deployment-variants/' | relative_url }}) | Docker single, Docker replica set, Kubernetes |
| [MongoDB Replica Set]({{ '/mongodb-replica-set/' | relative_url }}) | Variant 2 — 3-node MongoDB in Docker |
| [Kubernetes]({{ '/kubernetes/' | relative_url }}) | Variant 3 — K8s cluster deploy |
| [Configuration]({{ '/configuration/' | relative_url }}) | Environment variables & Settings UI |
| [Development]({{ '/development/' | relative_url }}) | Local dev setup, project conventions |
| [Testing]({{ '/testing/' | relative_url }}) | Unit tests, load tests, CI |
| [Screenshots]({{ '/screenshots/' | relative_url }}) | UI gallery |
| [UI Themes]({{ '/themes/' | relative_url }}) | Dark, Light, Ocean, Forest color schemes |
| [Live UI]({{ '/live-ui/' | relative_url }}) | Header Live badge — polling vs static data |
| [FAQ]({{ '/faq/' | relative_url }}) | Common questions |
| [Troubleshooting]({{ '/troubleshooting/' | relative_url }}) | Known issues and fixes |

## Preview

![Dashboard preview]({{ '/screenshots/dashboard.png' | relative_url }})

[Full screenshot gallery →]({{ '/screenshots/' | relative_url }})

## Tech Stack

- **Backend:** Node.js 20, Express, TypeScript, Mongoose, MongoDB 7
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Recharts
- **Infrastructure:** Docker, Docker Compose, MongoDB replica set, Kubernetes, Nginx

## License

[Apache License 2.0](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/blob/main/LICENSE)
