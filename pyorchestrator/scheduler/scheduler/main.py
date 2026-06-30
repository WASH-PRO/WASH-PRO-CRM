"""
PyOrchestrator Scheduler — APScheduler with Postgres-backed schedules.
"""

from __future__ import annotations

import json
import logging
import os
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, HTTPServer

import redis
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pyorch.scheduler")

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
QUEUE_KEY = os.getenv("RUNTIME_QUEUE_KEY", "runtime:jobs")
RELOAD_CHANNEL = os.getenv("SCHEDULER_RELOAD_CHANNEL", "scheduler:reload")
HEALTH_PORT = int(os.getenv("HEALTH_PORT", "9092"))

POSTGRES_HOST = os.getenv("POSTGRES_HOST", "postgres")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "pyorchestrator")
POSTGRES_USER = os.getenv("POSTGRES_USER", "pyorch")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "pyorch_secret")

DATABASE_URL = (
    f"postgresql+psycopg2://{POSTGRES_USER}:{POSTGRES_PASSWORD}"
    f"@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
)


class HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"status":"ok","service":"scheduler"}')

    def log_message(self, format, *args):
        pass


def dispatch_run(script_id: str, schedule_id: str, trigger_type: str = "cron") -> None:
    import httpx

    backend_url = os.getenv("BACKEND_INTERNAL_URL", "http://backend:8000")
    internal_key = os.getenv("INTERNAL_API_KEY", "internal-dev-key")
    try:
        resp = httpx.post(
            f"{backend_url}/internal/schedules/{schedule_id}/trigger",
            headers={"X-Internal-Key": internal_key},
            timeout=30,
        )
        resp.raise_for_status()
        logger.info("Triggered schedule=%s script=%s", schedule_id, script_id)
    except Exception as e:
        logger.error("Failed to trigger schedule %s: %s", schedule_id, e)


def dispatch_backup() -> None:
    import httpx

    backend_url = os.getenv("BACKEND_INTERNAL_URL", "http://backend:8000")
    internal_key = os.getenv("INTERNAL_API_KEY", "internal-dev-key")
    try:
        resp = httpx.post(
            f"{backend_url}/internal/backups/run",
            headers={"X-Internal-Key": internal_key},
            timeout=120,
        )
        resp.raise_for_status()
        logger.info("Scheduled backup completed: %s", resp.json())
    except Exception as e:
        logger.error("Scheduled backup failed: %s", e)


def load_backup_job(scheduler: BackgroundScheduler, session_factory) -> None:
    from sqlalchemy import text

    with session_factory() as db:
        row = db.execute(text("SELECT enabled, cron_expression FROM backup_settings WHERE id = 1")).fetchone()

    if not row or not row[0]:
        try:
            scheduler.remove_job("backup-job")
        except Exception:
            pass
        return

    cron_expr = row[1] or "0 3 * * *"
    try:
        trigger = CronTrigger.from_crontab(cron_expr)
        scheduler.add_job(
            dispatch_backup,
            trigger,
            id="backup-job",
            replace_existing=True,
        )
        logger.info("Registered backup cron %s", cron_expr)
    except Exception as e:
        logger.error("Failed to register backup job: %s", e)


def load_schedules(scheduler: BackgroundScheduler, session_factory) -> None:
    scheduler.remove_all_jobs()
    scheduler.add_job(
        lambda: logger.debug("heartbeat"),
        IntervalTrigger(seconds=60),
        id="heartbeat",
        replace_existing=True,
    )

    with session_factory() as db:
        from sqlalchemy import text
        rows = db.execute(text(
            "SELECT id, script_id, trigger_type, cron_expression, interval_seconds "
            "FROM schedules WHERE is_active = true"
        )).fetchall()

        for row in rows:
            sched_id, script_id, trigger_type, cron_expr, interval_sec = row
            sid = str(sched_id)
            script_s = str(script_id)

            try:
                if trigger_type == "cron" and cron_expr:
                    trigger = CronTrigger.from_crontab(cron_expr)
                    scheduler.add_job(
                        dispatch_run,
                        trigger,
                        id=sid,
                        args=[script_s, sid, "cron"],
                        replace_existing=True,
                    )
                    logger.info("Registered cron %s for script %s", cron_expr, script_s)
                elif trigger_type == "interval" and interval_sec:
                    scheduler.add_job(
                        dispatch_run,
                        IntervalTrigger(seconds=interval_sec),
                        id=sid,
                        args=[script_s, sid, "interval"],
                        replace_existing=True,
                    )
                    logger.info("Registered interval %ss for script %s", interval_sec, script_s)
            except Exception as e:
                logger.error("Failed schedule %s: %s", sid, e)

    load_backup_job(scheduler, session_factory)


def start_reload_listener(scheduler: BackgroundScheduler, session_factory) -> None:
    def listener():
        client = redis.from_url(REDIS_URL, decode_responses=True)
        pubsub = client.pubsub()
        pubsub.subscribe(RELOAD_CHANNEL)
        for message in pubsub.listen():
            if message["type"] == "message":
                logger.info("Reloading schedules")
                load_schedules(scheduler, session_factory)

    threading.Thread(target=listener, daemon=True).start()


def main() -> None:
    server = HTTPServer(("0.0.0.0", HEALTH_PORT), HealthHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()

    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    SessionLocal = sessionmaker(bind=engine)

    scheduler = BackgroundScheduler(timezone="UTC")
    load_schedules(scheduler, SessionLocal)
    start_reload_listener(scheduler, SessionLocal)
    scheduler.start()

    logger.info("Scheduler started")
    try:
        while True:
            time.sleep(3600)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()


if __name__ == "__main__":
    main()
