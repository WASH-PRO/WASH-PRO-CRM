from uuid import UUID

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings as app_settings
from app.core.deps import get_current_user, require_permission, verify_internal_key
from app.db.session import get_db
from app.models.run import Run
from app.models.user import Notification, User
from app.schemas import (
    BackupResponse,
    BackupRestoreResponse,
    BackupSettingsResponse,
    BackupSettingsUpdate,
    DashboardStats,
    DashboardTimeseries,
    InternalRunComplete,
    InternalRunLog,
    InternalRunMetric,
    InternalRunStart,
    NotificationResponse,
    SecretCreate,
    SecretResponse,
)
from app.services.backup_service import (
    create_backup,
    delete_backup,
    get_backup_download,
    get_backup_settings,
    restore_backup,
)
from app.services.dashboard_service import get_dashboard_stats, get_dashboard_timeseries
from app.services.notification_service import dismiss_notification, sync_run_alerts_for_user
from app.services.run_service import append_run_log, complete_run, record_metric, start_run
from app.services.script_service import get_script_or_404, queue_run, redis_service
from app.services.secret_service import list_secrets, set_secret

secrets_router = APIRouter()


@secrets_router.get("/scripts/{script_id}/secrets", response_model=list[SecretResponse])
async def get_secrets(
    script_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("secrets:write"))],
):
    return await list_secrets(db, script_id)


@secrets_router.post("/scripts/{script_id}/secrets", response_model=SecretResponse, status_code=201)
async def add_secret(
    script_id: UUID,
    body: SecretCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("secrets:write"))],
):
    await get_script_or_404(db, script_id)
    s = await set_secret(db, script_id, body.key, body.value, body.description)
    return SecretResponse(id=s.id, key=s.key, description=s.description, has_value=True)


notifications_router = APIRouter()


@notifications_router.get("", response_model=list[NotificationResponse])
async def list_notifications(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    unread_only: bool = False,
):
    await sync_run_alerts_for_user(db, user)
    q = select(Notification).where(Notification.user_id == user.id)
    if unread_only:
        q = q.where(Notification.is_read == False)  # noqa: E712
    result = await db.execute(q.order_by(Notification.id.desc()).limit(100))
    return result.scalars().all()


@notifications_router.post("/{notification_id}/read")
async def mark_read(
    notification_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == user.id)
    )
    n = result.scalar_one_or_none()
    if not n:
        raise HTTPException(404)
    n.is_read = True
    return {"ok": True}


@notifications_router.delete("/{notification_id}", status_code=204)
async def delete_notification(
    notification_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == user.id)
    )
    n = result.scalar_one_or_none()
    if not n:
        raise HTTPException(404)
    await dismiss_notification(db, user.id, n)
    await db.delete(n)
    await db.flush()


backups_router = APIRouter()


def _require_admin(user: User) -> None:
    if user.role != "Administrator":
        raise HTTPException(403, "Administrator access required")


