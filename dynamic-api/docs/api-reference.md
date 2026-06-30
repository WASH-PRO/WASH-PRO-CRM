---
layout: default
redirect_from:
  - /api-reference.html

title: API Reference
---

Base URL: `http://localhost:3001` (or your deployment domain)

All management endpoints return JSON:

```json
{ "success": true, "data": { ... } }
```

Errors:

```json
{ "success": false, "error": "Error message" }
```

## Authentication

Most endpoints require:

```
Authorization: Bearer <accessToken>
```

### POST `/api/auth/login`

Public. Authenticate and receive tokens.

**Body:**
```json
{ "login": "admin", "password": "Admin123!" }
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": { "_id": "...", "login": "admin", "name": "Admin", ... }
  }
}
```

### POST `/api/auth/refresh`

**Body:** `{ "refreshToken": "..." }`

### POST `/api/auth/logout`

Requires authentication.

### POST `/api/auth/register`

Public if registration enabled in Settings.

**Body:** `{ "login", "email", "password", "name" }`

---

## Health & CSRF

### GET `/api/health`

```json
{ "success": true, "status": "ok", "timestamp": "..." }
```

### GET `/api/csrf-token`

Returns CSRF token (cookie-based).

---

## Users

Permission: `manage_users` or `view`

### GET `/api/users`

| Query | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default 1) |
| `limit` | number | Items per page (default 20) |
| `search` | string | Search name, login, email, status |

### GET `/api/users/:id`

### POST `/api/users`

Permission: `manage_users`

**Body:** `{ login, email, password, name, status?, groupIds? }`

### PUT `/api/users/:id`

**Body:** `{ login?, email?, password?, name?, status?, groupIds? }`

### DELETE `/api/users/:id`

---

## Groups (RBAC)

### GET `/api/groups`

Permission: `view`

### POST `/api/groups`

Permission: `manage_users`

**Body:** `{ name, description?, permissions: string[] }`

### PUT `/api/groups/:id`

### DELETE `/api/groups/:id`

Cannot delete system groups.

---

## Profile

### GET `/api/profile`

Current authenticated user.

### PUT `/api/profile`

Update own profile (no group/status changes).

---

## Endpoints

Permission: `manage_api` or `view`

### GET `/api/endpoints`

| Query | Default |
|-------|---------|
| `page` | 1 |
| `limit` | 50 |

### GET `/api/endpoints/:id`

### POST `/api/endpoints`

**Body:**
```json
{
  "name": "Products",
  "description": "Product list",
  "slug": "products",
  "path": "/api/products",
  "method": "GET",
  "accessType": "authenticated",
  "groupId": "optional-group-id",
  "schema": [
    { "name": "title", "type": "string", "required": true, "order": 0 },
    { "name": "categoryId", "type": "reference", "refEndpointId": "<target-endpoint-id>", "order": 1 }
  ],
  "networkAccess": {
    "enabled": true,
    "allowedDomains": ["app.example.com", "*.example.com"],
    "allowedIpRanges": ["10.0.0.0/8", "203.0.113.50"]
  },
  "inheritGroupNetworkAccess": true,
  "enabled": true
}
```

| Field | Description |
|-------|-------------|
| `networkAccess.enabled` | Enable domain/IP filtering for this endpoint |
| `networkAccess.allowedDomains` | Allowed hostnames (`Origin` / `Referer` / `Host`) |
| `networkAccess.allowedIpRanges` | IPv4 addresses or CIDR blocks |
| `inheritGroupNetworkAccess` | Merge with parent group rules when `true` (default) |

See [Network Access]({{ '/network-access/' | relative_url }}).

### PUT `/api/endpoints/:id`

Same fields as POST (all optional).

### DELETE `/api/endpoints/:id`

Cannot delete system endpoints.

### GET `/api/endpoints/:id/examples`

Auto-generated request/response examples.

### GET `/api/endpoints/:id/docs`

Auto-generated documentation object.

### POST `/api/endpoints/:id/test`

Execute endpoint internally for testing.

**Body:**
```json
{
  "body": { "name": "Test" },
  "headers": { "Origin": "https://app.example.com" },
  "clientIp": "203.0.113.10",
  "applyNetworkAccess": true
}
```

| Field | Description |
|-------|-------------|
| `body` | Request body for POST/PUT/PATCH |
| `headers` | Optional headers (e.g. simulate `Origin`) |
| `clientIp` | Simulated client IP for network rule checks |
| `applyNetworkAccess` | When `true`, enforce network access rules during test |

