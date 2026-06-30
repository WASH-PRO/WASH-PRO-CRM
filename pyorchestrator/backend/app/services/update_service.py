from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import async_session
from app.models.system import UpdateJob
from app.services.update_executor_service import DEFAULT_STEPS, update_executor_service
from app.services.update_notifications import (
    notify_update_available,
    notify_update_completed,
    notify_update_failed,
    notify_update_started,
)
from app.services.update_settings_service import get_app_version, update_settings_service
from app.utils.semver import is_newer_version, parse_version


class UpdateService:
    async def fetch_latest_release(self, db: AsyncSession) -> dict | None:
        cfg = await update_settings_service.load(db)
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "PyOrchestrator-Updater",
        }
        if settings.github_update_token:
            headers["Authorization"] = f"Bearer {settings.github_update_token}"
        url = f"https://api.github.com/repos/{cfg.github_repo}/releases?per_page=10"
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.get(url, headers=headers)
            res.raise_for_status()
            releases = res.json()

        stable = [r for r in releases if cfg.include_prerelease or not r.get("prerelease")]
        if not stable:
            return None

        best = stable[0]
        best_ver = parse_version(best["tag_name"])
        for release in stable[1:]:
            ver = parse_version(release["tag_name"])
            if is_newer_version(ver, best_ver):
                best = release
                best_ver = ver
        return best

    async def check_for_updates(self, db: AsyncSession, persist: bool = True) -> dict:
        current_version = get_app_version()
        checked_at = update_settings_service.now_iso()
        latest = None
        try:
            latest = await self.fetch_latest_release(db)
        except Exception:
            if persist:
                await update_settings_service.update(db, {"last_check_at": checked_at})
            raise

        latest_version = parse_version(latest["tag_name"]) if latest else None
        update_available = bool(latest_version and is_newer_version(latest_version, current_version))

        if persist:
            patch: dict = {"last_check_at": checked_at}
            cfg = await update_settings_service.load(db)
            if latest_version:
                patch["last_known_latest_version"] = latest_version
            if update_available and latest_version:
                patch["last_notified_version"] = latest_version
                if cfg.notify_enabled and latest_version != cfg.last_notified_version:
                    await notify_update_available(db, latest_version, latest.get("html_url", ""))
            await update_settings_service.update(db, patch)

        return {
            "current_version": current_version,
            "latest_version": latest_version,
            "latest_tag": latest["tag_name"] if latest else None,
            "update_available": update_available,
            "release_url": latest.get("html_url") if latest else None,
            "release_notes": latest.get("body") if latest else None,
            "published_at": latest.get("published_at") if latest else None,
            "checked_at": checked_at,
            "executor_available": update_executor_service.is_available(),
            "executor_reason": update_executor_service.get_unavailable_reason(),
            "deploy_mode": settings.update_deploy_mode,
        }

    async def get_status(self, db: AsyncSession) -> dict:
        await self.reconcile_stale_jobs(db)
        cfg = await update_settings_service.load(db)
        current_version = get_app_version()
        cached_latest = cfg.last_known_latest_version or cfg.last_notified_version
        cache_stale = not cfg.last_check_at or (
            cached_latest is not None and is_newer_version(current_version, cached_latest)
        )

        try:
            if cache_stale:
                check = await self.check_for_updates(db, persist=True)
            else:
                latest_version = cfg.last_known_latest_version or cfg.last_notified_version
                check = {
                    "current_version": current_version,
                    "latest_version": latest_version,
                    "latest_tag": f"v{latest_version}" if latest_version else None,
                    "update_available": bool(
                        latest_version and is_newer_version(latest_version, current_version)
                    ),
                    "release_url": None,
                    "release_notes": None,
                    "published_at": None,
                    "checked_at": cfg.last_check_at,
                    "executor_available": update_executor_service.is_available(),
                    "executor_reason": update_executor_service.get_unavailable_reason(),
                    "deploy_mode": settings.update_deploy_mode,
                }
        except Exception:
            check = {
                "current_version": current_version,
                "latest_version": None,
                "latest_tag": None,
                "update_available": False,
                "release_url": None,
                "release_notes": None,
                "published_at": None,
                "checked_at": cfg.last_check_at or update_settings_service.now_iso(),
                "executor_available": update_executor_service.is_available(),
                "executor_reason": update_executor_service.get_unavailable_reason(),
                "deploy_mode": settings.update_deploy_mode,
            }

        active_job = await self._get_active_job(db)
        recent = await db.execute(
            select(UpdateJob).order_by(UpdateJob.created_at.desc()).limit(5)
        )
        recent_jobs = list(recent.scalars().all())
        dismissed = cfg.dismissed_version
        show_notification = (
            cfg.notify_enabled
            and check["update_available"]
            and bool(check["latest_version"])
            and check["latest_version"] != dismissed
            and active_job is None
        )

        return {
            **check,
            "settings": cfg.__dict__,
            "active_job": active_job,
            "recent_jobs": recent_jobs,
            "show_notification": show_notification,
        }

    async def dismiss_notification(self, db: AsyncSession, version: str) -> None:
        await update_settings_service.update(db, {"dismissed_version": version})

    async def start_update(
        self,
        db: AsyncSession,
        *,
        target_version: str | None = None,
        target_tag: str | None = None,
        user_id: UUID | None = None,
        trigger: str = "manual",
    ) -> UpdateJob:
        await self.reconcile_stale_jobs(db)
        active = await self._get_active_job(db)
        if active:
            raise ValueError("An update is already in progress")

        check = await self.check_for_updates(db, persist=False)
        resolved_tag = target_tag or check["latest_tag"]
        resolved_version = target_version or (
            parse_version(resolved_tag) if resolved_tag else check["latest_version"]
        )
        if not resolved_tag or not resolved_version:
            raise ValueError("No target version available")
        if trigger == "manual" and not is_newer_version(resolved_version, get_app_version()):
            raise ValueError(
                f"Version {resolved_version} is not newer than current {get_app_version()}"
            )
        if not update_executor_service.is_available():
            raise ValueError(
                update_executor_service.get_unavailable_reason()
                or "Auto-update is not available on this server"
            )

        cfg = await update_settings_service.load(db)
        job = UpdateJob(
            status="queued",
            from_version=get_app_version(),
            target_version=resolved_version,
            target_tag=resolved_tag,
            release_url=check.get("release_url"),
            release_notes=check.get("release_notes"),
            trigger=trigger,
            triggered_by_user_id=user_id,
            steps=[dict(step) for step in DEFAULT_STEPS],
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)
        await notify_update_started(db, job)
        await update_executor_service.run_job(
            job.id,
            {
                "target_tag": job.target_tag,
                "target_version": job.target_version,
                "from_version": job.from_version,
                "github_repo": cfg.github_repo,
            },
        )
        return job

    async def rollback(self, db: AsyncSession, job_id: UUID) -> UpdateJob:
        job = await db.get(UpdateJob, job_id)
        if not job:
            raise ValueError("Update job not found")
        if not job.rollback_snapshot:
            raise ValueError("No rollback snapshot for this job")
        await update_executor_service.rollback_job(job_id)
        await db.refresh(job)
        return job

    async def cancel_job(self, db: AsyncSession, job_id: UUID) -> UpdateJob:
        job = await db.get(UpdateJob, job_id)
        if not job:
            raise ValueError("Update job not found")
        if job.status not in {"queued", "running"}:
            raise ValueError("Only active jobs can be cancelled")
        await self.finish_job(job_id, "failed", "Cancelled by user")
        await db.refresh(job)
        return job

    async def mark_job_started(self, job_id: UUID) -> None:
        async with async_session() as db:
            job = await db.get(UpdateJob, job_id)
            if not job or job.status != "queued":
                return
            job.status = "running"
            job.started_at = datetime.now(timezone.utc)
            steps = list(job.steps or [])
            if steps:
                steps[0] = {**steps[0], "status": "running", "message": "Updater started"}
            job.steps = steps
            await db.commit()

    async def finish_job(
        self,
        job_id: UUID,
        status: str,
        error: str | None = None,
        rollback_snapshot: dict | None = None,
    ) -> None:
        async with async_session() as db:
            job = await db.get(UpdateJob, job_id)
            if not job:
                return
            job.status = status
            job.finished_at = datetime.now(timezone.utc)
            job.error = error
            if rollback_snapshot:
                job.rollback_snapshot = rollback_snapshot
            if status == "completed":
                await update_settings_service.update(
                    db,
                    {
                        "last_applied_version": job.target_version,
                        "last_known_latest_version": job.target_version,
                        "dismissed_version": job.target_version,
                    },
                )
                await notify_update_completed(db, job)
            elif status in {"failed", "rolled_back"}:
                await notify_update_failed(db, job, error or status)
            await db.commit()

    async def reconcile_stale_jobs(self, db: AsyncSession) -> None:
        current = get_app_version()
        result = await db.execute(
            select(UpdateJob).where(UpdateJob.status.in_(["queued", "running", "rolling_back"]))
        )
        now = datetime.now(timezone.utc)
        for job in result.scalars().all():
            if not is_newer_version(job.target_version, current):
                await self.finish_job(
                    job.id,
                    "failed",
                    f"Already on v{current} — update to v{job.target_version} is no longer needed",
                )
                continue
            ref = job.started_at or job.created_at
            age_ms = (now - ref).total_seconds() * 1000
            if job.status == "queued" and age_ms > 10 * 60 * 1000:
                await self.finish_job(job.id, "failed", "Update timed out — updater never started")
            elif job.status == "running" and age_ms > 60 * 60 * 1000:
                await self.finish_job(job.id, "failed", "Update timed out — no completion signal")

    async def process_result_file(self) -> None:
        result_path = Path(settings.update_data_dir) / "update-result.json"
        if not result_path.exists():
            return
        try:
            data = json.loads(result_path.read_text(encoding="utf-8"))
            await self.finish_job(
                UUID(data["jobId"]),
                data["status"],
                data.get("error"),
                data.get("rollbackSnapshot"),
            )
            result_path.unlink(missing_ok=True)
        except Exception:
            pass

    async def process_progress_file(self) -> None:
        progress_path = Path(settings.update_data_dir) / "update-progress.json"
        if not progress_path.exists():
            return
        try:
            data = json.loads(progress_path.read_text(encoding="utf-8"))
            await self._apply_progress(data)
        except Exception:
            pass

    async def _apply_progress(self, data: dict) -> None:
        async with async_session() as db:
            job = await db.get(UpdateJob, UUID(data["jobId"]))
            if not job:
                return
            if data.get("steps"):
                incoming = {s["id"]: s for s in data["steps"]}
                steps = []
                for step in job.steps or []:
                    patch = incoming.get(step["id"])
                    if patch:
                        steps.append({**step, **patch})
                    else:
                        steps.append(step)
                job.steps = steps
            if data.get("rollbackSnapshot"):
                job.rollback_snapshot = data["rollbackSnapshot"]
            if data.get("status") == "running" and job.status == "queued":
                job.status = "running"
                job.started_at = datetime.now(timezone.utc)
            if data.get("status") == "rolling_back":
                job.status = "rolling_back"
            await db.commit()

    async def _get_active_job(self, db: AsyncSession) -> UpdateJob | None:
        result = await db.execute(
            select(UpdateJob)
            .where(UpdateJob.status.in_(["queued", "running", "rolling_back"]))
            .order_by(UpdateJob.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()


update_service = UpdateService()
