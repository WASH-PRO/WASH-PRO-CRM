import httpx

from app.core.config import settings

MCP_TOOLS: list[dict[str, str]] = [
    {"name": "pyorch_login", "category": "auth", "description": "Obtain JWT for API access"},
    {"name": "pyorch_whoami", "category": "auth", "description": "Current user and permissions"},
    {"name": "list_scripts", "category": "scripts", "description": "List scripts, optional group filter"},
    {"name": "get_script", "category": "scripts", "description": "Script metadata and optional files"},
    {"name": "create_script", "category": "scripts", "description": "Create a new script with files"},
    {"name": "update_script_file", "category": "scripts", "description": "Update a source file"},
    {"name": "enable_script", "category": "scripts", "description": "Enable script execution"},
    {"name": "disable_script", "category": "scripts", "description": "Disable script execution"},
    {"name": "delete_script", "category": "scripts", "description": "Delete a script"},
    {"name": "run_script", "category": "runs", "description": "Queue a manual run"},
    {"name": "stop_script", "category": "runs", "description": "Stop running sandboxes for a script"},
    {"name": "get_run", "category": "runs", "description": "Run status and metadata"},
    {"name": "get_run_logs", "category": "runs", "description": "Tail run log output"},
    {"name": "list_script_runs", "category": "runs", "description": "Recent runs for a script"},
    {"name": "list_groups", "category": "organization", "description": "List script groups"},
    {"name": "list_schedules", "category": "automation", "description": "List cron/interval/webhook schedules"},
    {"name": "create_schedule", "category": "automation", "description": "Create a schedule for a script"},
    {"name": "list_webhooks", "category": "automation", "description": "List inbound webhooks"},
    {"name": "create_webhook", "category": "automation", "description": "Create a webhook trigger"},
    {"name": "set_script_secret", "category": "secrets", "description": "Set encrypted script secret"},
    {"name": "list_script_secrets", "category": "secrets", "description": "List secret keys for a script"},
    {"name": "dashboard_stats", "category": "platform", "description": "Dashboard KPI counters"},
    {"name": "system_info", "category": "platform", "description": "Platform health and counts"},
    {"name": "list_notifications", "category": "platform", "description": "User notifications and alerts"},
]


async def get_mcp_info() -> dict:
    status = "error: unreachable"
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            res = await client.get(f"{settings.mcp_internal_url}/mcp")
            if res.status_code in (200, 405, 406):
                status = "ok"
            else:
                status = f"http {res.status_code}"
    except Exception as exc:
        status = f"error: {exc}"

    return {
        "status": status,
        "transport": settings.mcp_transport,
        "http_url": f"{settings.mcp_public_url}/mcp",
        "tools": MCP_TOOLS,
        "resource": "pyorch://platform/overview",
    }
