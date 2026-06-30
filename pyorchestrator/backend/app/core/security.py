from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings
from app.models.enums import RoleName

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ROLE_PERMISSIONS: dict[str, set[str]] = {
    RoleName.ADMINISTRATOR.value: {"*"},
    RoleName.DEVELOPER.value: {
        "scripts:read", "scripts:write", "scripts:run", "scripts:delete",
        "secrets:write", "groups:read", "schedules:write", "webhooks:read", "webhooks:write",
    },
    RoleName.OPERATOR.value: {
        "scripts:read", "scripts:run", "scripts:disable",
        "groups:read", "schedules:read", "webhooks:read",
    },
    RoleName.VIEWER.value: {
        "scripts:read", "groups:read", "schedules:read", "runs:read", "webhooks:read",
    },
}


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.jwt_expire_minutes))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return None


def has_permission(role: str, permission: str) -> bool:
    perms = ROLE_PERMISSIONS.get(role, set())
    return "*" in perms or permission in perms


def permissions_for_role(role: str) -> list[str]:
    perms = ROLE_PERMISSIONS.get(role, set())
    if "*" in perms:
        return ["*"]
    return sorted(perms)


def all_permissions() -> list[str]:
    catalog: set[str] = set()
    for perms in ROLE_PERMISSIONS.values():
        catalog.update(p for p in perms if p != "*")
    return sorted(catalog)
