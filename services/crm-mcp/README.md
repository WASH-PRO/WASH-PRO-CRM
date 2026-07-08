# WASH PRO CRM — MCP Server

Stdio MCP server for AI agents (Cursor, Claude Desktop, etc.) to manage WASH PRO CRM via Dynamic API and bridge services.

## Features

- **Auth** — JWT login, refresh, or API key (`CRM_API_KEY`)
- **CRM entities** — washes, posts, post states, cards, notifications, info messages, settings, statistics
- **Composite tools** — `crm_get_wash_overview` (wash + posts + states)
- **Dynamic API MCP proxy** — `crm_dynamic_list_tools`, `crm_dynamic_call` for all auto-generated endpoints
- **Bridge APIs** — Telegram bots, post-device commands, MQTT user sync

## Quick start (Cursor)

1. Build the server:

```bash
cd services/crm-mcp
npm install
npm run build
```

2. Add to Cursor MCP settings (see `cursor-mcp.example.json`):

```json
{
  "mcpServers": {
    "wash-pro-crm": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/absolute/path/to/WASH-PRO-CRM/services/crm-mcp",
      "env": {
        "CRM_API_URL": "http://localhost:3001",
        "CRM_DASHBOARD_URL": "http://localhost",
        "CRM_LOGIN": "admin",
        "CRM_PASSWORD": "Admin123!"
      }
    }
  }
}
```

3. Restart Cursor and verify tools appear under `wash-pro-crm`.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CRM_API_URL` | `http://localhost:3001` | Dynamic API base URL (REST + `/api/mcp`) |
| `CRM_DASHBOARD_URL` | `http://localhost` | Dashboard/nginx URL for bridge APIs |
| `CRM_LOGIN` | — | Admin login for auto-auth |
| `CRM_PASSWORD` | — | Admin password for auto-auth |
| `CRM_TOKEN` | — | Pre-issued JWT (skip login) |
| `CRM_REFRESH_TOKEN` | — | JWT refresh token |
| `CRM_API_KEY` | — | Dynamic API key (`dap_...`) — recommended for agents |

## Main tools

| Tool | Description |
|------|-------------|
| `crm_whoami` | Current user profile |
| `crm_list_washes` | List car washes |
| `crm_get_wash_overview` | Wash + posts + live states |
| `crm_list_posts` | Equipment posts |
| `crm_list_post_states` | SCADA states |
| `crm_list_cards` | Client cards |
| `crm_list_notifications` | Alerts |
| `crm_list_info_messages` | News/promotions feed |
| `crm_get_settings` / `crm_update_setting` | CRM settings JSON |
| `crm_dynamic_call` | Call any Dynamic API MCP tool |
| `crm_list_telegram_bots` | Telegram bots |
| `crm_send_post_command` | MQTT command to post |
| `crm_set_post_prices` | Push prices to device |

Full list: use `crm_dynamic_list_tools` or inspect `src/tools.ts`.

## Docker

```bash
docker compose up -d --build crm-mcp
```

For stdio MCP, run the container interactively or use the local `node dist/index.js` setup in Cursor.

## Architecture

```
Cursor / Agent
    │ stdio MCP
    ▼
services/crm-mcp  ──REST──►  Dynamic API :3001  (/api/crm/*, /api/mcp)
    │
    └──bridge──►  Dashboard :80  (/api/telegram-bots, /api/crm/post-device)
```

Dynamic API already exposes ~70 CRM endpoints as MCP tools. This server adds curated high-level tools and bridge access with a single auth configuration.

## Production

Prefer an API key with minimal permissions instead of admin password:

```env
CRM_API_KEY=dap_your_key_here
```

Create keys in Dynamic API Panel → API Keys.
