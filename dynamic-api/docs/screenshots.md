---
layout: default
redirect_from:
  - /screenshots.html

title: Screenshots
description: UI screenshots from localhost deployment
---

Screenshots of **Dynamic API Platform v1.5.13** running at `http://localhost:8080` (captured June 2026).

> The admin header shows a **Live** badge (auto-refresh on Dashboard/System, **статические данные** on other pages). See [Live UI]({{ '/live-ui/' | relative_url }}).
>
> The admin panel supports **four themes** — Dark, Light, **Ocean**, and **Forest** — switch via the palette button in the header. See [UI Themes]({{ '/themes/' | relative_url }}).

## Login

![Login page]({{ '/screenshots/login.png' | relative_url }})

**URL:** `/login` · **Default:** `admin` / `Admin123!`

## Dashboard

![Dashboard]({{ '/screenshots/dashboard.png' | relative_url }})

**URL:** `/` — KPI cards (users, endpoints, requests, errors, cron, webhooks, API keys, MCP tools), automation health, request/error charts

## Endpoints

![Endpoints]({{ '/screenshots/endpoints.png' | relative_url }})

**URL:** `/endpoints` — grouped tables, search, filters

## API Schema (ER diagram)

![API Schema]({{ '/screenshots/api-schema.png' | relative_url }})

**URL:** `/api-schema` — read-only diagram of endpoints, groups, and FK arrows

## API Docs (Swagger)

![API Docs]({{ '/screenshots/api-docs.png' | relative_url }})

**URL:** `/api-docs` — embedded OpenAPI / Swagger UI

## Endpoint Handler (JavaScript)

![Endpoint Handler]({{ '/screenshots/endpoint-handler.png' | relative_url }})

**URL:** `/endpoints/:id` → **Handler** tab — custom `async function handler(req, db)`

## Cron Jobs

![Cron Jobs]({{ '/screenshots/cron-jobs.png' | relative_url }})

**URL:** `/cron` — scheduled JavaScript, HTTP, or endpoint actions

## Webhooks

![Webhooks]({{ '/screenshots/webhooks.png' | relative_url }})

**URL:** `/webhooks` — outbound event subscriptions

## API Keys

![API Keys]({{ '/screenshots/api-keys.png' | relative_url }})

**URL:** `/api-keys` — machine-to-machine authentication

## MCP Server

![MCP Server]({{ '/screenshots/mcp-server.png' | relative_url }})

**URL:** `/mcp` — MCP tools list, authentication examples, JSON-RPC curl samples, access rules

## Database Explorer

![Database Explorer]({{ '/screenshots/database.png' | relative_url }})

**URL:** `/database` — raw MongoDB JSON browser (requires `manage_users`)

## Audit Logs

![Audit Logs]({{ '/screenshots/logs.png' | relative_url }})

**URL:** `/logs` — request and admin action history with filters

## Settings

![Settings]({{ '/screenshots/settings.png' | relative_url }})

**URL:** `/settings` — auth, rate limits, logs, **project export/import**

## System

![System]({{ '/screenshots/system.png' | relative_url }})

**URL:** `/system` — CPU, memory, disk, network, cron scheduler status

### Regenerate screenshots

With the platform running locally:

```bash
node scripts/capture-screenshots.mjs http://localhost:8080
```

[← Back to home]({{ '/' | relative_url }})
