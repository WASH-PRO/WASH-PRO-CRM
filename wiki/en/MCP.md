> **English** · **[Русский](../ru/MCP.md)**

# MCP for AI Agents

Full documentation: [docs/mcp.md](https://wash-pro.github.io/WASH-PRO-CRM/en/mcp/) · [GitHub Pages — MCP](https://wash-pro.github.io/WASH-PRO-CRM/en/mcp/)

## v1.1.12 — summary

| Method | Where |
|--------|-------|
| **Dashboard** | **Automation → MCP Server** (`/mcp`) |
| Dynamic API HTTP | `/api/mcp` (JWT) |
| PyOrchestrator HTTP | `/api/pyorch-mcp/mcp` *(if PyOrch enabled)* |
| Stdio composite | `services/crm-mcp` |

On `/mcp` page: service switcher, tools table, ready-made JSON for **Cursor** (no build required).

## Quick start (Cursor)

1. Log in to Dashboard as **Administrator**
2. **Automation → MCP Server**
3. Select **Dynamic API** or **PyOrchestrator**
4. Copy Cursor config → paste into Settings → MCP
5. Restart Cursor

## Troubleshooting

| Symptom | Action |
|---------|--------|
| No MCP menu item | Administrator role; `docker compose up -d --build dashboard` |
| PyOrch unreachable | `docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d pyorch-mcp` |
| 401 Dynamic API | Refresh JWT / API key in config |

See [Troubleshooting](https://wash-pro.github.io/WASH-PRO-CRM/en/troubleshooting/), [Dashboard](Dashboard).
