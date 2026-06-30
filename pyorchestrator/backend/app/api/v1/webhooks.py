import secrets
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_permission
from app.db.session import get_db
from app.models.run import Schedule
from app.models.webhook import Webhook
from app.schemas import WebhookCreate, WebhookResponse, WebhookUpdate
from app.services.script_service import get_script_or_404, queue_run

router = APIRouter()
hooks_router = APIRouter()


def _new_token() -> str:
    return secrets.token_urlsafe(32)


@router.get("", response_model=list[WebhookResponse])
async def list_webhooks(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_permission("webhooks:read"))],
    script_id: UUID | None = None,
):
    q = select(Webhook).order_by(Webhook.name)
    if script_id:
        q = q.where(Webhook.script_id == script_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=WebhookResponse, status_code=201)
async def create_webhook(
    body: WebhookCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_permission("webhooks:write"))],
):
    try:
        await get_script_or_404(db, body.script_id)
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
    webhook = Webhook(
        script_id=body.script_id,
        name=body.name.strip(),
        token=_new_token(),
        max_runtime_seconds=body.max_runtime_seconds,
    )
    db.add(webhook)
    await db.flush()
    return webhook


@router.patch("/{webhook_id}", response_model=WebhookResponse)
async def update_webhook(
    webhook_id: UUID,
    body: WebhookUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_permission("webhooks:write"))],
):
    webhook = await _get_webhook_or_404(db, webhook_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "name" and value is not None:
            value = value.strip()
        setattr(webhook, field, value)
    await db.flush()
    return webhook


@router.post("/{webhook_id}/regenerate-token", response_model=WebhookResponse)
async def regenerate_webhook_token(
    webhook_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_permission("webhooks:write"))],
):
    webhook = await _get_webhook_or_404(db, webhook_id)
    webhook.token = _new_token()
    await db.flush()
    return webhook


@router.delete("/{webhook_id}", status_code=204)
async def delete_webhook(
    webhook_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[object, Depends(require_permission("webhooks:write"))],
):
    webhook = await _get_webhook_or_404(db, webhook_id)
    await db.delete(webhook)


async def _get_webhook_or_404(db: AsyncSession, webhook_id: UUID) -> Webhook:
    result = await db.execute(select(Webhook).where(Webhook.id == webhook_id))
    webhook = result.scalar_one_or_none()
    if not webhook:
        raise HTTPException(404, "Webhook not found")
    return webhook


@hooks_router.post("/{token}")
async def webhook_trigger(token: str, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(
        select(Webhook).where(Webhook.token == token, Webhook.is_active == True)  # noqa: E712
    )
    webhook = result.scalar_one_or_none()
    if webhook:
        try:
            script = await get_script_or_404(db, webhook.script_id)
        except ValueError as exc:
            raise HTTPException(404, str(exc)) from exc
        webhook.last_invoked_at = datetime.now(timezone.utc)
        try:
            run = await queue_run(
                db,
                script,
                trigger_type="webhook",
                max_runtime_seconds=webhook.max_runtime_seconds,
            )
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        return {"run_id": str(run.id), "status": "queued", "source": "webhook"}

    result = await db.execute(
        select(Schedule).where(Schedule.webhook_token == token, Schedule.is_active == True)  # noqa: E712
    )
    sched = result.scalar_one_or_none()
    if not sched:
        raise HTTPException(404, "Invalid webhook")
    script = await get_script_or_404(db, sched.script_id)
    try:
        run = await queue_run(db, script, trigger_type="webhook", schedule_id=sched.id)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    return {"run_id": str(run.id), "status": "queued", "source": "schedule"}
