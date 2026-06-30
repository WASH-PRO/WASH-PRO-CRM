from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import RoleName
from app.models.user import User
from app.services.notification_service import create_notification


async def _notify_admins(db: AsyncSession, title: str, body: str, severity: str = "info") -> None:
    result = await db.execute(
        select(User).where(User.role == RoleName.ADMINISTRATOR.value, User.is_active == True)  # noqa: E712
    )
    for user in result.scalars().all():
        await create_notification(db, user.id, title, body, severity=severity, run_id=None)
    await db.commit()


async def notify_update_available(db: AsyncSession, version: str, release_url: str) -> None:
    body = f"A new version v{version} is available."
    if release_url:
        body += f" Release: {release_url}"
    await _notify_admins(db, f"Update available: v{version}", body, severity="info")


async def notify_update_started(db, job) -> None:
    await _notify_admins(
        db,
        f"Update started: v{job.from_version} → v{job.target_version}",
        f"Update job {job.id} is running ({job.trigger}).",
        severity="info",
    )


async def notify_update_completed(db, job) -> None:
    await _notify_admins(
        db,
        f"Update completed: v{job.target_version}",
        f"PyOrchestrator was updated successfully to v{job.target_version}.",
        severity="info",
    )


async def notify_update_failed(db, job, message: str) -> None:
    await _notify_admins(
        db,
        f"Update failed: v{job.target_version}",
        message[:4000],
        severity="error",
    )
