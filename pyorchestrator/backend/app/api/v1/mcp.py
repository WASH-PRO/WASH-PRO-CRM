from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas import McpInfoResponse
from app.services.mcp_service import get_mcp_info

router = APIRouter()


@router.get("/info", response_model=McpInfoResponse)
async def mcp_info(
    _: Annotated[AsyncSession, Depends(get_db)],
    __: Annotated[User, Depends(get_current_user)],
):
    return await get_mcp_info()
