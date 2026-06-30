import secrets
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user, require_permission
from app.db.session import get_db
from app.models.run import Run, Schedule
from app.models.script import Script
from app.models.user import Group, User
from app.schemas import GroupCreate, GroupResponse, GroupUpdate, ScheduleCreate, ScheduleResponse, ScheduleUpdate
from app.services.script_service import get_script_or_404, redis_service

router = APIRouter()


@router.get("/groups", response_model=list[GroupResponse])
async def list_groups(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("groups:read"))],
):
    result = await db.execute(select(Group).order_by(Group.name))
    return result.scalars().all()


@router.post("/groups", response_model=GroupResponse, status_code=201)
async def create_group(
    body: GroupCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    if user.role != "Administrator":
        raise HTTPException(403, "Only administrators can create groups")
    g = Group(name=body.name, description=body.description, color=body.color, icon=body.icon)
    db.add(g)
    await db.flush()
    return g


@router.patch("/groups/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: UUID,
    body: GroupUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    if user.role != "Administrator":
        raise HTTPException(403, "Only administrators can update groups")
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(404, "Group not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(group, field, value)
    try:
        await db.flush()
    except IntegrityError:
        raise HTTPException(409, "Group name already exists") from None
    return group


@router.delete("/groups/{group_id}", status_code=204)
async def delete_group(
    group_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    if user.role != "Administrator":
        raise HTTPException(403, "Only administrators can delete groups")
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(404, "Group not found")
    await db.execute(update(Script).where(Script.group_id == group_id).values(group_id=None))
    await db.delete(group)
    await db.flush()


groups_router = router


schedules_router = APIRouter()


@schedules_router.get("", response_model=list[ScheduleResponse])
async def list_schedules(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("schedules:read"))],
    script_id: UUID | None = None,
):
    q = select(Schedule)
    if script_id:
        q = q.where(Schedule.script_id == script_id)
    result = await db.execute(q)
    return result.scalars().all()


@schedules_router.post("/scripts/{script_id}", response_model=ScheduleResponse, status_code=201)
async def create_schedule(
    script_id: UUID,
    body: ScheduleCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("schedules:write"))],
):
    await get_script_or_404(db, script_id)
    sched = Schedule(
        script_id=script_id,
        name=body.name,
        trigger_type=body.trigger_type,
        cron_expression=body.cron_expression,
        interval_seconds=body.interval_seconds,
        start_at=body.start_at,
        end_at=body.end_at,
        max_instances=body.max_instances,
        max_runtime_seconds=body.max_runtime_seconds,
        is_active=body.is_active,
        webhook_token=secrets.token_urlsafe(32) if body.trigger_type == "webhook" else None,
    )
    db.add(sched)
    await db.flush()
    await redis_service.publish(settings.scheduler_reload_channel, "reload")
    return sched


@schedules_router.patch("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: UUID,
    body: ScheduleUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("schedules:write"))],
):
    result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    sched = result.scalar_one_or_none()
    if not sched:
        raise HTTPException(404, "Schedule not found")
    updates = body.model_dump(exclude_unset=True)
    new_type = updates.get("trigger_type", sched.trigger_type)
    if new_type == "webhook" and not sched.webhook_token:
        sched.webhook_token = secrets.token_urlsafe(32)
    if new_type != "webhook" and "trigger_type" in updates:
        sched.webhook_token = None
    for field, value in updates.items():
        setattr(sched, field, value)
    await db.flush()
    await redis_service.publish(settings.scheduler_reload_channel, "reload")
    return sched


@schedules_router.delete("/{schedule_id}", status_code=204)
async def delete_schedule(
    schedule_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("schedules:write"))],
):
    result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
    sched = result.scalar_one_or_none()
    if not sched:
        raise HTTPException(404, "Schedule not found")
    await db.execute(update(Run).where(Run.schedule_id == schedule_id).values(schedule_id=None))
    await db.delete(sched)
    try:
        await db.flush()
    except IntegrityError as exc:
        raise HTTPException(409, "Cannot delete schedule: it is still referenced by other records") from exc
    await redis_service.publish(settings.scheduler_reload_channel, "reload")
