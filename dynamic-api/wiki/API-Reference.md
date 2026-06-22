Full reference: [API Reference](https://dynamic-api-platform.github.io/Dynamic-API-Platform/api-reference/)

## Base URL

`http://localhost:3001`

## Auth

```
POST /api/auth/login     → { accessToken, refreshToken }
POST /api/auth/refresh
POST /api/auth/logout
```

## Management

| Prefix | Description |
|--------|-------------|
| `/api/users` | User CRUD |
| `/api/groups` | RBAC groups |
| `/api/profile` | Current user |
| `/api/endpoints` | Endpoint management |
| `/api/endpoints/groups` | Endpoint groups |
| `/api/dashboard/stats` | Dashboard |
| `/api/dashboard/logs` | Audit logs |
| `/api/dashboard/system` | System info |
| `/api/settings` | Platform settings |

## Dynamic

Any registered path + method is served at runtime.

```
GET/POST/PUT/PATCH/DELETE /api/your-path
GET/PUT/PATCH/DELETE      /api/your-path/:id
```
