from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import decrypt_secret, encrypt_secret
from app.models.script import ScriptSecret


async def set_secret(
    db: AsyncSession, script_id: UUID, key: str, value: str, description: str = ""
) -> ScriptSecret:
    result = await db.execute(
        select(ScriptSecret).where(ScriptSecret.script_id == script_id, ScriptSecret.key == key)
    )
    existing = result.scalar_one_or_none()
    ciphertext, nonce = encrypt_secret(value)
    if existing:
        existing.ciphertext = ciphertext
        existing.nonce = nonce
        existing.description = description
        return existing
    secret = ScriptSecret(
        script_id=script_id, key=key, ciphertext=ciphertext, nonce=nonce, description=description
    )
    db.add(secret)
    await db.flush()
    return secret


async def list_secrets(db: AsyncSession, script_id: UUID) -> list[dict]:
    result = await db.execute(select(ScriptSecret).where(ScriptSecret.script_id == script_id))
    return [
        {"id": str(s.id), "key": s.key, "description": s.description, "has_value": True}
        for s in result.scalars()
    ]


def get_secret_value(secret: ScriptSecret) -> str:
    return decrypt_secret(secret.ciphertext, secret.nonce)