By default, network rules are **skipped** in the tester so admins can debug freely.

---

## Endpoint Groups

### GET `/api/endpoints/groups`

### POST `/api/endpoints/groups`

**Body:**
```json
{
  "name": "Internal",
  "description": "Internal APIs",
  "icon": "folder",
  "color": "#0891b2",
  "order": 0,
  "networkAccess": {
    "enabled": true,
    "allowedDomains": ["app.example.com"],
    "allowedIpRanges": ["10.0.0.0/8"]
  }
}
```

Group-level `networkAccess` applies to all endpoints in the group that inherit rules (default).

### PUT `/api/endpoints/groups/:id`

### DELETE `/api/endpoints/groups/:id`

---

## Dashboard

### GET `/api/dashboard/stats`

Permission: `view`

Returns users, endpoints, requests/errors (last 7 days), automation counts (cron, webhooks, API keys, MCP tools), 7-day charts (requests, errors, logins, webhook deliveries, cron runs, traffic by source), and `automationHealth` (failed cron jobs, webhook errors, unused API keys).

### GET `/api/dashboard/system`

Permission: `view`

Server OS, CPU, memory, disk, network info, plus `cronJobsActive` and `cronJobsTotal`.

### GET `/api/dashboard/logs`

Permission: `view_logs`

| Query | Description |
|-------|-------------|
| `page`, `limit` | Pagination |
| `action` | Filter: `login`, `error`, `api_call`, `webhook_dispatch`, `cron_run`, `mcp_call`, `api_key_used`, etc. |
| `search` | Search message, action, source, IP |

---

## Settings

Permission: `manage_users` or `manage_api`

### GET `/api/settings`

Returns settings object + `logsCount`.

### PUT `/api/settings`

Update platform settings (auth, rate limits, pagination defaults, log retention).

### DELETE `/api/settings/logs`

Clear all audit logs.

### DELETE `/api/settings/logs/old`

Clear logs older than retention period.

---

## Database API (raw MongoDB) {#database-api-raw-mongodb}

Requires **`manage_users`**. Browse whitelisted collections as JSON.

### GET `/api/database/collections`

List collections with document counts.

### GET `/api/database/collections/:name`

Query: `page`, `limit`, `search`

### GET `/api/database/collections/:name/:id`

Single document by `_id`.

### POST `/api/database/collections/:name`

Create document. Body: raw JSON object.

### PUT `/api/database/collections/:name/:id`

Replace/update document fields. Body: JSON (without `_id`).

### DELETE `/api/database/collections/:name/:id`

Delete document.

### DELETE `/api/database/collections/:name`

Clear all documents in a collection. Allowed only for `endpointdatas` and `logs`.

See [Database Explorer](database.md) for collection list and security notes.

---

## MCP Server (JSON-RPC)

### POST `/api/mcp`

**Requires authentication:** JWT `Authorization: Bearer <token>` or API key (`X-API-Key` / `Authorization: ApiKey dap_…`).

JSON-RPC 2.0 body. Methods: `initialize`, `tools/list`, `tools/call`, `resources/list`, `resources/read`.

`tools/list` returns only tools the caller can access. `tools/call` runs the endpoint with the same `accessType` rules as direct API calls.

See [Automation — MCP](automation.md#mcp-server-ai-agents).

---

## Dynamic Endpoints (Runtime)

Any path matching a registered endpoint definition is handled by the dynamic engine.

### GET `/api/your-path`

Returns paginated list of stored records for that `resourcePath`.

Query: `page`, `limit`, **`populate`**

| Query | Description |
|-------|-------------|
| `page`, `limit` | Pagination (default 1, 20) |
| `populate=true` | Expand all `reference` fields to embedded objects |
| `populate=fieldName` | Expand one or more fields (comma-separated) |

Example: `GET /api/products?populate=categoryId`

### GET `/api/your-path/:id`

Returns single record by MongoDB `_id`. Supports the same `populate` query parameters.

### POST `/api/your-path`

Creates record. Body validated against endpoint schema.

**Schema field type `reference`:** value must be a valid record ID from the linked target endpoint. Invalid or missing references return `400`.

### PUT `/api/your-path/:id`

Updates record.

### PATCH `/api/your-path/:id`

Partial update.

### DELETE `/api/your-path/:id`

Deletes record.

### Access types

| Type | Requirement |
|------|-------------|
| `public` | No authentication |
| `authenticated` | Valid JWT |
| `group` | JWT + user in `allowedGroupIds` |

### Response format

```json
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 100 }
}
```
