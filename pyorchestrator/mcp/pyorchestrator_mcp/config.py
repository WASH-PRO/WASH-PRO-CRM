from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    api_url: str
    token: str | None
    email: str | None
    password: str | None
    transport: str
    host: str
    port: int

    @classmethod
    def from_env(cls) -> Settings:
        return cls(
            api_url=os.environ.get("PYORCH_API_URL", "http://localhost:8000").rstrip("/"),
            token=os.environ.get("PYORCH_TOKEN") or None,
            email=os.environ.get("PYORCH_EMAIL") or None,
            password=os.environ.get("PYORCH_PASSWORD") or None,
            transport=os.environ.get("MCP_TRANSPORT", "stdio"),
            host=os.environ.get("MCP_HOST", "0.0.0.0"),
            port=int(os.environ.get("MCP_PORT", "8010")),
        )
