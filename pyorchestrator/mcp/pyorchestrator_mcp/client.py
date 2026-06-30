from __future__ import annotations

import json
from typing import Any

import httpx


class PyOrchestratorError(Exception):
    def __init__(self, status: int, detail: str):
        self.status = status
        self.detail = detail
        super().__init__(f"HTTP {status}: {detail}")


class PyOrchestratorClient:
    def __init__(self, base_url: str, token: str | None = None, timeout: float = 30.0):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self._client = httpx.Client(timeout=timeout)

    def close(self) -> None:
        self._client.close()

    def login(self, email: str, password: str) -> dict[str, Any]:
        data = self._request("POST", "/api/v1/auth/login", json={"email": email, "password": password}, auth=False)
        self.token = data["access_token"]
        return data

    def me(self) -> dict[str, Any]:
        return self._request("GET", "/api/v1/auth/me")

    def _headers(self, auth: bool) -> dict[str, str]:
        headers = {"Accept": "application/json"}
        if auth:
            if not self.token:
                raise PyOrchestratorError(401, "Not authenticated — call pyorch_login or set PYORCH_TOKEN")
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
        auth: bool = True,
    ) -> Any:
        response = self._client.request(
            method,
            f"{self.base_url}{path}",
            params=params,
            json=json,
            headers=self._headers(auth),
        )
        if response.status_code >= 400:
            detail = response.text
            try:
                payload = response.json()
                detail = payload.get("detail", payload)
            except json.JSONDecodeError:
                pass
            raise PyOrchestratorError(response.status_code, str(detail))
        if not response.content:
            return {}
        return response.json()

    # ─── Scripts ─────────────────────────────────────────────────────────────

    def list_scripts(self, group_id: str | None = None) -> list[dict[str, Any]]:
        params = {"group_id": group_id} if group_id else None
        return self._request("GET", "/api/v1/scripts", params=params)

    def get_script(self, script_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/scripts/{script_id}")

    def create_script(
        self,
        name: str,
        description: str = "",
        group_id: str | None = None,
        script_type: str = "script",
        entrypoint: str = "main.py",
        code: str | None = None,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {
            "name": name,
            "description": description,
            "script_type": script_type,
            "entrypoint": entrypoint,
        }
        if group_id:
            body["group_id"] = group_id
        if code is not None:
            body["code"] = code
        return self._request("POST", "/api/v1/scripts", json=body)

    def update_script(self, script_id: str, **fields: Any) -> dict[str, Any]:
        payload = {k: v for k, v in fields.items() if v is not None}
        return self._request("PUT", f"/api/v1/scripts/{script_id}", json=payload)

    def list_script_files(self, script_id: str) -> list[dict[str, Any]]:
        return self._request("GET", f"/api/v1/scripts/{script_id}/files")

    def update_script_file(self, script_id: str, path: str, content: str) -> dict[str, Any]:
        return self._request("PUT", f"/api/v1/scripts/{script_id}/files/{path}", json={"content": content})

    def enable_script(self, script_id: str) -> dict[str, Any]:
        return self._request("POST", f"/api/v1/scripts/{script_id}/enable")

    def disable_script(self, script_id: str) -> dict[str, Any]:
        return self._request("POST", f"/api/v1/scripts/{script_id}/disable")

    def delete_script(self, script_id: str) -> None:
        self._request("DELETE", f"/api/v1/scripts/{script_id}")

    # ─── Runs ────────────────────────────────────────────────────────────────

    def run_script(self, script_id: str) -> dict[str, Any]:
        return self._request("POST", f"/api/v1/runs/scripts/{script_id}/run")

    def stop_script(self, script_id: str) -> dict[str, Any]:
        return self._request("POST", f"/api/v1/runs/scripts/{script_id}/stop")

    def get_run(self, run_id: str) -> dict[str, Any]:
        return self._request("GET", f"/api/v1/runs/{run_id}")

    def get_run_logs(self, run_id: str) -> list[dict[str, Any]]:
        return self._request("GET", f"/api/v1/runs/{run_id}/logs")

    def list_script_runs(self, script_id: str) -> list[dict[str, Any]]:
        return self._request("GET", f"/api/v1/runs/scripts/{script_id}/runs")

    # ─── Groups & schedules ──────────────────────────────────────────────────

    def list_groups(self) -> list[dict[str, Any]]:
        return self._request("GET", "/api/v1/groups")

    def list_schedules(self) -> list[dict[str, Any]]:
        return self._request("GET", "/api/v1/schedules")

    def create_schedule(self, script_id: str, **fields: Any) -> dict[str, Any]:
        payload = {k: v for k, v in fields.items() if v is not None}
        return self._request("POST", f"/api/v1/schedules/scripts/{script_id}", json=payload)

    # ─── Webhooks & secrets ──────────────────────────────────────────────────

    def list_webhooks(self) -> list[dict[str, Any]]:
        return self._request("GET", "/api/v1/webhooks")

    def create_webhook(self, script_id: str, name: str, max_runtime_seconds: int | None = None) -> dict[str, Any]:
        body: dict[str, Any] = {"script_id": script_id, "name": name}
        if max_runtime_seconds is not None:
            body["max_runtime_seconds"] = max_runtime_seconds
        return self._request("POST", "/api/v1/webhooks", json=body)

    def list_secrets(self, script_id: str) -> list[dict[str, Any]]:
        return self._request("GET", f"/api/v1/scripts/{script_id}/secrets")

    def set_secret(self, script_id: str, key: str, value: str, description: str = "") -> dict[str, Any]:
        return self._request(
            "POST",
            f"/api/v1/scripts/{script_id}/secrets",
            json={"key": key, "value": value, "description": description},
        )

    # ─── Observability ───────────────────────────────────────────────────────

    def dashboard_stats(self) -> dict[str, Any]:
        return self._request("GET", "/api/v1/dashboard/stats")

    def dashboard_timeseries(self) -> dict[str, Any]:
        return self._request("GET", "/api/v1/dashboard/timeseries")

    def system_info(self) -> dict[str, Any]:
        return self._request("GET", "/api/v1/system/info")

    def list_notifications(self, unread_only: bool = False) -> list[dict[str, Any]]:
        params = {"unread_only": "true"} if unread_only else None
        return self._request("GET", "/api/v1/notifications", params=params)
