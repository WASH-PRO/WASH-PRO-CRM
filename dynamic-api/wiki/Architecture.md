See full documentation: [Architecture](https://dynamic-api-platform.github.io/Dynamic-API-Platform/architecture/)

## Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **Backend:** Node.js, Express, TypeScript, Mongoose
- **Database:** MongoDB 7
- **Deploy:** Docker Compose

## Layers

```
Routes → Services → Repositories → MongoDB
```

Dynamic requests: `dynamic.routes` → DynamicEngine → EndpointData

## Key collections

- `users`, `groups` — RBAC
- `endpoints`, `endpointgroups` — API definitions
- `endpointdatas` — runtime data
- `logs` — audit trail
- `systemsettings` — platform config
