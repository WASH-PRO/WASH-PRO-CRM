import asyncio
import shutil
from datetime import datetime, timezone

import httpx
import redis.asyncio as aioredis
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.enums import RunStatus, ScriptStatus
from app.models.run import Run, RunMetric, Schedule
from app.models.script import Script
from app.models.user import Group, Notification, User
from app.models.webhook import Webhook

_APP_STARTED_AT = datetime.now(timezone.utc)


def _host_resources() -> dict:
    memory_total_mb = memory_used_mb = memory_percent = 0.0
    try:
        import psutil

        vm = psutil.virtual_memory()
        memory_total_mb = round(vm.total / (1024**2), 1)
        memory_used_mb = round(vm.used / (1024**2), 1)
        memory_percent = round(vm.percent, 1)
    except Exception:
        pass

    disk_total_gb = disk_used_gb = disk_percent = 0.0
    try:
        disk = shutil.disk_usage("/")
        disk_total_gb = round(disk.total / (1024**3), 1)
        disk_used_gb = round(disk.used / (1024**3), 1)
        disk_percent = round(disk.used / disk.total * 100, 1) if disk.total else 0.0
    except Exception:
        pass

    return {
        "memory_total_mb": memory_total_mb,
        "memory_used_mb": memory_used_mb,
        "memory_percent": memory_percent,
        "disk_total_gb": disk_total_gb,
        "disk_used_gb": disk_used_gb,
        "disk_percent": disk_percent,
    }


async def _ping_redis() -> tuple[str, str]:
    try:
        client = aioredis.from_url(settings.redis_url, decode_responses=True)
        await client.ping()
        await client.aclose()
        return "redis", "ok"
    except Exception as exc:
        return "redis", f"error: {exc}"


async def _ping_runtime() -> tuple[str, str]:
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            res = await client.get("http://runtime:9091/health")
            if res.status_code == 200:
                return "runtime", "ok"
            return "runtime", f"http {res.status_code}"
    except Exception as exc:
        return "runtime", f"error: {exc}"


async def _ping_minio() -> tuple[str, str]:
    def check() -> tuple[str, str]:
        try:
            from app.services.script_service import storage_service

            storage_service.check_health()
            return "minio", "ok"
        except Exception as exc:
            return "minio", f"error: {exc}"

    return await asyncio.to_thread(check)


async def get_system_info(db: AsyncSession) -> dict:
    now = datetime.now(timezone.utc)
    uptime_sec = int((now - _APP_STARTED_AT).total_seconds())

    try:
        await db.execute(text("SELECT 1"))
        postgres_status = "ok"
    except Exception as exc:
        postgres_status = f"error: {exc}"

    service_results = await asyncio.gather(_ping_redis(), _ping_runtime(), _ping_minio())
    services = {name: status for name, status in service_results}
    services["postgres"] = postgres_status
    services["backend"] = "ok"

    counts = {
        "scripts": await db.scalar(select(func.count()).select_from(Script)) or 0,
        "scripts_enabled": await db.scalar(
            select(func.count()).select_from(Script).where(Script.status == ScriptStatus.ENABLED.value)
        ) or 0,
        "groups": await db.scalar(select(func.count()).select_from(Group)) or 0,
        "users": await db.scalar(select(func.count()).select_from(User)) or 0,
        "users_active": await db.scalar(
            select(func.count()).select_from(User).where(User.is_active == True)  # noqa: E712
        ) or 0,
        "schedules": await db.scalar(select(func.count()).select_from(Schedule)) or 0,
        "schedules_active": await db.scalar(
            select(func.count()).select_from(Schedule).where(Schedule.is_active == True)  # noqa: E712
        ) or 0,
        "webhooks": await db.scalar(select(func.count()).select_from(Webhook)) or 0,
        "runs_total": await db.scalar(select(func.count()).select_from(Run)) or 0,
        "runs_queued": await db.scalar(
            select(func.count()).select_from(Run).where(Run.status == RunStatus.QUEUED.value)
        ) or 0,
        "runs_running": await db.scalar(
            select(func.count()).select_from(Run).where(Run.status == RunStatus.RUNNING.value)
        ) or 0,
        "notifications_unread": await db.scalar(
            select(func.count()).select_from(Notification).where(Notification.is_read == False)  # noqa: E712
        ) or 0,
    }

    return {
        "name": "PyOrchestrator",
        "version": settings.app_version,
        "environment": settings.app_env,
        "uptime_seconds": uptime_sec,
        "started_at": _APP_STARTED_AT.isoformat(),
        "services": services,
        "counts": counts,
        "config": {
            "runtime_queue": settings.runtime_queue_key,
            "minio_bucket": settings.minio_bucket,
            "minio_endpoint": settings.minio_endpoint,
            "minio_console_url": f"http://localhost:{settings.minio_console_port}",
            "cors_origins": settings.cors_origin_list,
        },
        "resources": _host_resources(),
    }
