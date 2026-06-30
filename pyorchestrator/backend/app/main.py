"""PyOrchestrator Backend API."""

from contextlib import asynccontextmanager
import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import make_asgi_app
from sqlalchemy import select

from app.api.v1.router import api_router
from app.api.v1.misc import internal_router as internal_routes
from app.core.config import settings
from app.core.security import hash_password
from app.db.schema_patches import apply_schema_patches
from app.db.session import async_session, engine
from app.models import Base
from app.models.run import BackupSettings
from app.models.script import Script, ScriptTemplate
from app.models.user import Group, User
from app.seed.demo_scripts import DEMO_SCRIPTS, DEMO_TEMPLATES
from app.services.script_service import create_script, storage_service
from app.ws.logs import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await apply_schema_patches(conn)
    try:
        await asyncio.to_thread(storage_service.ensure_bucket)
    except Exception:
        pass
    await seed_data()
    yield
    await engine.dispose()


async def seed_data() -> None:
    async with async_session() as db:
        admin = await db.execute(select(User).where(User.email == settings.default_admin_email))
        if not admin.scalar_one_or_none():
            db.add(User(
                email=settings.default_admin_email,
                password_hash=hash_password(settings.default_admin_password),
                display_name="Administrator",
                role="Administrator",
            ))

        for name, color, icon in [
            ("monitoring", "#42a5f5", "monitor"),
            ("bots", "#66bb6a", "smart_toy"),
            ("integrations", "#ab47bc", "hub"),
            ("analytics", "#ffa726", "analytics"),
            ("etl", "#26c6da", "sync_alt"),
            ("parsers", "#ef5350", "code"),
        ]:
            exists = await db.execute(select(Group).where(Group.name == name))
            if not exists.scalar_one_or_none():
                db.add(Group(name=name, description=f"{name} scripts", color=color, icon=icon))

        templates = DEMO_TEMPLATES
        for tpl in templates:
            exists = await db.execute(select(ScriptTemplate).where(ScriptTemplate.name == tpl["name"]))
            if not exists.scalar_one_or_none():
                db.add(ScriptTemplate(
                    name=tpl["name"],
                    description=tpl["description"],
                    file_tree=tpl["files"],
                    category=tpl["category"],
                ))

        for demo in DEMO_SCRIPTS:
            exists = await db.execute(select(Script).where(Script.name == demo["name"]))
            if exists.scalar_one_or_none():
                continue
            group_result = await db.execute(select(Group).where(Group.name == demo["group"]))
            group = group_result.scalar_one_or_none()
            script = await create_script(
                db,
                name=demo["name"],
                description=demo["description"],
                group_id=group.id if group else None,
                script_type=demo["script_type"],
                files=demo["files"],
            )
            script.max_runtime_seconds = demo["max_runtime_seconds"]
            script.max_concurrent_runs = demo["max_concurrent_runs"]

        backup_settings = await db.execute(select(BackupSettings).where(BackupSettings.id == 1))
        if not backup_settings.scalar_one_or_none():
            db.add(BackupSettings(id=1))

        await db.commit()


app = FastAPI(
    title="PyOrchestrator API",
    version=settings.app_version,
    description="SCADA/CMS platform for Python scripts and bots",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")
app.include_router(internal_routes, prefix="/internal")
app.include_router(ws_router, prefix="/ws", tags=["websocket"])
app.mount("/metrics", make_asgi_app())


@app.get("/health")
async def health():
    return {"status": "ok", "service": "backend", "version": settings.app_version}