@backups_router.get("/settings", response_model=BackupSettingsResponse)
async def get_backup_settings_endpoint(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    _require_admin(user)
    return await get_backup_settings(db)


@backups_router.patch("/settings", response_model=BackupSettingsResponse)
async def update_backup_settings(
    body: BackupSettingsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    _require_admin(user)
    settings_row = await get_backup_settings(db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(settings_row, field, value)
    await db.flush()
    await redis_service.publish(app_settings.scheduler_reload_channel, "backup-settings")
    return settings_row


@backups_router.get("", response_model=list[BackupResponse])
async def list_backups(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    _require_admin(user)
    from app.models.run import Backup

    result = await db.execute(select(Backup).order_by(Backup.id.desc()).limit(50))
    return result.scalars().all()


@backups_router.post("", response_model=BackupResponse, status_code=201)
async def create_backup_endpoint(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    _require_admin(user)
    return await create_backup(db, user.id)


@backups_router.get("/{backup_id}/download")
async def download_backup(
    backup_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    _require_admin(user)
    try:
        data, filename = await get_backup_download(db, backup_id)
    except LookupError:
        raise HTTPException(404, "Backup not found") from None
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return Response(
        content=data,
        media_type="application/gzip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@backups_router.delete("/{backup_id}", status_code=204)
async def remove_backup(
    backup_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    _require_admin(user)
    try:
        await delete_backup(db, backup_id)
    except LookupError:
        raise HTTPException(404, "Backup not found") from None


@backups_router.post("/{backup_id}/restore", response_model=BackupRestoreResponse)
async def restore_backup_endpoint(
    backup_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    _require_admin(user)
    try:
        result = await restore_backup(db, backup_id)
    except LookupError:
        raise HTTPException(404, "Backup not found") from None
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return BackupRestoreResponse(**result)


dashboard_router = APIRouter()


@dashboard_router.get("/stats", response_model=DashboardStats)
async def dashboard_stats(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("scripts:read"))],
):
    return await get_dashboard_stats(db)


@dashboard_router.get("/timeseries", response_model=DashboardTimeseries)
async def dashboard_timeseries(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("scripts:read"))],
    hours: int = 24,
):
    return await get_dashboard_timeseries(db, hours=min(max(hours, 6), 48))


internal_router = APIRouter()


@internal_router.post("/backups/run", dependencies=[Depends(verify_internal_key)])
async def internal_run_backup(db: Annotated[AsyncSession, Depends(get_db)]):
    settings_row = await get_backup_settings(db)
    if not settings_row.enabled:
        return {"skipped": True, "reason": "disabled"}
    backup = await create_backup(db, None, "scheduled")
    return {"backup_id": str(backup.id), "status": backup.status}


@internal_router.post("/schedules/{schedule_id}/trigger", dependencies=[Depends(verify_internal_key)])
async def internal_schedule_trigger(schedule_id: UUID, db: Annotated[AsyncSession, Depends(get_db)]):
    from app.models.run import Schedule

    result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    sched = result.scalar_one_or_none()
    if not sched or not sched.is_active:
        raise HTTPException(404, "Schedule not found")
    script = await get_script_or_404(db, sched.script_id)
    run = await queue_run(db, script, trigger_type=sched.trigger_type, schedule_id=sched.id)
    return {"run_id": str(run.id)}


@internal_router.get("/runs/{run_id}", dependencies=[Depends(verify_internal_key)])
async def internal_run_status(run_id: UUID, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(Run).where(Run.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(404, "Run not found")
    return {"run_id": str(run.id), "status": run.status}


@internal_router.post("/runs/start", dependencies=[Depends(verify_internal_key)])
async def internal_run_start(body: InternalRunStart, db: Annotated[AsyncSession, Depends(get_db)]):
    run = await start_run(db, body.run_id, body.pid, body.hostname)
    return {"ok": True, "skipped": run is None}


@internal_router.post("/runs/complete", dependencies=[Depends(verify_internal_key)])
async def internal_run_complete(body: InternalRunComplete, db: Annotated[AsyncSession, Depends(get_db)]):
    await complete_run(
        db, body.run_id, body.status, body.exit_code, body.duration_ms,
        body.stdout, body.stderr, body.hostname,
    )
    return {"ok": True}


@internal_router.post("/runs/log", dependencies=[Depends(verify_internal_key)])
async def internal_run_log(body: InternalRunLog, db: Annotated[AsyncSession, Depends(get_db)]):
    await append_run_log(db, body.run_id, body.level, body.message)
    return {"ok": True}


@internal_router.post("/runs/metric", dependencies=[Depends(verify_internal_key)])
async def internal_run_metric(body: InternalRunMetric, db: Annotated[AsyncSession, Depends(get_db)]):
    await record_metric(
        db, body.run_id, body.cpu_percent, body.memory_bytes,
        body.thread_count, body.open_files, body.network_connections,
    )
    return {"ok": True}


