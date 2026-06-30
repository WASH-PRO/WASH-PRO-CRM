"""PyOrchestrator SDK — injected into script sandboxes."""

import os
import urllib.request


class Platform:
    def __init__(self):
        self.script_id = os.environ.get("PYORCH_SCRIPT_ID", "")
        self.run_id = os.environ.get("PYORCH_RUN_ID", "")
        self.workspace = os.environ.get("PYORCH_WORKSPACE", ".")

    def secrets(self) -> dict[str, str]:
        return {k[7:]: v for k, v in os.environ.items() if k.startswith("SECRET_")}

    def get_secret(self, key: str, default: str = "") -> str:
        return os.environ.get(f"SECRET_{key}", default)

    def storage_path(self, relative: str) -> str:
        return os.path.join(self.workspace, relative)

    def notify(self, message: str) -> None:
        print(f"[NOTIFY] {message}")

    def http_get(self, url: str) -> str:
        return urllib.request.urlopen(url, timeout=30).read().decode()


platform = Platform()
