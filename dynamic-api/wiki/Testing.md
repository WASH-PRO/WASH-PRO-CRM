# Testing

Full guide: [GitHub Pages — Testing](https://dynamic-api-platform.github.io/Dynamic-API-Platform/testing/)

## Quick reference

| Type | Command | Requires |
|------|---------|----------|
| Unit tests | `cd backend && npm test` | Node 20+ only |
| Watch mode | `cd backend && npm run test:watch` | Node 20+ |
| Load test | `cd backend && npm run test:load` | Running backend |
| CI | GitHub Actions on push/PR | Automatic |

## Unit tests (Vitest)

**38 tests** across 8 files — validation, schema, semver, data retention, github-repo, network access, audit logs, MCP naming — **no MongoDB required**.

```bash
cd backend
npm test
```

Test files: `backend/src/**/*.test.ts`

## Load test (autocannon)

```bash
# Backend must be running (Docker or dev)
cd backend
npm run test:load
```

Environment variables: `LOAD_TEST_URL`, `LOAD_TEST_DURATION`, `LOAD_TEST_CONNECTIONS`, `LOAD_TEST_ADMIN_LOGIN`, `LOAD_TEST_ADMIN_PASSWORD`.

If you see HTTP 429, raise `RATE_LIMIT_MAX` in backend env for the test window.

## CI

`.github/workflows/ci.yml` runs `npm test` and `npm run build` on every push to `main`.

## Contributing

Run tests before opening a PR:

```bash
cd backend && npm test && npm run build
cd ../frontend && npm run build
```
