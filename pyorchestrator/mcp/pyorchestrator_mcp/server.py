from __future__ import annotations

import json
from typing import Any

from mcp.server.fastmcp import FastMCP

from pyorchestrator_mcp.client import PyOrchestratorClient, PyOrchestratorError
from pyorchestrator_mcp.config import Settings

_cfg = Settings.from_env()

mcp = FastMCP(
    "PyOrchestrator",
    instructions=(
        "MCP server for PyOrchestrator — manage Python scripts, bots, runs, schedules, "
        "webhooks and secrets. Authenticate with pyorch_login or env PYORCH_TOKEN."
    ),
    host=_cfg.host,
    port=_cfg.port,
)

_client: PyOrchestratorClient | None = None


def _client_or_raise() -> PyOrchestratorClient:
    if _client is None:
        raise RuntimeError("MCP client is not initialized")
    return _client


def _dump(data: Any) -> str:
    return json.dumps(data, indent=2, ensure_ascii=False, default=str)


def _handle(exc: Exception) -> str:
    if isinstance(exc, PyOrchestratorError):
        return json.dumps({"error": exc.detail, "status": exc.status}, ensure_ascii=False)
    return json.dumps({"error": str(exc)}, ensure_ascii=False)


def init_client(settings: Settings) -> PyOrchestratorClient:
    global _client
    client = PyOrchestratorClient(settings.api_url, token=settings.token)
    if not client.token and settings.email and settings.password:
        client.login(settings.email, settings.password)
    _client = client
    return client


# ─── Auth ────────────────────────────────────────────────────────────────────


@mcp.tool()
def pyorch_login(email: str, password: str) -> str:
    """Authenticate against PyOrchestrator and obtain a JWT for subsequent tool calls."""
    try:
        data = _client_or_raise().login(email, password)
        me = _client_or_raise().me()
        return _dump({"access_token": data["access_token"], "user": me})
    except Exception as exc:
        return _handle(exc)


@mcp.tool()
def pyorch_whoami() -> str:
    """Return the current authenticated user and permissions."""
    try:
        return _dump(_client_or_raise().me())
    except Exception as exc:
        return _handle(exc)


# ─── Scripts ─────────────────────────────────────────────────────────────────


@mcp.tool()
def list_scripts(group_id: str | None = None) -> str:
    """List all scripts. Optionally filter by group UUID."""
    try:
        return _dump(_client_or_raise().list_scripts(group_id))
    except Exception as exc:
        return _handle(exc)


@mcp.tool()
def get_script(script_id: str, include_files: bool = False) -> str:
    """Get script metadata by UUID. Set include_files=true to load source files."""
    try:
        client = _client_or_raise()
        script = client.get_script(script_id)
        if include_files:
            script["files"] = client.list_script_files(script_id)
        return _dump(script)
    except Exception as exc:
        return _handle(exc)


@mcp.tool()
def create_script(
    name: str,
    description: str = "",
    group_id: str | None = None,
    script_type: str = "script",
    entrypoint: str = "main.py",
    code: str | None = None,
) -> str:
    """Create a new script. script_type: script | bot. Provide code for main.py content."""
    try:
        return _dump(
            _client_or_raise().create_script(
                name=name,
                description=description,
                group_id=group_id,
                script_type=script_type,
                entrypoint=entrypoint,
                code=code,
            )
        )
    except Exception as exc:
        return _handle(exc)


@mcp.tool()
def update_script_file(script_id: str, path: str, content: str) -> str:
    """Update or create a file in a script workspace (e.g. main.py)."""
    try:
        return _dump(_client_or_raise().update_script_file(script_id, path, content))
    except Exception as exc:
        return _handle(exc)


@mcp.tool()
def enable_script(script_id: str) -> str:
    """Enable a script so it can be run and scheduled."""
    try:
        return _dump(_client_or_raise().enable_script(script_id))
    except Exception as exc:
        return _handle(exc)


@mcp.tool()
def disable_script(script_id: str) -> str:
    """Disable a script — blocks new runs."""
    try:
        return _dump(_client_or_raise().disable_script(script_id))
    except Exception as exc:
        return _handle(exc)


@mcp.tool()
def delete_script(script_id: str) -> str:
    """Permanently delete a script and its runs."""
    try:
        _client_or_raise().delete_script(script_id)
        return _dump({"deleted": script_id})
    except Exception as exc:
        return _handle(exc)


# ─── Runs ────────────────────────────────────────────────────────────────────


@mcp.tool()
def run_script(script_id: str) -> str:
    """Queue a script run. Returns run UUID and status."""
    try:
        return _dump(_client_or_raise().run_script(script_id))
    except Exception as exc:
        return _handle(exc)


@mcp.tool()
def stop_script(script_id: str) -> str:
    """Stop all queued/running instances of a script."""
    try:
        return _dump(_client_or_raise().stop_script(script_id))
    except Exception as exc:
        return _handle(exc)


