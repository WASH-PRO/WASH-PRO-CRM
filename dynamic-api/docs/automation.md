---
layout: default

title: Automation & Integrations
description: Cron, webhooks, MCP, API keys, JavaScript handlers, and OpenAPI
---

Dynamic API Platform v1.2+ includes tools that go beyond CRUD: scheduled jobs, outbound webhooks, OpenAPI docs, JavaScript handlers, MCP for AI agents, and API keys.

## Cron Scheduler

**UI:** `/cron` (requires `manage_api`)

Schedule recurring tasks with standard cron expressions (`*/5 * * * *`, `0 0 * * *`, etc.).

| Action type | Description |
|-------------|-------------|
| **javascript** | Run `async function run() { ... }` in a sandboxed VM |
| **http** | Send GET/POST/etc. to any URL |
| **endpoint** | Call an internal dynamic API path (e.g. cleanup job) |

**API:**

```
GET    /api/cron
POST   /api/cron
PUT    /api/cron/:id
DELETE /api/cron/:id
POST   /api/cron/:id/run    # run immediately
```

Jobs start automatically when the backend boots (`node-cron`).

## Outbound Webhooks

**UI:** `/webhooks`

POST platform events to external URLs. Optional **HMAC-SHA256** secret → header `X-Webhook-Signature`.

| Event | When fired |
|-------|------------|
| `user.created` / `user.updated` / `user.deleted` | User CRUD |
| `endpoint.created` / `endpoint.updated` / `endpoint.deleted` | Endpoint CRUD |
| `endpoint.called` | Successful dynamic API call |
| `api.error` | Dynamic API returned 4xx/5xx |

Payload:

```json
{
  "event": "endpoint.called",
  "timestamp": "2026-06-18T12:00:00.000Z",
  "data": { "path": "/api/products", "method": "GET", "statusCode": 200 }
}
```

## JavaScript Handlers

**UI:** Endpoint editor → **Handler** tab

When enabled, `async function handler(req, db)` **replaces** default schema CRUD:

```javascript
async function handler(req, db) {
  const item = await db.findOne({ sku: req.body.sku });
  return { status: 200, data: item };
}
```

- `req` — method, path, params, query, body, user, headers  
- `db` — `findOne`, `find`, `create`, `update`, `delete` (scoped to endpoint collection)  
- No server restart — code runs on next request

## OpenAPI / Swagger

| URL | Description |
|-----|-------------|
| `/api/openapi.json` | Auto-generated OpenAPI 3.0 spec |
| `/api/swagger` | Interactive Swagger UI |
| `/api-docs` | Embedded docs in admin panel |

Includes JWT and API key security schemes, versioned paths, and reference fields.

## MCP Server (AI agents)

**UI:** `/mcp` (requires `manage_api`) — endpoint URL, JSON-RPC examples, registered tools table

**Endpoint:** `POST /api/mcp` (JSON-RPC 2.0) — **requires authentication** (JWT Bearer or API key)

Compatible with MCP clients (Claude, ChatGPT tools, OpenWebUI):

```bash
curl -X POST http://localhost:3001/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# or with API key:
curl -X POST http://localhost:3001/api/mcp \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dap_xxxxxxxx" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

`tools/list` and `tools/call` respect each endpoint's `accessType` (public / authenticated / group). The admin UI at `/mcp` lists all registered tools; JSON-RPC returns only tools the token can use.

| Method | Purpose |
|--------|---------|
| `initialize` | Handshake |
| `tools/list` | List dynamic endpoints as tools |
| `tools/call` | Execute endpoint by tool name |
| `resources/list` / `resources/read` | OpenAPI spec resource |

## API Keys

**UI:** `/api-keys`

Machine-to-machine authentication without JWT login:

```bash
curl http://localhost:3001/api/products \
  -H "X-API-Key: dap_xxxxxxxx"
```

Or: `Authorization: ApiKey dap_xxxxxxxx`

Keys are shown **once** on creation; stored as bcrypt hash. Assign RBAC permissions per key.

## API Versioning

**UI:** Endpoint editor → General → **API Version**

Set `apiVersion` to `v1` on path `/api/users` — platform also serves **`/api/v1/users`**.

Create separate endpoints with `v1` / `v2` for breaking changes without affecting legacy clients.

## Project Export / Import

**UI:** Settings → Project Export / Import

Download `project.json` (endpoint groups, endpoints, optional data & settings). Merge or replace on import. Users and audit logs are never exported.
