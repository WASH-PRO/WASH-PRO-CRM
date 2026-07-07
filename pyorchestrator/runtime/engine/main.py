"""
PyOrchestrator Runtime Engine — consumes jobs, runs sandboxes, reports to backend.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import socket
import threading
import contextlib
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import httpx
import redis.asyncio as aioredis
import redis.exceptions as redis_exc
from prometheus_client import start_http_server

from engine.sandbox import SandboxConfig, SandboxPool

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pyorch.runtime")

QUEUE_KEY = os.getenv("RUNTIME_QUEUE_KEY", "runtime:jobs")
WORKSPACES_ROOT = Path(os.getenv("WORKSPACES_ROOT", "/workspaces"))
MAX_CONCURRENT = int(os.getenv("MAX_CONCURRENT_SANDBOXES", "50"))
BACKEND_URL = os.getenv("BACKEND_INTERNAL_URL", "http://backend:8000")
INTERNAL_KEY = os.getenv("INTERNAL_API_KEY", "internal-dev-key")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
HOSTNAME = socket.gethostname()


class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"ok","service":"runtime"}')
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass


def start_health_server(port: int = 9091):
    server = HTTPServer(("0.0.0.0", port), HealthHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()


async def backend_post(path: str, payload: dict) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            f"{BACKEND_URL}{path}",
            json=payload,
            headers={"X-Internal-Key": INTERNAL_KEY},
        )
        res.raise_for_status()
        return res.json() if res.content else {}


async def backend_get(path: str) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(
            f"{BACKEND_URL}{path}",
            headers={"X-Internal-Key": INTERNAL_KEY},
        )
        res.raise_for_status()
        return res.json()


async def publish_log(redis: aioredis.Redis, run_id: str, level: str, message: str) -> None:
    data = json.dumps({"level": level, "message": message})
    try:
        await redis.publish(f"run:{run_id}:logs", data)
    except Exception as exc:
        logger.warning("Redis log publish failed run_id=%s: %s", run_id, exc)
    try:
        await backend_post("/internal/runs/log", {"run_id": run_id, "level": level, "message": message})
    except Exception as exc:
        logger.warning("Backend log publish failed run_id=%s: %s", run_id, exc)


async def watch_stop(redis: aioredis.Redis, run_id: str, pool: SandboxPool) -> None:
    pubsub = redis.pubsub()
    channel = f"run:{run_id}:control"
    try:
        await pubsub.subscribe(channel)
        while True:
            try:
                msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            except Exception as exc:
                logger.warning("Redis control channel read failed run_id=%s: %s", run_id, exc)
                await asyncio.sleep(1)
                continue
            if msg and msg.get("type") == "message" and msg.get("data") == "stop":
                pool.stop_run(run_id)
                return
            await asyncio.sleep(0.1)
    finally:
        with contextlib.suppress(Exception):
            await pubsub.unsubscribe(channel)
            await pubsub.aclose()


async def process_job(pool: SandboxPool, redis: aioredis.Redis, job: dict) -> None:
    script_id = job["script_id"]
    run_id = job["run_id"]
    entrypoint = job.get("entrypoint", "main.py")

    try:
        files: dict = job.get("files", {})
        if not files and job.get("code"):
            files = {entrypoint: job["code"]}

        workspace = WORKSPACES_ROOT / script_id / run_id
        workspace.mkdir(parents=True, exist_ok=True)
        for path, content in files.items():
            fp = workspace / path
            fp.parent.mkdir(parents=True, exist_ok=True)
            fp.write_text(content)

        secrets = job.get("secrets", {})
        config = SandboxConfig(
            script_id=script_id,
            run_id=run_id,
            entrypoint=entrypoint,
            workspace=workspace,
            env=secrets,
            max_memory_bytes=int(job.get("max_memory_bytes", 512 * 1024 * 1024)),
            max_cpu_seconds=int(job.get("max_cpu_seconds", 300)),
            wall_timeout_sec=int(job.get("wall_timeout_sec", 3600)),
        )

        code = files.get(entrypoint, 'print("no entrypoint")\n')

        async def on_line(level: str, line: str):
            await publish_log(redis, run_id, level, line)

        logger.info("Starting run_id=%s script_id=%s", run_id, script_id)

        try:
            run_status = await backend_get(f"/internal/runs/{run_id}")
        except Exception:
            run_status = {}
        if run_status.get("status") == "cancelled":
            logger.info("Skipping cancelled run_id=%s", run_id)
            return

        start_res = await backend_post("/internal/runs/start", {
            "run_id": run_id,
            "pid": 0,
            "hostname": HOSTNAME,
        })
        if start_res.get("skipped"):
            logger.info("Run already cancelled run_id=%s", run_id)
            return

        stop_watcher = asyncio.create_task(watch_stop(redis, run_id, pool))
        try:
            result = await pool.execute(config, code, on_line=on_line)
        finally:
            stop_watcher.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await stop_watcher

        status = "success" if result.exit_code == 0 and not result.timed_out else (
            "timeout" if result.timed_out else "failed"
        )
        await backend_post("/internal/runs/complete", {
            "run_id": run_id,
            "status": status,
            "exit_code": result.exit_code,
            "duration_ms": result.duration_ms,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "hostname": HOSTNAME,
        })
        logger.info("Finished run_id=%s status=%s", run_id, status)
    except Exception as exc:
        logger.exception("Job failed run_id=%s", run_id)
        try:
            await backend_post("/internal/runs/complete", {
                "run_id": run_id,
                "status": "failed",
                "exit_code": -1,
                "duration_ms": 0,
                "stdout": "",
                "stderr": str(exc),
                "hostname": HOSTNAME,
            })
        except Exception as complete_exc:
            logger.error("Failed to report run completion run_id=%s: %s", run_id, complete_exc)


async def create_redis_client() -> aioredis.Redis:
    return aioredis.from_url(REDIS_URL, decode_responses=True, health_check_interval=30)


async def main_loop() -> None:
    pool = SandboxPool(max_concurrent=MAX_CONCURRENT)
    start_health_server()
    start_http_server(9093)

    client = await create_redis_client()
    logger.info("Runtime listening queue=%s redis=%s host=%s", QUEUE_KEY, REDIS_URL, HOSTNAME)

    while True:
        try:
            item = await client.blpop(QUEUE_KEY, timeout=5)
            if not item:
                continue
            _, payload = item
            job = json.loads(payload)
            asyncio.create_task(process_job(pool, client, job))
        except (redis_exc.ConnectionError, OSError, TimeoutError) as exc:
            logger.warning("Redis connection lost, reconnecting: %s", exc)
            with contextlib.suppress(Exception):
                await client.aclose()
            await asyncio.sleep(2)
            client = await create_redis_client()
        except Exception:
            logger.exception("Main loop error")
            await asyncio.sleep(1)


if __name__ == "__main__":
    asyncio.run(main_loop())
