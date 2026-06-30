from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.enums import RoleName, RunStatus
from app.models.run import Run
from app.models.user import Notification, NotificationDismissal, User


def _event_title(event: str, script_name: str) -> str:
    titles = {
        "queued": f"Script queued: {script_name}",
        "started": f"Script started: {script_name}",
        "completed": f"Script completed: {script_name}",
        "failed": f"Script failed: {script_name}",
        "timeout": f"Script timeout: {script_name}",
        "cancelled": f"Script cancelled: {script_name}",
    }
    return titles.get(event, f"Script event: {script_name}")


def _event_severity(event: str) -> str:
    if event == "failed":
        return "error"
    if event in ("timeout", "cancelled"):
        return "warning"
    return "info"


def _event_body(event: str, run: Run, script_name: str) -> str:
    trigger = run.trigger_type or "manual"
    if event == "queued":
        return f"{script_name} was queued for execution ({trigger})."
    if event == "started":
        return f"{script_name} is now running (run {run.id})."
    if event == "completed":
        duration = f"{run.duration_ms} ms" if run.duration_ms is not None else "—"
        return f"{script_name} finished successfully in {duration}."
    if event == "failed":
        return (run.error_message or f"{script_name} failed (exit code {run.exit_code}).")[:4000]
    if event == "timeout":
        return (run.error_message or f"{script_name} exceeded the runtime limit.")[:4000]
    if event == "cancelled":
        return f"{script_name} was stopped (run {run.id})."
    return f"Run {run.id} — {event}"


async def _notification_exists(
    db: AsyncSession, user_id: UUID, run_id: UUID, event: str, script_name: str
) -> bool:
    title = _event_title(event, script_name)
    has_notification = await db.scalar(
        select(
            exists().where(
                Notification.user_id == user_id,
                Notification.run_id == run_id,
                Notification.title == title,
            )
        )
    )
    if has_notification:
        return True
    return bool(
        await db.scalar(
            select(
                exists().where(
                    NotificationDismissal.user_id == user_id,
                    NotificationDismissal.run_id == run_id,
                    NotificationDismissal.title == title,
                )
            )
        )
    )


async def dismiss_notification(db: AsyncSession, user_id: UUID, notification: Notification) -> None:
    """Record dismissal so backfill sync does not recreate this alert."""
    if notification.run_id is None:
        return
    existing = await db.scalar(
        select(
            exists().where(
                NotificationDismissal.user_id == user_id,
                NotificationDismissal.run_id == notification.run_id,
                NotificationDismissal.title == notification.title,
            )
        )
    )
    if existing:
        return
    db.add(
        NotificationDismissal(
            user_id=user_id,
            run_id=notification.run_id,
            title=notification.title,
        )
    )
    await db.flush()


async def create_notification(
    db: AsyncSession,
    user_id: UUID,
    title: str,
    body: str,
    severity: str = "info",
    run_id: UUID | None = None,
) -> Notification:
    n = Notification(user_id=user_id, title=title, body=body, severity=severity, run_id=run_id)
    db.add(n)
    await db.flush()
    return n


async def notify_run_event(
    db: AsyncSession,
    user_id: UUID,
    event: str,
    script_name: str,
    run_id: UUID,
    body: str | None = None,
) -> None:
    if await _notification_exists(db, user_id, run_id, event, script_name):
        return
    await create_notification(
        db,
        user_id=user_id,
        title=_event_title(event, script_name),
        body=body or f"Run {run_id} — {event}",
        severity=_event_severity(event),
        run_id=run_id,
    )


async def _recipient_user_ids(db: AsyncSession, run: Run) -> set[UUID]:
    user_ids: set[UUID] = set()
    if run.triggered_by_user_id:
        user_ids.add(run.triggered_by_user_id)

    admin_ids = await db.execute(
        select(User.id).where(User.role == RoleName.ADMINISTRATOR.value, User.is_active == True)  # noqa: E712
    )
    user_ids.update(admin_ids.scalars().all())
    return user_ids


async def dispatch_run_event_notifications(
    db: AsyncSession,
    run: Run,
    event: str,
    body: str | None = None,
) -> None:
    await db.refresh(run, ["script"])
    script_name = run.script.name if run.script else "Unknown"
    message = body or _event_body(event, run, script_name)

    for user_id in await _recipient_user_ids(db, run):
        await notify_run_event(db, user_id, event, script_name, run.id, body=message)


def _events_for_run(run: Run) -> list[str]:
    events = ["queued"]
    if run.started_at or run.status in {
        RunStatus.RUNNING.value,
        RunStatus.SUCCESS.value,
        RunStatus.FAILED.value,
        RunStatus.TIMEOUT.value,
        RunStatus.CANCELLED.value,
    }:
        events.append("started")
    if run.status == RunStatus.SUCCESS.value:
        events.append("completed")
    elif run.status == RunStatus.FAILED.value:
        events.append("failed")
    elif run.status == RunStatus.TIMEOUT.value:
        events.append("timeout")
    elif run.status == RunStatus.CANCELLED.value:
        events.append("cancelled")
    return events


async def sync_run_alerts_for_user(db: AsyncSession, user: User) -> None:
    """Backfill run notifications (info, warning, error) for recent runs."""
    day_ago = datetime.now(timezone.utc) - timedelta(hours=24)
    q = (
        select(Run)
        .options(selectinload(Run.script))
        .where(Run.queued_at >= day_ago)
    )
    if user.role != RoleName.ADMINISTRATOR.value:
        q = q.where(Run.triggered_by_user_id == user.id)

    result = await db.execute(q.order_by(Run.queued_at.desc()))
    for run in result.scalars().all():
        script_name = run.script.name if run.script else "Unknown"
        for event in _events_for_run(run):
            body = _event_body(event, run, script_name)
            await notify_run_event(db, user.id, event, script_name, run.id, body=body)


# Backwards-compatible alias used during refactor
async def sync_failure_alerts_for_user(db: AsyncSession, user: User) -> None:
    await sync_run_alerts_for_user(db, user)


async def dispatch_run_failure_alerts(db: AsyncSession, run: Run) -> None:
    if run.status == RunStatus.TIMEOUT.value:
        await dispatch_run_event_notifications(db, run, "timeout")
    elif run.status == RunStatus.FAILED.value:
        await dispatch_run_event_notifications(db, run, "failed")
