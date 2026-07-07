from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.deps import get_current_user, require_permission
from app.db.session import get_db
from app.models.enums import RunStatus, ScriptStatus
from app.models.run import Run
from app.models.script import Script, ScriptFile, ScriptTemplate
from app.models.user import User
from app.schemas import (
    ActiveRunSummary,
    ScriptCreate,
    ScriptFileCreate,
    ScriptFileOrderUpdate,
    ScriptFileResponse,
    ScriptFileUpdate,
    ScriptResponse,
    ScriptUpdate,
    TemplateResponse,
)
from app.services.script_service import (
    create_script,
    create_script_file,
    delete_script_file,
    delete_script_record,
    export_script_zip,
    get_script_or_404,
    import_script_zip,
    ordered_file_paths,
    queue_run,
    redis_service,
    reorder_script_files,
    storage_service,
)

router = APIRouter()


def _attach_active_runs(scripts: list[Script], active_by_script: dict) -> list[ScriptResponse]:
    return [
        ScriptResponse.model_validate(s).model_copy(
            update={
                "active_run": ActiveRunSummary.model_validate(active_by_script[s.id])
                if s.id in active_by_script
                else None,
            }
        )
        for s in scripts
    ]


async def _load_active_runs(db: AsyncSession, script_ids: list[UUID]) -> dict:
    if not script_ids:
        return {}
    runs_result = await db.execute(
        select(Run)
        .where(Run.script_id.in_(script_ids))
        .where(Run.status.in_([RunStatus.RUNNING.value, RunStatus.QUEUED.value]))
        .order_by(Run.queued_at.desc())
    )
    active_by_script: dict = {}
    for run in runs_result.scalars():
        if run.script_id not in active_by_script:
            active_by_script[run.script_id] = run
    return active_by_script


@router.get("", response_model=list[ScriptResponse])
async def list_scripts(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("scripts:read"))],
    group_id: UUID | None = None,
):
    q = select(Script)
    if group_id:
        q = q.where(Script.group_id == group_id)
    result = await db.execute(q.order_by(Script.name))
    scripts = result.scalars().all()
    active_by_script = await _load_active_runs(db, [s.id for s in scripts])
    return _attach_active_runs(scripts, active_by_script)


@router.post("", response_model=ScriptResponse, status_code=201)
async def create_script_endpoint(
    body: ScriptCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_permission("scripts:write"))],
):
    files = None
    meta = body.metadata or {}
    if body.code:
        files = {body.entrypoint: body.code, "requirements.txt": ""}
    script = await create_script(
        db, body.name, body.description, body.group_id, body.script_type, body.entrypoint, files, metadata=meta
    )
    return script


@router.get("/templates", response_model=list[TemplateResponse])
async def list_templates(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("scripts:read"))],
):
    result = await db.execute(select(ScriptTemplate))
    return result.scalars().all()


@router.get("/{script_id}", response_model=ScriptResponse)
async def get_script(
    script_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("scripts:read"))],
):
    try:
        return await get_script_or_404(db, script_id)
    except ValueError:
        raise HTTPException(404, "Script not found")


@router.put("/{script_id}", response_model=ScriptResponse)
async def update_script(
    script_id: UUID,
    body: ScriptUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("scripts:write"))],
):
    try:
        script = await get_script_or_404(db, script_id)
    except ValueError:
        raise HTTPException(404, "Script not found")
    update_data = body.model_dump(exclude_unset=True)
    code = update_data.pop("code", None)
    for field, value in update_data.items():
        if field == "metadata":
            script.metadata_ = value
        else:
            setattr(script, field, value)
    if code is not None:
        entrypoint = script.entrypoint or "main.py"
        sf = next((f for f in script.files if f.path == entrypoint), None)
        if not sf:
            sf = ScriptFile(script_id=script.id, path=entrypoint, file_type="source")
            script.files.append(sf)
            db.add(sf)
        sf.content = code
        sf.size_bytes = len(code.encode())
        storage_service.put_file(script.id, entrypoint, code.encode())
    script.version += 1
    await redis_service.publish(settings.script_updated_channel, str(script.id))
    return script


