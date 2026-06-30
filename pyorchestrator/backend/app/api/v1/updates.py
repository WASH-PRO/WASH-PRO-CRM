from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.updates import (
    UpdateApplyRequest,
    UpdateCheckResponse,
    UpdateCheckResponseLegacy,
    UpdateDismissRequest,
    UpdateJobResponse,
    UpdateSettingsResponse,
    UpdateSettingsUpdateRequest,
    UpdateStatusResponse,
)
from app.services.update_scheduler import update_scheduler
from app.services.update_service import update_service
from app.services.update_settings_service import update_settings_service

router = APIRouter()


def _require_admin(user: User) -> None:
    if user.role != "Administrator":
        raise HTTPException(status_code=403, detail="Administrator role required")


def _job_response(job) -> UpdateJobResponse:
    return UpdateJobResponse.model_validate(job)


def _settings_response(data) -> UpdateSettingsResponse:
    return UpdateSettingsResponse(**data.__dict__)


@router.get("/status", response_model=UpdateStatusResponse)
async def get_update_status(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    _require_admin(user)
    status = await update_service.get_status(db)
    from app.services.update_settings_service import UpdateSettingsData

    return UpdateStatusResponse(
        **{k: v for k, v in status.items() if k not in {"settings", "active_job", "recent_jobs", "show_notification"}},
        settings=_settings_response(UpdateSettingsData(**status["settings"])),
        active_job=_job_response(status["active_job"]) if status["active_job"] else None,
        recent_jobs=[_job_response(j) for j in status["recent_jobs"]],
        show_notification=status["show_notification"],
    )


@router.post("/check", response_model=UpdateCheckResponse)
async def check_updates(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    _require_admin(user)
    try:
        return UpdateCheckResponse(**await update_service.check_for_updates(db, persist=True))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/settings", response_model=UpdateSettingsResponse)
async def get_update_settings(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    _require_admin(user)
    return _settings_response(await update_settings_service.load(db))


@router.put("/settings", response_model=UpdateSettingsResponse)
async def put_update_settings(
    body: UpdateSettingsUpdateRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    _require_admin(user)
    try:
        updated = await update_settings_service.update(db, body.model_dump(exclude_none=True))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await update_scheduler.reload_schedule()
    return _settings_response(updated)


@router.post("/apply", response_model=UpdateJobResponse)
async def apply_update(
    body: UpdateApplyRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    _require_admin(user)
    try:
        job = await update_service.start_update(
            db,
            target_version=body.target_version,
            target_tag=body.target_tag,
            user_id=user.id,
            trigger="manual",
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _job_response(job)


@router.post("/dismiss")
async def dismiss_update(
    body: UpdateDismissRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    _require_admin(user)
    await update_service.dismiss_notification(db, body.version)
    return {"ok": True}


@router.get("/jobs", response_model=list[UpdateJobResponse])
async def list_update_jobs(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    _require_admin(user)
    from sqlalchemy import select
    from app.models.system import UpdateJob

    result = await db.execute(select(UpdateJob).order_by(UpdateJob.created_at.desc()).limit(20))
    return [_job_response(job) for job in result.scalars().all()]


@router.get("/jobs/{job_id}", response_model=UpdateJobResponse)
async def get_update_job(
    job_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    _require_admin(user)
    from app.models.system import UpdateJob

    job = await db.get(UpdateJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Update job not found")
    return _job_response(job)


@router.post("/jobs/{job_id}/cancel", response_model=UpdateJobResponse)
async def cancel_update_job(
    job_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    _require_admin(user)
    try:
        job = await update_service.cancel_job(db, job_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _job_response(job)


@router.post("/jobs/{job_id}/rollback", response_model=UpdateJobResponse)
async def rollback_update_job(
    job_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    _require_admin(user)
    try:
        job = await update_service.rollback(db, job_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return _job_response(job)


# Legacy routes kept for backward compatibility
legacy_router = APIRouter()


@legacy_router.get("/check", response_model=UpdateCheckResponseLegacy)
async def legacy_check_updates(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    _require_admin(user)
    check = await update_service.check_for_updates(db, persist=True)
    return UpdateCheckResponseLegacy(
        current_version=check["current_version"],
        latest_version=check["latest_version"],
        update_available=check["update_available"],
        release_notes=check["release_notes"] or "",
    )


@legacy_router.post("/apply")
async def legacy_apply_update(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    _require_admin(user)
    try:
        job = await update_service.start_update(db, user_id=user.id, trigger="manual")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"status": job.status, "job_id": str(job.id)}
