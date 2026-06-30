# Changelog

All notable changes to **Dynamic API Platform** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Multi-tenant workspace support

## [1.5.13] - 2026-06-30

### Added
- **MCP authentication** — `POST /api/mcp` requires JWT Bearer or API key (`X-API-Key` / `Authorization: ApiKey`); `tools/list` and `tools/call` respect endpoint `accessType`
- **Database Explorer** — clear entire collection (`endpointdatas`, `logs`) with confirmation
- **API version in UI** — versioned paths (`/api/v1/…`) shown in endpoints list, API schema, and endpoint test tab; optional `apiVersion` can be cleared on save
- **Login page** — split layout with visual panel and favicon
- **GitHub Pages** — Issues section in docs sidebar

### Changed
- **MCP admin page** — authentication headers, access rules, curl examples; refreshed screenshot
- **Resources sidebar** — removed Developer link
- MCP tool descriptions include public URL with API version when set

### Security
- MCP JSON-RPC endpoint no longer accepts unauthenticated requests

## [1.5.12] - 2026-06-25

### Added
- **Live UI** — header badge on every admin page: auto-refresh on **Dashboard** (15 s) and **System** (10 s); **статические данные** on all other pages — [live-ui.md](docs/live-ui.md)

### Changed
- **Documentation** — GitHub Pages, wiki mirror, README, and org profile synced (Live UI, updates, themes, 37 unit tests, security v1.5.10)

## [1.5.11] - 2026-06-25

### Fixed
- **In-app Docker update** — compose bind mounts now use the real host project path (`DAP_HOST_PROJECT_ROOT`) when the updater runs inside a container; fixes `mongo-init` / backend / frontend failing to start after update on macOS and similar setups
- **Rollback** — same host-path fix when `docker compose` is invoked from the updater container

## [1.5.10] - 2026-06-25

### Security
- Validate **githubRepo** update setting (`owner/repo` only) — blocks malformed or path-like values before GitHub API calls
- **HSTS** enabled in production (Helmet)
- **Referrer-Policy**: `strict-origin-when-cross-origin` on API responses

## [1.5.9] - 2026-06-25

### Added
- **Ocean** theme — deep navy panels with teal accents
- **Forest** theme — charcoal green with emerald accents
- **UI Themes** docs — [themes.md](docs/themes.md); palette button in header cycles Dark → Light → Ocean → Forest
- Theme descriptions in **Settings → Display**

## [1.5.8] - 2026-06-25

### Fixed
- **Software Updates status** — Settings now shows the real latest GitHub version (`lastKnownLatestVersion`), not stale `lastNotifiedVersion`; auto-refreshes when installed version is newer than cache
- **Status row** — displays **Up to date** or **Update available** clearly

## [1.5.7] - 2026-06-18

### Added
- **Data retention** — per-endpoint storage lifetime in days (Settings → Endpoint → General); MongoDB TTL auto-deletes records after expiry; leave empty to keep data **forever**
- **Editable path** — change endpoint path after creation; stored records migrate to the new collection automatically

### Changed
- **docs**, **wiki**, and **README** — data retention and path editing documented

## [1.5.6] - 2026-06-18

### Changed
- **GitHub Pages**, **wiki**, and **organization profile** synced with v1.5.5 update fixes
- **docs/updates.md** — cancel button, stale job reconciliation, bash updater notes

## [1.5.5] - 2026-06-18

### Fixed
- **Stuck update banner** — stale jobs (e.g. target v1.5.2 while already on a newer version) are auto-failed on startup and status checks
- **Updater crash** — self-update script now runs with `bash` (not `sh`); POSIX-compatible loops in `self-update.sh`
- **Executor** — detects failed `docker run` spawn and marks job failed instead of leaving it queued forever
- **Cancel** button on Settings for active update jobs

## [1.5.3] - 2026-06-18

### Fixed
- **Update snapshot step** no longer hangs — removed slow `docker compose images` scan and full-directory tar backup; snapshot completes in seconds
- **System page** shows correct installed version from `APP_VERSION` / `package.json` (was hardcoded `1.0.0`)
- **Settings** platform version synced with installed release
- **Sidebar** version loaded dynamically from `/api/health`

