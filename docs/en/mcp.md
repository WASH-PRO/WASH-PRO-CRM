---
layout: default
title: MCP for AI agents
description: Connect AI agents to WASH PRO CRM via HTTP MCP (Dynamic API and PyOrchestrator), the Dashboard MCP section, and stdio crm-mcp.
---

WASH PRO CRM provides **Model Context Protocol (MCP)** for connecting AI agents (Cursor, Claude Desktop, etc.) to CRM, SCADA, and automation.

## Three connection methods

| Method | Where to configure | Transport | When to use |
|--------|-------------------|-----------|-------------|
| **Dashboard → MCP server** | `/mcp` | HTTP via nginx | Quick start in Cursor without build |
| **Dynamic API Panel** | `:8080` → Automation → MCP | HTTP `POST /api/mcp` | All platform CRM endpoints |
| **crm-mcp** | `services/crm-mcp` | stdio | Local agent with composite tools |

**Dashboard → Automation → MCP server** (v1.1.12+) — recommended entry point for administrators.

## Dashboard → MCP server (`/mcp`)

Page available to **Administrator** in **Automation** group.

| Block | Description |
|-------|-------------|
| **Service switcher** | **Dynamic API** — CRM, cards, statistics, all auto-generated endpoints; **PyOrchestrator** — scripts, bots, schedules *(if enabled)* |
| **HTTP URL** | Ready MCP address via Dashboard: `/api/mcp` or `/api/pyorch-mcp/mcp` |
| **Cursor config** | JSON for MCP settings (Streamable HTTP, no `npm run build`) |
| **Tools table** | Search, sort, category filter, HTTP method badges |

### nginx proxy (Dashboard)

| Path | Upstream |
|------|----------|
| `/api/mcp` | Dynamic API `POST /api/mcp` (JWT) |
| `/api/pyorch-mcp/mcp` | PyOrchestrator MCP `:8010` *(overlay)* |

For Dynamic API MCP in Cursor, pass JWT from Dashboard session ("Copy" button on page) or use API key `dap_...` from panel `:8080`.

PyOrchestrator MCP via Dashboard **does not require** separate auth in Cursor config — proxy goes to internal Docker network.

## Stdio: `services/crm-mcp`

Separate MCP server for local agent with convenient composite tools (`crm_get_wash_overview`, Dynamic API MCP proxy, Telegram/post-device bridge).

```bash
cd services/crm-mcp
npm install && npm run build
```

Example config: `services/crm-mcp/cursor-mcp.example.json`. Details: [services/crm-mcp/README.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/services/crm-mcp/README.md).

## Dynamic API MCP (platform)

Built into **Dynamic API Platform v1.5.13**:

- panel `:8080` → Automation section;
- endpoint `POST http://localhost:3001/api/mcp` (or via Dashboard `/api/mcp`);
- tools generated from CRM endpoints and automation.

## PyOrchestrator MCP (optional)

With `PYORCHESTRATOR_ENABLED=true`:

- service `pyorch-mcp` on port **8010**;
- ~24 tools: scripts, runs, schedules, secrets, webhooks;
- Dashboard proxies `/api/pyorch-mcp/mcp` for external agents.

Check:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8010/mcp
docker logs wash-pyorch-mcp --tail 20
```

## Troubleshooting

| Symptom | Action |
|---------|--------|
| Dynamic API MCP: 401 | Refresh JWT / API key in Cursor config |
| PyOrchestrator: "unreachable" on `/mcp` | `docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d pyorch-mcp pyorch-backend` |
| No MCP section in menu | **Administrator** role; rebuild `dashboard` |
| Tools not updating | Refresh `/mcp` page (live-polling of tools list) |

Details: [Troubleshooting — PyOrchestrator MCP](troubleshooting.md#pyorchestrator-mcp-unreachable--does-not-start).

## See also

- [Dashboard — navigation](dashboard.md)
- [Embedded services](embedded-services.md)
- [Configuration — PyOrchestrator](configuration.md)
