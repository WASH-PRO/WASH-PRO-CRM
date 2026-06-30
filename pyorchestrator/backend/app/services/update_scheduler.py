from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from sqlalchemy import text

from app.db.session import async_session
from app.services.update_service import update_service
from app.services.update_settings_service import update_settings_service

_SCHEDULER_LOCK_KEY = 849301


class UpdateScheduler:
    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._stop = asyncio.Event()
        self._last_check_at: datetime | None = None
        self._last_auto_at: datetime | None = None

    async def start(self) -> None:
        if self._task:
            return
        self._stop.clear()
        now = datetime.now(timezone.utc)
        self._last_check_at = now
        self._last_auto_at = now
        self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        self._stop.set()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def reload_schedule(self) -> None:
        now = datetime.now(timezone.utc)
        self._last_check_at = now
        self._last_auto_at = now

    async def _loop(self) -> None:
        await asyncio.sleep(5)
        while not self._stop.is_set():
            try:
                await update_service.process_result_file()
                await update_service.process_progress_file()
                async with async_session() as db:
                    await update_service.reconcile_stale_jobs(db)
                    leader = await db.scalar(
                        text("SELECT pg_try_advisory_lock(:key)"),
                        {"key": _SCHEDULER_LOCK_KEY},
                    )
                    if leader:
                        try:
                            cfg = await update_settings_service.load(db)
                            now = datetime.now(timezone.utc)
                            if cfg.check_enabled:
                                due = (
                                    self._last_check_at is None
                                    or (now - self._last_check_at).total_seconds()
                                    >= cfg.check_interval_hours * 3600
                                )
                                if due:
                                    try:
                                        await update_service.check_for_updates(db, persist=True)
                                    except Exception:
                                        pass
                                    self._last_check_at = now
                            if cfg.auto_update_enabled:
                                due_auto = (
                                    self._last_auto_at is None
                                    or (now - self._last_auto_at).total_seconds()
                                    >= cfg.auto_update_interval_hours * 3600
                                )
                                if due_auto:
                                    try:
                                        status = await update_service.get_status(db)
                                        if (
                                            status["update_available"]
                                            and status["executor_available"]
                                            and status["active_job"] is None
                                        ):
                                            await update_service.start_update(db, trigger="auto")
                                    except Exception:
                                        pass
                                    self._last_auto_at = now
                        finally:
                            await db.execute(
                                text("SELECT pg_advisory_unlock(:key)"),
                                {"key": _SCHEDULER_LOCK_KEY},
                            )
                            await db.commit()
            except Exception:
                pass
            try:
                await asyncio.wait_for(self._stop.wait(), timeout=5)
            except asyncio.TimeoutError:
                continue


update_scheduler = UpdateScheduler()
