# PyOrchestrator MCP Server

MCP (Model Context Protocol) server so AI agents (Cursor, Claude, custom bots) can manage PyOrchestrator via tools.

## Tools

| Tool | Description |
|------|-------------|
| `pyorch_login` | Obtain JWT |
| `pyorch_whoami` | Current user & permissions |
| `list_scripts` / `get_script` / `create_script` | Script CRUD |
| `update_script_file` | Edit source files |
| `run_script` / `stop_script` | Execution control |
| `get_run` / `get_run_logs` / `list_script_runs` | Run observability |
| `list_groups` / `list_schedules` / `create_schedule` | Organization & automation |
| `list_webhooks` / `create_webhook` | External triggers |
| `set_script_secret` / `list_script_secrets` | Encrypted env vars |
| `dashboard_stats` / `system_info` / `list_notifications` | Platform state |

Resource: `pyorch://platform/overview`

## Authentication

Set one of:

- `PYORCH_TOKEN` — existing JWT
- `PYORCH_EMAIL` + `PYORCH_PASSWORD` — auto-login on startup
- Call `pyorch_login` tool at runtime

## Cursor setup (stdio)

Add to **Cursor Settings → MCP** or `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "pyorchestrator": {
      "command": "python3",
      "args": ["-m", "pyorchestrator_mcp"],
      "cwd": "/path/to/PyOrchestrator/mcp",
      "env": {
        "PYORCH_API_URL": "http://localhost:8000",
        "PYORCH_EMAIL": "admin@pyorchestrator.local",
        "PYORCH_PASSWORD": "admin"
      }
    }
  }
}
```

Install locally (Python 3.10+):

```bash
cd mcp
pip install -e .
```

## Docker (HTTP transport)

Included in `docker-compose.yml` as service `mcp` on port **8010**.

```bash
docker compose up -d mcp
```

Env vars:

| Variable | Default | Description |
|----------|---------|-------------|
| `PYORCH_API_URL` | `http://localhost:8000` | Backend API |
| `PYORCH_TOKEN` | — | JWT (optional) |
| `PYORCH_EMAIL` | — | Login email |
| `PYORCH_PASSWORD` | — | Login password |
| `MCP_TRANSPORT` | `stdio` | `stdio` or `streamable-http` |
| `MCP_PORT` | `8010` | HTTP port |

## Example agent workflow

1. `system_info` — check platform health
2. `list_scripts` — find target script
3. `update_script_file` — patch `main.py`
4. `run_script` — execute
5. `get_run_logs` — read output
