from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import re
from pathlib import Path

from app.core.config import settings
from app.models.system import SystemSetting
from app.utils.github_repo import validate_github_repo
from app.utils.semver import is_newer_version

KEY_MAP = {
    "check_enabled": "update_check_enabled",
    "notify_enabled": "update_notify_enabled",
    "auto_update_enabled": "update_auto_enabled",
    "check_interval_hours": "update_check_interval_hours",
    "auto_update_interval_hours": "update_auto_interval_hours",
    "github_repo": "update_github_repo",
    "include_prerelease": "update_include_prerelease",
    "last_check_at": "update_last_check_at",
    "last_known_latest_version": "update_last_known_latest_version",
    "last_notified_version": "update_last_notified_version",
    "dismissed_version": "update_dismissed_version",
    "last_applied_version": "update_last_applied_version",
}

REVERSE_MAP = {v: k for k, v in KEY_MAP.items()}


@dataclass
class UpdateSettingsData:
    check_enabled: bool = True
    notify_enabled: bool = True
    auto_update_enabled: bool = False
    check_interval_hours: int = 24
    auto_update_interval_hours: int = 168
    github_repo: str = "PyOrchestrator/PyOrchestrator"
    include_prerelease: bool = False
    last_check_at: str | None = None
    last_known_latest_version: str | None = None
    last_notified_version: str | None = None
    dismissed_version: str | None = None
    last_applied_version: str | None = None


DEFAULTS = UpdateSettingsData()

_DEPLOY_CONFIG_PATHS = (
    Path("/app/app/core/config.py"),
    Path("/deploy/backend/app/core/config.py"),
)
_VERSION_PATTERN = re.compile(r'app_version:\s*str\s*=\s*"([^"]+)"')


def _read_deployed_app_version() -> str | None:
    for path in _DEPLOY_CONFIG_PATHS:
        try:
            if path.is_file():
                match = _VERSION_PATTERN.search(path.read_text(encoding="utf-8"))
                if match:
                    return match.group(1)
        except OSError:
            continue
    return None


def get_app_version() -> str:
    env_version = settings.app_version
    deployed = _read_deployed_app_version()
    if deployed and is_newer_version(deployed, env_version):
        return deployed
    return env_version


class UpdateSettingsService:
    def __init__(self) -> None:
        self._cache = UpdateSettingsData()

    def get_cached(self) -> UpdateSettingsData:
        return UpdateSettingsData(**self._cache.__dict__)

    async def load(self, db: AsyncSession) -> UpdateSettingsData:
        result = await db.execute(
            select(SystemSetting).where(SystemSetting.key.in_(list(KEY_MAP.values())))
        )
        data = UpdateSettingsData()
        for row in result.scalars().all():
            field = REVERSE_MAP.get(row.key)
            if field and hasattr(data, field):
                setattr(data, field, row.value)
        if settings.github_update_repo:
            data.github_repo = settings.github_update_repo
        self._cache = data
        return data

    async def seed_defaults(self, db: AsyncSession) -> None:
        for field, key in KEY_MAP.items():
            value = getattr(DEFAULTS, field)
            if value is None:
                continue
            existing = await db.scalar(select(SystemSetting).where(SystemSetting.key == key))
            if not existing:
                db.add(SystemSetting(key=key, value=value, description=f"Update setting: {field}"))
        await db.commit()
        await self.load(db)

    async def update(self, db: AsyncSession, partial: dict[str, Any]) -> UpdateSettingsData:
        patch = dict(partial)
        if "github_repo" in patch and patch["github_repo"] is not None:
            patch["github_repo"] = validate_github_repo(str(patch["github_repo"]))

        for field, value in patch.items():
            if value is None or field not in KEY_MAP:
                continue
            key = KEY_MAP[field]
            row = await db.scalar(select(SystemSetting).where(SystemSetting.key == key))
            if row:
                row.value = value
            else:
                db.add(SystemSetting(key=key, value=value, description=f"Update setting: {field}"))
        await db.commit()
        return await self.load(db)

    @staticmethod
    def now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()


update_settings_service = UpdateSettingsService()
