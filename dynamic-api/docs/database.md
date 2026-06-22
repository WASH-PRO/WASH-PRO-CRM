---
layout: default
redirect_from:
  - /database.html

title: Database Explorer
description: Raw MongoDB browser and editor in the admin panel
---

The **Database** section (`/database`) lets administrators browse and edit platform MongoDB collections as **raw JSON** — useful for debugging, data fixes, and inspecting `endpointdatas` without external tools.

Requires permission **`manage_users`** (Super Admin / Admin groups by default).

## Access

1. Log in to the admin panel
2. Open **Administration → Database**
3. Select a collection from the left sidebar
4. View, edit, create, or delete documents

Direct URL: `http://localhost:8080/database`

## Allowed collections

| Collection | Label | Notes |
|------------|-------|-------|
| `users` | Users | `password` and `refreshToken` redacted on read; cannot be set via raw editor |
| `groups` | Groups | RBAC permission definitions |
| `endpoints` | Endpoints | API route definitions |
| `endpointgroups` | Endpoint Groups | UI grouping for endpoints |
| `endpointdatas` | Endpoint Data | Runtime CRUD payload storage |
| `logs` | Audit Logs | Auth, API calls, errors |
| `systemsettings` | System Settings | Platform configuration key/value store |

Arbitrary collection names are **not** exposed — only the whitelist above.

## Operations

| Action | UI | API |
|--------|-----|-----|
| List collections + counts | Sidebar | `GET /api/database/collections` |
| List documents (paginated) | Table | `GET /api/database/collections/:name` |
| View JSON | Eye icon | `GET /api/database/collections/:name/:id` |
| Edit JSON | Pencil icon | `PUT /api/database/collections/:name/:id` |
| Create document | New document | `POST /api/database/collections/:name` |
| Delete document | Trash icon | `DELETE /api/database/collections/:name/:id` |

### Search

Search box filters by:

- MongoDB `_id` (24-char hex)
- Common text fields: `name`, `login`, `email`, `path`, `message`, `key`, `slug`

Query param: `?search=...`

### JSON format

- ObjectId fields: 24-character hex strings (e.g. `"507f1f77bcf86cd799439011"`)
- Dates: ISO 8601 strings on read; stored as BSON dates on write
- Fields ending in `Id` / `Ids` are auto-converted to ObjectId on write

## Security

- **RBAC:** `manage_users` required for all `/api/database/*` routes
- **Sensitive fields:** user passwords never returned; updates ignore `[REDACTED]` placeholders
- **Audit:** create/update/delete logged to `logs` collection
- **Production:** restrict `manage_users` to trusted admins only; prefer dedicated MongoDB tools for heavy operations

## When to use

| Use Database UI | Use dedicated pages instead |
|-----------------|----------------------------|
| Inspect raw `endpointdatas` document | Day-to-day endpoint CRUD via dynamic API |
| Fix corrupted JSON in a record | User password changes → **Users** page |
| Debug RBAC `groups` document | Endpoint schema → **Endpoints** editor |
| Clear a single bad log row | Bulk log cleanup → **Settings** |

## Related

- [API Reference — Database API]({{ '/api-reference/' | relative_url }}#database-api-raw-mongodb)
- [RBAC]({{ '/rbac/' | relative_url }})
- [Architecture — data model]({{ '/architecture/' | relative_url }}#data-model-relationships)
