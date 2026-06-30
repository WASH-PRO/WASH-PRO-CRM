from __future__ import annotations

from pyorchestrator_mcp.config import Settings
from pyorchestrator_mcp.server import run


def main() -> None:
    run(Settings.from_env())


if __name__ == "__main__":
    main()
