from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, require_admin
from app.core.security import all_permissions, hash_password, permissions_for_role
from app.db.session import get_db
from app.models.enums import RoleName
from app.models.user import User
from app.schemas import PermissionCatalogResponse, RoleResponse, UserCreate, UserResponse, UserUpdate

router = APIRouter()

VALID_ROLES = {role.value for role in RoleName}


def _validate_role(role: str) -> None:
    if role not in VALID_ROLES:
        raise HTTPException(400, f"Invalid role. Must be one of: {', '.join(sorted(VALID_ROLES))}")


async def _count_admins(db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(User)
        .where(User.role == RoleName.ADMINISTRATOR.value, User.is_active == True)  # noqa: E712
    )
    return result.scalar_one()


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_admin)],
):
    result = await db.execute(select(User).order_by(User.email))
    return result.scalars().all()


@router.post("/users", response_model=UserResponse, status_code=201)
async def create_user(
    body: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, Depends(require_admin)],
):
    _validate_role(body.role)
    user = User(
        email=body.email.strip().lower(),
        password_hash=hash_password(body.password),
        display_name=body.display_name.strip(),
        role=body.role,
        is_active=True,
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError:
        raise HTTPException(409, "Email already registered") from None
    return user


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    body: UserUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_admin)],
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")

    data = body.model_dump(exclude_unset=True)
    if "role" in data:
        _validate_role(data["role"])
    if "password" in data:
        user.password_hash = hash_password(data.pop("password"))
    if "email" in data:
        data["email"] = data["email"].strip().lower()

    demoting_admin = user.role == RoleName.ADMINISTRATOR.value and (
        ("role" in data and data["role"] != RoleName.ADMINISTRATOR.value)
        or ("is_active" in data and data["is_active"] is False)
    )
    if demoting_admin and await _count_admins(db) <= 1:
        raise HTTPException(400, "Cannot demote or deactivate the last administrator")

    for field, value in data.items():
        setattr(user, field, value)

    try:
        await db.flush()
    except IntegrityError:
        raise HTTPException(409, "Email already registered") from None
    return user


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(
    user_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    actor: Annotated[User, Depends(require_admin)],
):
    if actor.id == user_id:
        raise HTTPException(400, "Cannot delete your own account")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    if user.role == RoleName.ADMINISTRATOR.value and await _count_admins(db) <= 1:
        raise HTTPException(400, "Cannot delete the last administrator")
    await db.delete(user)


@router.get("/roles", response_model=PermissionCatalogResponse)
async def list_roles(
    _: Annotated[User, Depends(require_admin)],
):
    roles = [
        RoleResponse(name=role.value, permissions=permissions_for_role(role.value))
        for role in RoleName
    ]
    return PermissionCatalogResponse(permissions=all_permissions(), roles=roles)
