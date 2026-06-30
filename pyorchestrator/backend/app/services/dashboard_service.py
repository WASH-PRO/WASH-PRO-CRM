from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import RunStatus, ScriptStatus
from app.models.run import Run, RunMetric, Schedule
from app.models.script import Script


async def get_dashboard_stats(db: AsyncSession) -> dict:
    now = datetime.now(timezone.utc)
    day_ago = now - timedelta(hours=24)

    total = await db.scalar(select(func.count()).select_from(Script))
    active = await db.scalar(
        select(func.count()).select_from(Script).where(Script.status == ScriptStatus.ENABLED.value)
    )
    stopped = await db.scalar(
        select(func.count()).select_from(Script).where(Script.status == ScriptStatus.DISABLED.value)
    )
    errors_24h = await db.scalar(
        select(func.count()).select_from(Run).where(
            Run.status.in_([RunStatus.FAILED.value, RunStatus.TIMEOUT.value]),
            Run.finished_at >= day_ago,
        )
    )
    completed = await db.scalar(
        select(func.count()).select_from(Run).where(Run.status == RunStatus.SUCCESS.value)
    )
    active_cron = await db.scalar(
        select(func.count()).select_from(Schedule).where(Schedule.is_active == True)  # noqa: E712
    )
    running_now = await db.scalar(
        select(func.count()).select_from(Run).where(Run.status == RunStatus.RUNNING.value)
    )

    return {
        "total_scripts": total or 0,
        "active_scripts": active or 0,
        "stopped_scripts": stopped or 0,
        "errors_24h": errors_24h or 0,
        "completed_tasks": completed or 0,
        "active_cron_jobs": active_cron or 0,
        "running_now": running_now or 0,
    }


async def get_dashboard_timeseries(db: AsyncSession, hours: int = 24) -> dict:
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)

    labels: list[str] = []
    runs: list[int] = []
    errors: list[int] = []
    successes: list[int] = []
    load: list[int] = []
    schedules: list[int] = []
    cpu: list[float] = []
    memory_mb: list[float] = []
    network: list[float] = []
    disk_io: list[float] = []

    for i in range(hours - 1, -1, -1):
        bucket_end = now - timedelta(hours=i)
        bucket_start = bucket_end - timedelta(hours=1)
        labels.append(bucket_end.strftime("%H:%M"))

        runs.append(
            await db.scalar(
                select(func.count()).select_from(Run).where(
                    Run.queued_at >= bucket_start,
                    Run.queued_at < bucket_end,
                )
            ) or 0
        )
        errors.append(
            await db.scalar(
                select(func.count()).select_from(Run).where(
                    Run.status.in_([RunStatus.FAILED.value, RunStatus.TIMEOUT.value]),
                    Run.finished_at >= bucket_start,
                    Run.finished_at < bucket_end,
                )
            ) or 0
        )
        successes.append(
            await db.scalar(
                select(func.count()).select_from(Run).where(
                    Run.status == RunStatus.SUCCESS.value,
                    Run.finished_at >= bucket_start,
                    Run.finished_at < bucket_end,
                )
            ) or 0
        )
        load.append(
            await db.scalar(
                select(func.count()).select_from(Run).where(
                    Run.started_at < bucket_end,
                    (Run.finished_at.is_(None)) | (Run.finished_at >= bucket_start),
                    Run.status.in_([
                        RunStatus.RUNNING.value,
                        RunStatus.SUCCESS.value,
                        RunStatus.FAILED.value,
                        RunStatus.TIMEOUT.value,
                        RunStatus.CANCELLED.value,
                    ]),
                )
            ) or 0
        )
        schedules.append(
            await db.scalar(
                select(func.count()).select_from(Run).where(
                    Run.schedule_id.is_not(None),
                    Run.queued_at >= bucket_start,
                    Run.queued_at < bucket_end,
                )
            ) or 0
        )

        metric_filters = (
            RunMetric.sampled_at >= bucket_start,
            RunMetric.sampled_at < bucket_end,
        )
        cpu.append(round(float(await db.scalar(select(func.avg(RunMetric.cpu_percent)).where(*metric_filters)) or 0), 1))
        mem_bytes = await db.scalar(select(func.avg(RunMetric.memory_bytes)).where(*metric_filters))
        memory_mb.append(round(float(mem_bytes or 0) / (1024 * 1024), 1))
        network.append(round(float(await db.scalar(select(func.avg(RunMetric.network_connections)).where(*metric_filters)) or 0), 1))
        disk_io.append(round(float(await db.scalar(select(func.avg(RunMetric.open_files)).where(*metric_filters)) or 0), 1))

    return {
        "labels": labels,
        "runs": runs,
        "errors": errors,
        "successes": successes,
        "load": load,
        "schedules": schedules,
        "cpu": cpu,
        "memory_mb": memory_mb,
        "network": network,
        "disk_io": disk_io,
    }
