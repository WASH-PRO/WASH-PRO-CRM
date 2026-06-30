---
layout: default
redirect_from:
  - /testing.html

title: Testing
description: Unit tests, CI, load testing, and manual API verification
---

Dynamic API Platform includes **automated unit tests** (Vitest), **CI integration**, and a **load test** script for performance smoke checks.

## Quick reference

| Type | Command | Requires |
|------|---------|----------|
| Unit tests | `cd backend && npm test` | Node 20+ only |
| Unit tests (watch) | `cd backend && npm run test:watch` | Node 20+ |
| Load test | `cd backend && npm run test:load` | Running backend (Docker or `npm run dev`) |
| CI | GitHub Actions on every push/PR | Automatic |

---

## Unit tests (Vitest)

Unit tests live in `backend/src/**/*.test.ts` and run **without MongoDB** — they cover pure logic: validation, security helpers, path matching, and MCP naming. **38 tests** across 8 files (Vitest).

### Run locally

```bash
cd backend
npm install
npm test
```

Watch mode while developing:

```bash
npm run test:watch
```

Build + tests (same as CI):

```bash
npm test && npm run build
```

### Test suites

| File | Area | What is verified |
|------|------|------------------|
| `src/utils/validation.test.ts` | Schema & paths | Required fields, types, **unknown field rejection**, reference IDs, `matchDynamicPath`, `sanitizeUser`, client IP |
| `src/utils/schema.test.ts` | Data sanitization | `pickSchemaData` strips extra fields; `findUnknownFields` detects nested unknown keys |
| `src/utils/networkAccess.test.ts` | Security | Domain wildcards, CIDR matching, deny/allow rules, group+endpoint rule merge, invalid input rejection |
| `src/utils/auditLog.test.ts` | Logging | Log source resolution (MCP, cron, API key), compact log entries, valid ObjectId for `userId` |
| `src/utils/semver.test.ts` | Versioning | Semver compare for update checks |
| `src/utils/data-retention.test.ts` | Data lifecycle | TTL / retention helpers |
| `src/utils/github-repo.test.ts` | Security | `githubRepo` setting validation (`owner/repo`) |
| `src/services/mcp.service.test.ts` | MCP | Tool name generation from method + path |

**Current count:** 38 tests across 8 files.

### What unit tests do *not* cover

- Full HTTP stack (Express routes, middleware chain)
- MongoDB persistence (integration tests)
- Frontend React components

These can be added later with `supertest` + test database or Playwright for E2E.

### Configuration

- Runner: [Vitest](https://vitest.dev/) — `backend/vitest.config.ts`
- TypeScript build excludes `*.test.ts` from `dist/`

---

## Runtime validation (tested behaviour)

Unit tests enforce behaviour that protects production data:

1. **Unknown fields rejected** — `POST /api/...` with extra JSON keys returns validation error
2. **Schema-only persistence** — only fields defined in the endpoint schema are written to MongoDB (`pickSchemaData`)
3. **Network access** — invalid domains / CIDR rejected at configuration time
4. **Lean audit logs** — empty optional fields are not stored; API-key pseudo-user IDs are not saved as `userId`

---

## CI (GitHub Actions)

Workflow: `.github/workflows/ci.yml`

On every push/PR to `main`:

1. **Backend** — `npm ci` → `npm test` → `npm run build`
2. **Frontend** — `npm ci` → `npm run build`
3. **Docker** — `docker compose build`

A failing unit test blocks merge.

---

## Load testing

Load test script: `backend/tests/load/load-test.mjs`  
Uses [autocannon](https://github.com/mcollina/autocannon) to hammer the API and print latency / throughput stats.

### Prerequisites

Start the stack:

```bash
docker compose up -d
# or: cd backend && npm run dev
```

Default target: `http://localhost:3001`

### Run

```bash
cd backend
npm install
npm run test:load
```

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOAD_TEST_URL` | `http://localhost:3001` | Base URL of backend |
| `LOAD_TEST_DURATION` | `10` | Seconds per scenario |
| `LOAD_TEST_CONNECTIONS` | `20` | Concurrent connections |
| `LOAD_TEST_PIPELINING` | `1` | HTTP pipelining factor |
| `LOAD_TEST_LOGIN` | `admin` | Login for authenticated scenarios |
| `LOAD_TEST_PASSWORD` | `Admin123!` | Password |

Example — heavier run against staging:

```bash
LOAD_TEST_URL=https://api.example.com \
LOAD_TEST_DURATION=30 \
LOAD_TEST_CONNECTIONS=50 \
npm run test:load
```

### Scenarios executed

| # | Target | Purpose |
|---|--------|---------|
| 1 | `GET /api/health` | Public endpoint baseline |
| 2 | `GET /api/dashboard/stats` | JWT auth + aggregation |
| 3 | `GET /api/endpoints` | Management API list |

The script logs in once, then reuses the Bearer token for protected routes.  
If login fails, authenticated scenarios are skipped with a warning.

### Interpreting results

Autocannon prints:

- **Req/sec** — throughput
- **Latency** — avg / p99 (lower is better)
- **Errors** — non-2xx or connection failures (should be 0)

Use load tests for smoke / regression checks before releases — not as a substitute for production monitoring.

### Rate limiting

All `/api/*` routes share a rate limit (default **1000 requests per window**). Aggressive load tests may return **HTTP 429** once the limit is exceeded.

For heavier benchmarks:

1. **Settings → Rate Limits** — raise max requests in the admin UI, or
2. **Environment** — `RATE_LIMIT_MAX=10000` in `.env` before starting the backend

The load test reports `Non-2xx` counts and exits with code 1 if any scenario fails.

---

## Manual API testing

### Admin UI

- **Endpoint editor → Test tab** — send requests to any endpoint
- **API Docs** (`/api-docs`) — Swagger UI against `/api/openapi.json`

### curl

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"admin","password":"Admin123!"}' \
  | jq -r '.data.accessToken')

# List endpoints
curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/endpoints
```

### Validation check (unknown field)

```bash
curl -X POST http://localhost:3001/api/your-endpoint \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"validField":"ok","injected":true}'
# Expected: 400 with "Unknown field \"injected\""
```

---

## Adding new unit tests

1. Create `backend/src/<module>/<name>.test.ts` next to the code under test
2. Use Vitest: `import { describe, it, expect } from 'vitest'`
3. Prefer pure functions (no DB) for speed
4. Run `npm test` before committing

For integration tests with MongoDB, use a separate `*.integration.test.ts` pattern and a test database URI (future work).

[← Back to Development]({{ '/development/' | relative_url }})
