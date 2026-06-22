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
| **`reference` fields** | Foreign keys between endpoints; validate links on write; `?populate=` on GET |
| **Network access** | Restrict dynamic APIs by allowed domains and IP/CIDR pools (group + endpoint) |
| **Database Explorer** | Raw MongoDB browser/editor at `/database` (requires `manage_users`) |
| **Zero-downtime routes** | Save an endpoint in the UI — callable immediately, no restart |
| **Auth improvements** | Redirect to login when session expires; fixed JWT refresh permissions |
| **System endpoint tests** | Tester uses real management API for `/api/users`, `/api/groups`, `/api/profile` |
| **License** | Apache License 2.0 |

Details: [Changelog on GitHub](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/blob/main/CHANGELOG.md)

<p class="quick-links">
  <a href="{{ '/getting-started/' | relative_url }}">Quick Start</a> ·
  <a href="{{ '/architecture/' | relative_url }}">Architecture</a> ·
  <a href="{{ '/api-reference/' | relative_url }}">API Reference</a> ·
  <a href="https://github.com/Dynamic-API-Platform/Dynamic-API-Platform">GitHub</a>
</p>

## Features

| Category | Capabilities |
|----------|-------------|
| **Dynamic APIs** | CRUD endpoints defined in UI, **available instantly without server restart**, schema validation, path params, **`reference` fields (foreign keys)**, `?populate=` on GET, **network access (domains / IP pools)**, grouped organization |
| **Security** | JWT auth with refresh, RBAC, **network access rules**, rate limiting, login lockout, audit logs, Helmet, CORS |
| **Admin Panel** | Dashboard, endpoint editor with linked-endpoint picker, **Network Access** tab, **Database Explorer (raw JSON)**, API tester, auto-docs, users & groups |
| **DevOps** | Docker Compose one-command deploy, health checks, persistent volumes |
| **Search** | Full-text search on all data list pages (client + server side) |

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
| [Getting Started]({{ '/getting-started/' | relative_url }}) | Installation, first endpoint, curl examples |
| [Architecture]({{ '/architecture/' | relative_url }}) | System design, layers, data flow |
| [API Reference]({{ '/api-reference/' | relative_url }}) | All management API endpoints |
| [RBAC]({{ '/rbac/' | relative_url }}) | Permissions, groups, access types |
| [Dynamic API Engine]({{ '/dynamic-api-engine/' | relative_url }}) | How runtime endpoints work |
| [Database Explorer]({{ '/database/' | relative_url }}) | Raw MongoDB admin UI and API |
| [Network Access]({{ '/network-access/' | relative_url }}) | Domain and IP/CIDR restrictions for dynamic APIs |
| [Deployment]({{ '/deployment/' | relative_url }}) | Docker, production, reverse proxy |
| [Configuration]({{ '/configuration/' | relative_url }}) | Environment variables & Settings UI |
| [Development]({{ '/development/' | relative_url }}) | Local dev setup, project conventions |
| [Screenshots]({{ '/screenshots/' | relative_url }}) | UI gallery |
| [FAQ]({{ '/faq/' | relative_url }}) | Common questions |
| [Troubleshooting]({{ '/troubleshooting/' | relative_url }}) | Known issues and fixes |

## Preview

![Dashboard preview](https://raw.githubusercontent.com/Dynamic-API-Platform/Dynamic-API-Platform/main/docs/screenshots/dashboard.png)

[Full screenshot gallery →]({{ '/screenshots/' | relative_url }})

## Tech Stack

- **Backend:** Node.js 20, Express, TypeScript, Mongoose, MongoDB 7
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Recharts
- **Infrastructure:** Docker, Docker Compose, Nginx

## License

[Apache License 2.0](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/blob/main/LICENSE)
