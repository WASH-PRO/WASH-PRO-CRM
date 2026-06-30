Full guide: [Database Explorer](https://dynamic-api-platform.github.io/Dynamic-API-Platform/database/)

Admin panel section **Database** (`/database`) — browse and edit MongoDB collections as raw JSON.

## Requirements

Permission **`manage_users`** (default: Super Admin, Admin).

## Collections

`users`, `groups`, `endpoints`, `endpointgroups`, `endpointdatas`, `logs`, `systemsettings`

## Features

- List collections with document counts
- Paginated document table with JSON preview
- View / edit / create / delete via JSON editor
- **Clear collection** — delete all documents in `endpointdatas` or `logs` (with confirmation)
- Search by `_id` or common text fields
- Passwords redacted in `users` collection

## API

```
GET    /api/database/collections
GET    /api/database/collections/:name?page&limit&search
GET    /api/database/collections/:name/:id
POST   /api/database/collections/:name
PUT    /api/database/collections/:name/:id
DELETE /api/database/collections/:name/:id
DELETE /api/database/collections/:name
```

All routes require `manage_users`. Collection clear is allowed only for `endpointdatas` and `logs`.

## Safety

Use for debugging and one-off fixes. Prefer **Users**, **Endpoints**, and dynamic APIs for normal operations.
