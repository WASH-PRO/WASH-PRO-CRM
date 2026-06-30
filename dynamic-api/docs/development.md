---
layout: default
redirect_from:
  - /development.html

title: Development
---

## Prerequisites

- Node.js 20+
- npm 10+
- MongoDB 7+ (local or Docker)
- Git

## Setup

```bash
git clone https://github.com/Dynamic-API-Platform/Dynamic-API-Platform.git
cd Dynamic-API-Platform

# Start MongoDB only
docker run -d --name dap-mongo -p 27017:27017 mongo:7

# Backend
cd backend
cp ../.env.example .env
npm install
npm run dev    # tsx watch on port 3001

# Frontend (new terminal)
cd frontend
npm install
npm run dev    # Vite on port 5173
```

Open http://localhost:5173 — Vite proxies `/api` to the backend on port 3001.

### UI themes

Four themes: **Dark**, **Light**, **Ocean**, **Forest**. Click the **palette** icon in the header to cycle themes (or use Settings → Display for descriptions). Preference is stored in `localStorage` under key `theme`.

Details: [UI Themes]({{ '/themes/' | relative_url }})

## Scripts

### Backend

| Command | Description |
|---------|-------------|
| `npm run dev` | Hot reload with tsx |
| `npm run build` | Compile TypeScript |
| `npm start` | Run compiled `dist/index.js` |
| `npm run seed` | Run seed script manually |
| `npm test` | Run unit tests (Vitest) |
| `npm run test:watch` | Unit tests in watch mode |
| `npm run test:load` | Load test against running API (autocannon) |

### Frontend

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |

## Project conventions

### Adding a new management endpoint

1. Add route in `backend/src/routes/`
2. Add service method in `backend/src/services/`
3. Add repository method if DB access needed
4. Register route in `backend/src/app.ts`
5. Add API client method in `frontend/src/services/api.ts`
6. Create/update page in `frontend/src/pages/`
7. Add navigation link in `frontend/src/components/Layout.tsx`
8. Document in `docs/api-reference.md`

### Adding a permission

1. Add to `Permission` type in `backend/src/types/index.ts`
2. Add to Group model enum in `backend/src/models/Group.ts`
3. Add to `ALL_PERMISSIONS` in `frontend/src/pages/GroupsPage.tsx`
4. Use in `requirePermission()` on routes
5. Document in `docs/rbac.md`

### Adding a settings key

1. Add to `settings.service.ts` defaults and key map
2. Add UI field in `SettingsPage.tsx`
3. Use in relevant middleware/service

## TypeScript

Both packages use strict TypeScript. Build before committing:

```bash
cd backend && npm run build
cd ../frontend && npm run build
```

## Testing

See the full guide: [Testing]({{ '/testing/' | relative_url }})

```bash
cd backend
npm test              # unit tests (38 tests, no MongoDB required)
npm run test:load     # load test (requires running backend)
```

CI runs `npm test` on every push to `main`.

## Testing API manually

Use the built-in endpoint tester or:

```bash
# VS Code REST Client, Postman, or curl
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/endpoints
```

## Docker development

```bash
docker compose up -d --build
docker compose logs -f backend
```

## Common development issues

See [Troubleshooting](troubleshooting.md).

## Contributing

See [CONTRIBUTING.md](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/blob/main/CONTRIBUTING.md) on GitHub.