### Changed
- **System page** — Auto-update status and deploy mode cards
- Archive-based rollback uses GitHub release tarball of previous version

## [1.5.2] - 2026-06-18

### Added
- **Update now** button in Settings and notification banner — checks GitHub then applies the latest release
- **GitHub archive fallback** for deployments without `.git` (ZIP download) with backup-based rollback

### Changed
- **Auto-update enabled by default** in Docker Compose — socket + project mount preconfigured for local PC and VPS
- **Updater** uses compose network health check (`http://backend:3001/api/health`) and named data volume
- **Host path resolution** for detached updater via `${PWD}` and `/proc/mountinfo`

### Fixed
- Update job data volume mount for detached updater containers

## [1.5.1] - 2026-06-18

### Fixed
- **Startup crash** — update settings seed no longer writes `null` values to `SystemSettings` (MongoDB validation error on first boot)

## [1.5.0] - 2026-06-18

### Added
- **Software update system** — GitHub Releases check, in-app notification banner, Settings → Software Updates
- **Scheduled update checks** and optional **auto-update** with configurable intervals
- **Update jobs** with step progress (snapshot → fetch → deploy → health)
- **Automatic rollback** on failed health check after deploy
- **Self-update scripts** — `scripts/self-update.sh`, `scripts/self-update-rollback.sh` (detached Docker runner)
- **Update API** — `/api/updates/*` (status, settings, apply, rollback, dismiss)
- **Documentation** — [docs/updates.md](docs/updates.md)
- **Semver tests** — version comparison for release checks (30 unit tests total)

### Changed
- **Docker backend image** — root build context; includes `docker-cli`, `git`, `jq`, `curl`, updater scripts
- **docker-compose.yml** / **docker-compose.replica.yml** — update env vars, `update_data` volume, `host.docker.internal`
- **Health endpoint** — returns installed `version`

## [1.4.0] - 2026-06-24

### Added
- **Three deployment variants** — [Deployment Variants](docs/deployment-variants.md): Docker single-node, Docker MongoDB replica set (3 nodes), Kubernetes (StatefulSet + scaled backend)
- **Docker replica set** — `docker-compose.replica.yml`, `docker/mongo/replica-init.sh`, npm scripts `docker:replica:*`
- **Kubernetes manifests** — `k8s/` (MongoDB StatefulSet, backend/frontend Deployments, `k8s/scripts/deploy.sh`, npm scripts `k8s:*`)
- **Unit tests** (Vitest) — schema validation, network access, audit logs, MCP naming, security helpers (27 tests)
- **Load test** — `npm run test:load` (autocannon) for health, dashboard, endpoints scenarios
- **Testing docs** — [docs/testing.md](docs/testing.md); CI runs `npm test`
- **Screenshot automation** — `npm run screenshots` / `scripts/capture-screenshots.mjs`; refreshed UI gallery (14 pages including Logs)
- **Runtime strict validation** — reject unknown fields on POST/PUT/PATCH; `pickSchemaData` strips extra fields before MongoDB write
- **MCP Server** admin page at `/mcp` — tools table, JSON-RPC examples, endpoint URL
- **Dashboard automation KPIs** — Cron Jobs, Webhooks, API Keys, MCP Tools cards
- **Dashboard charts** — webhook deliveries, cron runs, API traffic by source (direct/MCP/cron/API key)
- **Automation health** widget on dashboard — cron/webhook errors, unused API keys
- **Audit log actions** — `webhook_dispatch`, `cron_run`, `mcp_call`, `api_key_used` with `source` field
- **Logs filters** — new action types and Source column

### Changed
- **MongoDB indexes** — compound indexes on `EndpointData`, `Log`, `Endpoint`, `ApiKey` for list/stats queries
- **MongoDB replica set URI** support in `database.ts` (`serverSelectionTimeoutMS`, `retryWrites`)
- **Lean audit logs** — `compactLogEntry` omits empty fields; invalid API-key user IDs no longer stored on logs
- **Removed duplicate** `api_key_used` log entries (API key traffic tracked via `source` on `api_call`)
- **Docs screenshots** — relative URLs for GitHub Pages; dashboard reflects automation KPIs

