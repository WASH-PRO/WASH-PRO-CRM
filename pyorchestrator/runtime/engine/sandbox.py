"""
PyOrchestrator Runtime Engine — isolated Python sandbox supervisor.
"""

from __future__ import annotations

import asyncio
import logging
import os
import resource
import signal
import subprocess
import sys
import tempfile
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from pathlib import Path

from prometheus_client import Counter, Gauge

logger = logging.getLogger(__name__)

RUNS_TOTAL = Counter("pyorch_runtime_runs_total", "Total sandbox runs", ["status"])
ACTIVE_SANDBOXES = Gauge("pyorch_runtime_active_sandboxes", "Currently running sandboxes")

OnLineCallback = Callable[[str, str], Awaitable[None]]


@dataclass
class SandboxConfig:
    script_id: str
    run_id: str
    entrypoint: str = "main.py"
    workspace: Path = field(default_factory=Path)
    env: dict[str, str] = field(default_factory=dict)
    max_memory_bytes: int = 512 * 1024 * 1024
    max_cpu_seconds: int = 300
    wall_timeout_sec: int = 3600


@dataclass
class SandboxResult:
    run_id: str
    exit_code: int
    duration_ms: int
    stdout: str
    stderr: str
    timed_out: bool = False


class Sandbox:
    def __init__(self, config: SandboxConfig):
        self.config = config
        self._process: subprocess.Popen[str] | None = None

    def _child_setup(self) -> None:
        mem = self.config.max_memory_bytes
        cpu = self.config.max_cpu_seconds
        try:
            resource.setrlimit(resource.RLIMIT_AS, (mem, mem))
            resource.setrlimit(resource.RLIMIT_CPU, (cpu, cpu))
            resource.setrlimit(resource.RLIMIT_NOFILE, (1024, 1024))
        except (ValueError, resource.error) as e:
            logger.warning("rlimit: %s", e)

    def _build_env(self) -> dict[str, str]:
        env = os.environ.copy()
        env.update(self.config.env)
        env.update({
            "PYORCH_SCRIPT_ID": self.config.script_id,
            "PYORCH_RUN_ID": self.config.run_id,
            "PYORCH_WORKSPACE": str(self.config.workspace),
            "PYTHONUNBUFFERED": "1",
        })
        return env

    async def run(self, code: str, on_line: OnLineCallback | None = None) -> SandboxResult:
        workspace = self.config.workspace
        workspace.mkdir(parents=True, exist_ok=True)

        entry = workspace / self.config.entrypoint
        if not entry.exists():
            entry.write_text(code)

        venv_dir = workspace / ".venv"
        python_bin = await self._ensure_venv(venv_dir)

        start = time.monotonic()
        timed_out = False
        stdout_chunks: list[str] = []
        stderr_chunks: list[str] = []

        self._process = subprocess.Popen(
            [python_bin, "-u", str(entry)],
            cwd=str(workspace),
            env=self._build_env(),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            preexec_fn=self._child_setup,
        )

        async def stream(pipe, level: str, chunks: list[str]):
            if not pipe:
                return
            loop = asyncio.get_event_loop()
            while True:
                line = await loop.run_in_executor(None, pipe.readline)
                if not line:
                    break
                chunks.append(line)
                if on_line:
                    await on_line(level, line.rstrip())

        try:
            await asyncio.wait_for(
                asyncio.gather(
                    stream(self._process.stdout, "info", stdout_chunks),
                    stream(self._process.stderr, "error", stderr_chunks),
                    asyncio.get_event_loop().run_in_executor(None, self._process.wait),
                ),
                timeout=self.config.wall_timeout_sec,
            )
        except asyncio.TimeoutError:
            timed_out = True
            self.stop()
            msg = f"Wall-clock timeout ({self.config.wall_timeout_sec}s)"
            stderr_chunks.append(msg)
            if on_line:
                await on_line("error", msg)

        duration_ms = int((time.monotonic() - start) * 1000)
        exit_code = self._process.returncode if self._process.returncode is not None else -1
        status = "timeout" if timed_out else ("success" if exit_code == 0 else "failed")
        RUNS_TOTAL.labels(status=status).inc()

        return SandboxResult(
            run_id=self.config.run_id,
            exit_code=exit_code,
            duration_ms=duration_ms,
            stdout="".join(stdout_chunks),
            stderr="".join(stderr_chunks),
            timed_out=timed_out,
        )

    async def _ensure_venv(self, venv_dir: Path) -> str:
        python_bin = venv_dir / "bin" / "python"
        if not python_bin.exists():
            subprocess.run([sys.executable, "-m", "venv", str(venv_dir)], check=True)
            subprocess.run(
                [str(python_bin), "-m", "pip", "install", "--upgrade", "pip"],
                check=True, capture_output=True,
            )
        req = self.config.workspace / "requirements.txt"
        if req.exists() and req.read_text().strip():
            subprocess.run(
                [str(python_bin), "-m", "pip", "install", "-r", str(req)],
                capture_output=True,
            )
        return str(python_bin)

    def stop(self) -> None:
        if self._process and self._process.poll() is None:
            try:
                self._process.send_signal(signal.SIGTERM)
                self._process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._process.kill()


class SandboxPool:
    def __init__(self, max_concurrent: int = 50):
        self.max_concurrent = max_concurrent
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._active: dict[str, Sandbox] = {}

    async def execute(
        self, config: SandboxConfig, code: str, on_line: OnLineCallback | None = None
    ) -> SandboxResult:
        async with self._semaphore:
            ACTIVE_SANDBOXES.inc()
            sandbox = Sandbox(config)
            self._active[config.run_id] = sandbox
            try:
                return await sandbox.run(code, on_line=on_line)
            finally:
                self._active.pop(config.run_id, None)
                ACTIVE_SANDBOXES.dec()

    def stop_run(self, run_id: str) -> bool:
        sandbox = self._active.get(run_id)
        if sandbox:
            sandbox.stop()
            return True
        return False
