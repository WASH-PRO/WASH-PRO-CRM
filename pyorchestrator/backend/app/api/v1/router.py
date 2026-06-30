from fastapi import APIRouter, Depends
from typing import Annotated

from app.api.v1 import auth, editor, groups, mcp, misc, runs, scripts, system, updates, users, webhooks
from app.core.deps import verify_internal_key

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, tags=["users"])
api_router.include_router(system.router, prefix="/system", tags=["system"])
api_router.include_router(mcp.router, prefix="/mcp", tags=["mcp"])
api_router.include_router(scripts.router, prefix="/scripts", tags=["scripts"])
api_router.include_router(runs.router, prefix="/runs", tags=["runs"])
api_router.include_router(groups.groups_router, tags=["groups"])
api_router.include_router(groups.schedules_router, prefix="/schedules", tags=["schedules"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
api_router.include_router(webhooks.hooks_router, prefix="/hooks", tags=["webhooks"])
api_router.include_router(misc.secrets_router, tags=["secrets"])
api_router.include_router(misc.notifications_router, prefix="/notifications", tags=["notifications"])
api_router.include_router(misc.backups_router, prefix="/backups", tags=["backups"])
api_router.include_router(misc.dashboard_router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(updates.router, prefix="/updates", tags=["updates"])
api_router.include_router(updates.legacy_router, prefix="/system/updates", tags=["ota"])
api_router.include_router(editor.router, prefix="/editor", tags=["editor"])

internal_router = APIRouter(dependencies=[Depends(verify_internal_key)])
internal_router.include_router(misc.internal_router, tags=["internal"])
