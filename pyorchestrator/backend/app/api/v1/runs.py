from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_permission
from app.db.session import get_db
from app.models.enums import RunStatus
from app.models.run import Run
from app.models.user import User
from app.schemas import RunLogResponse, RunResponse
from app.services.notification_service import dispatch_run_event_notifications
from app.services.script_service import get_script_or_404, queue_run, redis_service

router = APIRouter()


@router.post("/scripts/{script_id}/run", response_model=RunResponse)
async def run_script(
    script_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("scripts:run"))],
):
    try:
        script = await get_script_or_404(db, script_id)
        run = await queue_run(db, script, user_id=user.id)
        return run
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/scripts/{script_id}/stop")
async def stop_script(
    script_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("scripts:run"))],
):
    result = await db.execute(
        select(Run).where(
            Run.script_id == script_id,
            Run.status.in_([RunStatus.RUNNING.value, RunStatus.QUEUED.value]),
        )
    )
    runs = result.scalars().all()
    for run in runs:
        await redis_service.publish(f"run:{run.id}:control", "stop")
        run.status = RunStatus.CANCELLED.value
        run.finished_at = datetime.now(timezone.utc)
        await dispatch_run_event_notifications(db, run, "cancelled")
    await db.flush()
    return {"stopped": len(runs)}


@router.get("/scripts/{script_id}/runs", response_model=list[RunResponse])
async def script_runs(
    script_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("runs:read"))],
    limit: int = 50,
):
    result = await db.execute(
        select(Run).where(Run.script_id == script_id).order_by(Run.queued_at.desc()).limit(limit)
    )
    return result.scalars().all()


@router.get("/{run_id}", response_model=RunResponse)
async def get_run(
    run_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("runs:read"))],
):
    result = await db.execute(select(Run).where(Run.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(404, "Run not found")
    return run


@router.get("/{run_id}/logs", response_model=list[RunLogResponse])
async def get_run_logs(
    run_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("runs:read"))],
):
    from app.models.run import RunLog

    result = await db.execute(
        select(RunLog).where(RunLog.run_id == run_id).order_by(RunLog.id).limit(1000)
    )
    return result.scalars().all()
