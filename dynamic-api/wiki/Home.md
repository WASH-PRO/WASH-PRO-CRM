Welcome to the **Dynamic API Platform** wiki (v1.5.13).

Create, manage, and test REST APIs without writing backend code.

## About

Endpoints are stored in MongoDB and served **at runtime** — add or change a route in the admin UI and it is callable immediately, with **no server restart or redeploy**. This is the main difference from Strapi, Directus, and typical custom backends where new APIs usually require code changes and a rebuild or restart.

## What's new in v1.5.x

| Area | Summary |
|------|---------|
| **MCP auth (v1.5.13)** | `POST /api/mcp` requires JWT or API key; tools respect endpoint access — [FAQ](FAQ) |
| **Database clear (v1.5.13)** | Clear `endpointdatas` / `logs` collections from UI — [Database Explorer](Database-Explorer) |
| **API version UI (v1.5.13)** | Versioned paths in endpoints list, schema, test tab |
| **Login redesign (v1.5.13)** | Split login page, favicon |
| **Live UI (v1.5.12)** | Header **Live** badge — auto-refresh on Dashboard/System, **статические данные** elsewhere — [Live UI](Live-UI) |
| **Docker update fix (v1.5.11)** | `DAP_HOST_PROJECT_ROOT` for in-app compose on macOS — [Software Updates](Software-Updates) |
| **Security (v1.5.10)** | `githubRepo` validation, HSTS, Referrer-Policy |
| **Software updates** | GitHub release checks, **Update now**, auto-update in Docker, stale-job cleanup, cancel — [Software Updates](Software-Updates) |
| **Endpoint data** | Optional **data retention** (TTL days or forever), **editable path** — [Dynamic API Engine](Dynamic-API-Engine) |
| **UI themes** | Dark, Light, **Ocean**, **Forest** — [Themes](Themes) |
| **System page** | Correct installed version, auto-update status |
| **v1.4 deployment** | Docker single-node, MongoDB replica set, Kubernetes — [Deployment Variants](Deployment-Variants) |
| **Testing** | Vitest (38 tests), load test, CI — [Testing](Testing) |
| **Observability** | Dashboard automation KPIs, charts, health widget |

Earlier releases: `reference` fields, network access, Database Explorer, cron/webhooks/API keys/MCP, OpenAPI, JS handlers — see [CHANGELOG](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/blob/main/CHANGELOG.md).

## Quick links

### Getting started
- [Installation](Installation)
- [Quick Start Guide](Quick-Start-Guide)
- [Deployment](Deployment)
- [Deployment Variants](Deployment-Variants)
- [Configuration](Configuration)
- [Software Updates](Software-Updates)

### Platform
- [Architecture](Architecture)
- [Dynamic API Engine](Dynamic-API-Engine)
- [API Reference](API-Reference)
- [RBAC & Permissions](RBAC-and-Permissions)
- [API Schema](API-Schema)
- [Network Access](Network-Access)
- [Database Explorer](Database-Explorer)
- [Live UI](Live-UI)
- [UI Themes](Themes)

### Operations
- [Testing](Testing)
- [Kubernetes](Kubernetes)
- [MongoDB Replica Set](MongoDB-Replica-Set)
- [Screenshots](Screenshots)
- [FAQ](FAQ)
- [Troubleshooting](Troubleshooting)
- [Contributing](Contributing)

## Online documentation

Full docs with search: **https://dynamic-api-platform.github.io/Dynamic-API-Platform/**

## Repository

https://github.com/Dynamic-API-Platform/Dynamic-API-Platform

## Default credentials (development)

| Field | Value |
|-------|-------|
| Login | `admin` |
| Password | `Admin123!` |

Change immediately after first login in production.