### Fixed
- Sidebar layout — navigation scrolls inside the panel; Resources footer stays visible without page scroll
- Swagger UI — load `swagger-ui-standalone-preset.js` for `StandaloneLayout`
- K8s deploy script — correct project root path; MongoDB StatefulSet healthcheck YAML quoting

## [1.3.0] - 2026-06-18

### Added
- **Cron scheduler** — periodic jobs (JavaScript, HTTP, internal endpoint calls) via `node-cron`
- **Outbound webhooks** — `user.*`, `endpoint.*`, `api.error` events with HMAC signatures
- **MCP server** — JSON-RPC at `POST /api/mcp` (`tools/list`, `tools/call`, OpenAPI resource)
- **API versioning** — optional `apiVersion` on endpoints (also serves `/api/v1/...`)
- **API keys** — machine-to-machine auth via `X-API-Key` or `Authorization: ApiKey`
- Admin UI: **Cron Jobs**, **Webhooks**, **API Keys** (Automation section)

### Changed
- `optionalAuth` / `authenticate` accept API keys alongside JWT
- OpenAPI spec includes versioned paths and API key security scheme

## [1.2.0] - 2026-06-18

### Added
- **OpenAPI / Swagger** — auto-generated spec at `/api/openapi.json` and interactive UI at `/api/swagger`
- **Project export/import** — download/upload `project.json` from Settings (endpoint groups, endpoints, optional data & settings)
- **JavaScript handlers** — `async function handler(req, db)` on endpoints; replaces default CRUD when enabled; no restart required
- Admin UI: **API Docs** page (`/api-docs`), **Handler** tab in endpoint editor

### Changed
- OpenAPI, Swagger, and project routes excluded from dynamic engine catch-all

## [1.1.0] - 2026-06-18

### Added
- **`reference` schema field type** — link records between endpoints (foreign keys)
  - Target endpoint selector in the schema editor (**Linked endpoint**)
  - Validation on create/update: referenced record must exist in the target collection
  - **`?populate=true`** or **`?populate=fieldName`** on GET requests to embed linked records
- **Database Explorer** — admin UI (`/database`) and REST API (`/api/database/*`) for raw MongoDB access
  - Whitelisted collections: users, groups, endpoints, endpointgroups, endpointdatas, logs, systemsettings
  - View, create, edit, delete documents as JSON; search and pagination
  - Requires `manage_users`; sensitive user fields redacted; changes audit-logged
- **Network access rules** — restrict dynamic endpoints by allowed **domains** and **IP/CIDR pools**
  - Configurable on **endpoint groups** and individual **endpoints** (Network Access tab/section)
  - Group inheritance with merged rules; enforced at runtime before JWT access-type checks
  - Admin tester can simulate client IP and `Origin` header
- **API Schema** — read-only ER diagram of endpoints, groups, and reference links (`/api-schema`)
- **Light theme** — slate + cyan UI aligned with WASH-PHO-CRM dashboard; toggle in header
- Documentation: [Network Access](docs/network-access.md), [Database Explorer](docs/database.md), [API Schema](docs/api-schema.md)
- Session handling: centralized `UnauthorizedError` and auth state sync on token expiry
- Zero-downtime API creation documented (no server restart on new routes); comparison with Strapi/Directus

### Changed
- License changed from MIT to **Apache License 2.0**
- GitHub Pages and repository URLs migrated to `Dynamic-API-Platform` organization
- Admin UI layout: top header bar with user info, theme toggle, and logout
- System endpoints **List Users** and **List Groups**: `accessType` set to `authenticated` (documented as management API; RBAC enforced on the real route)
- Seed migration: existing system endpoints get updated `accessType` and descriptions on backend startup

### Fixed
- **Session expiry UX** — expired or invalid tokens redirect to `/login` instead of showing "Failed to load dashboard"
- **JWT refresh bug** — access tokens issued after refresh had empty `permissions` when user groups were populated from MongoDB
- **System endpoint tester** — built-in test for `/api/users`, `/api/groups`, `/api/profile` now calls real management APIs with RBAC
- **Dynamic engine** — GET/PUT/DELETE on paths with parameters (e.g. `/api/products/:id`) now resolve records using the collection base path
- Broken images in `docs/screenshots.md` on GitHub (use raw.githubusercontent.com URLs)
- Nginx `proxy_pass` in frontend container — full API paths (e.g. `/api/auth/login`) now reach backend