@mcp.tool()
def get_run(run_id: str) -> str:
    """Get run status, timing and exit code."""
    try:
        return _dump(_client_or_raise().get_run(run_id))
    except Exception as exc:
        return _handle(exc)


@mcp.tool()
def get_run_logs(run_id: str, tail: int = 100) -> str:
    """Fetch stdout/stderr log lines for a run. tail limits returned lines."""
    try:
        logs = _client_or_raise().get_run_logs(run_id)
        if tail > 0:
            logs = logs[-tail:]
        return _dump(logs)
    except Exception as exc:
        return _handle(exc)


@mcp.tool()
def list_script_runs(script_id: str) -> str:
    """List recent runs for a script."""
    try:
        return _dump(_client_or_raise().list_script_runs(script_id))
    except Exception as exc:
        return _handle(exc)


# ─── Groups, schedules, webhooks ─────────────────────────────────────────────


@mcp.tool()
def list_groups() -> str:
    """List script groups (monitoring, bots, integrations, etc.)."""
    try:
        return _dump(_client_or_raise().list_groups())
    except Exception as exc:
        return _handle(exc)


@mcp.tool()
def list_schedules() -> str:
    """List all cron/interval/webhook schedules."""
    try:
        return _dump(_client_or_raise().list_schedules())
    except Exception as exc:
        return _handle(exc)


@mcp.tool()
def create_schedule(
    script_id: str,
    name: str,
    trigger_type: str = "cron",
    cron_expression: str | None = None,
    interval_seconds: int | None = None,
    is_active: bool = True,
) -> str:
    """Create a schedule. trigger_type: cron | interval | webhook."""
    try:
        return _dump(
            _client_or_raise().create_schedule(
                script_id,
                name=name,
                trigger_type=trigger_type,
                cron_expression=cron_expression,
                interval_seconds=interval_seconds,
                is_active=is_active,
            )
        )
    except Exception as exc:
        return _handle(exc)


@mcp.tool()
def list_webhooks() -> str:
    """List webhook triggers."""
    try:
        return _dump(_client_or_raise().list_webhooks())
    except Exception as exc:
        return _handle(exc)


@mcp.tool()
def create_webhook(script_id: str, name: str) -> str:
    """Create a webhook trigger for a script. Returns token for POST /api/v1/hooks/{token}."""
    try:
        return _dump(_client_or_raise().create_webhook(script_id, name))
    except Exception as exc:
        return _handle(exc)


@mcp.tool()
def set_script_secret(script_id: str, key: str, value: str, description: str = "") -> str:
    """Set an encrypted secret for a script (injected as SECRET_{KEY} env var at runtime)."""
    try:
        return _dump(_client_or_raise().set_secret(script_id, key, value, description))
    except Exception as exc:
        return _handle(exc)


@mcp.tool()
def list_script_secrets(script_id: str) -> str:
    """List secret keys for a script (values are never returned)."""
    try:
        return _dump(_client_or_raise().list_secrets(script_id))
    except Exception as exc:
        return _handle(exc)


# ─── Platform ────────────────────────────────────────────────────────────────


@mcp.tool()
def dashboard_stats() -> str:
    """Get dashboard counters: scripts, errors, running jobs."""
    try:
        return _dump(_client_or_raise().dashboard_stats())
    except Exception as exc:
        return _handle(exc)


@mcp.tool()
def system_info() -> str:
    """Get platform version, service health, counts and config."""
    try:
        return _dump(_client_or_raise().system_info())
    except Exception as exc:
        return _handle(exc)


@mcp.tool()
def list_notifications(unread_only: bool = False) -> str:
    """List in-app notifications (run events, errors)."""
    try:
        return _dump(_client_or_raise().list_notifications(unread_only))
    except Exception as exc:
        return _handle(exc)


# ─── Resources ───────────────────────────────────────────────────────────────


@mcp.resource("pyorch://platform/overview")
def platform_overview() -> str:
    """Platform summary: version, stats and available MCP tools."""
    try:
        client = _client_or_raise()
        info = client.system_info()
        stats = client.dashboard_stats()
        return _dump(
            {
                "platform": info,
                "dashboard": stats,
                "tools": [
                    "pyorch_login",
                    "list_scripts",
                    "get_script",
                    "create_script",
                    "update_script_file",
                    "run_script",
                    "stop_script",
                    "get_run_logs",
                    "create_schedule",
                    "set_script_secret",
                    "system_info",
                ],
            }
        )
    except Exception as exc:
        return _handle(exc)


def run(settings: Settings) -> None:
    init_client(settings)
    transport = settings.transport if settings.transport in ("stdio", "sse", "streamable-http") else "stdio"
    mcp.run(transport=transport)
