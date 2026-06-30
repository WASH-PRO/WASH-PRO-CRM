from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas import SystemInfoResponse
from app.services.system_service import get_system_info

router = APIRouter()


@router.get("/info", response_model=SystemInfoResponse)
async def system_info(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
):
    return await get_system_info(db)