@router.delete("/{script_id}", status_code=204)
async def delete_script(
    script_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("scripts:delete"))],
):
    try:
        script = await get_script_or_404(db, script_id)
    except ValueError:
        raise HTTPException(404, "Script not found")
    await delete_script_record(db, script)


@router.post("/{script_id}/copy", response_model=ScriptResponse, status_code=201)
async def copy_script(
    script_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("scripts:write"))],
):
    try:
        original = await get_script_or_404(db, script_id)
    except ValueError:
        raise HTTPException(404, "Script not found")
    files = {f.path: f.content or "" for f in original.files}
    return await create_script(
        db, f"{original.name} (copy)", original.description, original.group_id,
        original.script_type, original.entrypoint, files
    )


@router.post("/{script_id}/enable", response_model=ScriptResponse)
async def enable_script(
    script_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("scripts:write"))],
):
    script = await get_script_or_404(db, script_id)
    script.status = ScriptStatus.ENABLED.value
    return script


@router.post("/{script_id}/disable", response_model=ScriptResponse)
async def disable_script(
    script_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("scripts:disable"))],
):
    script = await get_script_or_404(db, script_id)
    script.status = ScriptStatus.DISABLED.value
    return script


@router.get("/{script_id}/files", response_model=list[ScriptFileResponse])
async def list_files(
    script_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("scripts:read"))],
):
    script = await get_script_or_404(db, script_id)
    order = ordered_file_paths(script)
    by_path = {f.path: f for f in script.files}
    return [by_path[path] for path in order if path in by_path]


@router.post("/{script_id}/files", response_model=ScriptFileResponse, status_code=201)
async def create_file(
    script_id: UUID,
    body: ScriptFileCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("scripts:write"))],
):
    try:
        script = await get_script_or_404(db, script_id)
        return await create_script_file(db, script, body.path, body.content)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.put("/{script_id}/files/order", response_model=list[str])
async def update_file_order(
    script_id: UUID,
    body: ScriptFileOrderUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("scripts:write"))],
):
    try:
        script = await get_script_or_404(db, script_id)
        return await reorder_script_files(db, script, body.paths)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.put("/{script_id}/files/{file_path:path}", response_model=ScriptFileResponse)
async def update_file(
    script_id: UUID,
    file_path: str,
    body: ScriptFileUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("scripts:write"))],
):
    script = await get_script_or_404(db, script_id)
    sf = next((f for f in script.files if f.path == file_path), None)
    if not sf:
        sf = ScriptFile(script_id=script.id, path=file_path, file_type="source")
        script.files.append(sf)
        db.add(sf)
    sf.content = body.content
    sf.size_bytes = len(body.content.encode())
    storage_service.put_file(script.id, file_path, body.content.encode())
    script.version += 1
    await redis_service.publish(settings.script_updated_channel, str(script.id))
    return sf


@router.delete("/{script_id}/files/{file_path:path}", status_code=204)
async def delete_file(
    script_id: UUID,
    file_path: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("scripts:write"))],
):
    try:
        script = await get_script_or_404(db, script_id)
        await delete_script_file(db, script, file_path)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/{script_id}/export")
async def export_script(
    script_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("scripts:read"))],
):
    script = await get_script_or_404(db, script_id)
    data = await export_script_zip(script)
    return Response(
        content=data,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{script.slug}.zip"'},
    )


@router.post("/import", response_model=ScriptResponse, status_code=201)
async def import_script(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("scripts:write"))],
    file: UploadFile = File(...),
    group_id: UUID | None = None,
):
    data = await file.read()
    return await import_script_zip(db, data, group_id)


@router.post("/from-template/{template_id}", response_model=ScriptResponse, status_code=201)
async def create_from_template(
    template_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_permission("scripts:write"))],
):
    result = await db.execute(select(ScriptTemplate).where(ScriptTemplate.id == template_id))
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(404, "Template not found")
    files = {k: v for k, v in tpl.file_tree.items() if isinstance(v, str)}
    return await create_script(db, tpl.name, tpl.description, files=files)