## [1.0.0] - 2026-06-18

### Added

#### Platform core
- Full-stack Dynamic API Platform deployable via `docker compose up -d`
- Node.js / Express / TypeScript backend with MongoDB persistence
- React / TypeScript / Tailwind CSS admin panel with dark theme
- Dynamic REST API engine — endpoints stored in MongoDB and executed at runtime
- Repository + Service layer architecture on the backend
- Automatic database seeding (admin user, system groups, system endpoints, endpoint groups, default settings)

#### Authentication & security
- JWT access + refresh token authentication
- bcrypt password hashing
- Role-based access control (RBAC) with permission checks
- Login lockout after failed attempts (configurable in Settings)
- API rate limiting (configurable window and max requests)
- Helmet security headers, CORS, CSRF token endpoint
- Audit logging for auth, CRUD, and API calls

#### Dynamic API engine
- Create custom REST endpoints via UI (GET, POST, PUT, PATCH, DELETE)
- Schema builder with field types: `string`, `number`, `boolean`, `object`, `array`, `datetime`, `json`
- Nested object fields support
- Data validation against schema on write operations
- Shared `resourcePath` storage for CRUD on the same path
- Dynamic path parameters (`/api/users/:id`)
- Access types: `public`, `authenticated`, `group`
- Built-in API tester (Postman-like) in endpoint editor
- Auto-generated documentation and request/response examples

#### System endpoints (non-deletable)
- `/api/auth/login`, `/api/auth/logout`, `/api/auth/refresh`, `/api/auth/register`
- `/api/users`, `/api/groups`, `/api/profile`
- `/api/health`, `/api/csrf-token`

#### Admin UI pages
- **Dashboard** — users, endpoints, requests, errors, groups stats + charts
- **Endpoints** — grouped collapsible tables per endpoint group, quick edit, full editor
- **Endpoint Groups** — CRUD with name, description, color, display order
- **Users** — CRUD with groups assignment, server-side pagination and search
- **User Groups** — RBAC groups with permissions, system groups protected
- **Audit Logs** — filter by action, server-side pagination and text search
- **System** — OS, CPU, memory, disk, files, network interfaces with search
- **Settings** — auth lockout, JWT lifetimes, registration toggle, rate limits, log retention, pagination defaults

#### Search
- Unified `SearchInput` component across all dynamic data sections
- Client-side search: Endpoints, User Groups, Endpoint Groups, System network, Schema fields
- Server-side search: Users, Audit Logs

#### DevOps
- Docker Compose with health checks for MongoDB, backend, frontend
- Named volumes: `dap_mongodb_data`, `dap_backend_logs`
- Nginx frontend proxy to backend API in production container
- GitHub Actions CI workflow
- GitHub Pages documentation site (`/docs`)
- Wiki mirror in `/wiki` folder

### Default credentials (change after first login!)
- Login: `admin`
- Password: `Admin123!`

### Default RBAC groups
- Super Admin, Admin, Editor, Manager, User

### Default endpoint groups
- CRM, SHOP, DEVICES

[1.5.13]: https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/releases/tag/v1.5.13
[1.5.12]: https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/releases/tag/v1.5.12
[1.5.11]: https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/releases/tag/v1.5.11
[1.5.10]: https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/releases/tag/v1.5.10
[1.5.9]: https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/releases/tag/v1.5.9
[1.5.8]: https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/releases/tag/v1.5.8
[1.5.7]: https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/releases/tag/v1.5.7
[1.5.6]: https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/releases/tag/v1.5.6
[1.5.5]: https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/releases/tag/v1.5.5
[1.5.3]: https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/releases/tag/v1.5.3
[1.5.2]: https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/releases/tag/v1.5.2
[1.5.1]: https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/releases/tag/v1.5.1
[1.5.0]: https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/releases/tag/v1.5.0
[1.4.0]: https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/releases/tag/v1.4.0
[1.3.0]: https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/releases/tag/v1.3.0
[1.2.0]: https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/releases/tag/v1.2.0
[1.1.0]: https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/releases/tag/v1.1.0
[1.0.0]: https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/releases/tag/v1.0.0
