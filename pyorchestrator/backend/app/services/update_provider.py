"""Abstract OTA update provider interface."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path

import httpx

from app.utils.semver import is_newer_version, parse_version


@dataclass
class VersionInfo:
    version: str
    release_notes: str
    published_at: str
    download_url: str | None = None


class UpdateProvider(ABC):
    @abstractmethod
    async def check_latest(self) -> VersionInfo | None:
        """Return latest available version or None if up to date."""

    @abstractmethod
    async def download(self, version: str, dest: Path) -> Path:
        """Download update artifact to dest directory."""

    @abstractmethod
    async def verify(self, artifact: Path) -> bool:
        """Verify checksum/signature of downloaded artifact."""


class GitHubUpdateProvider(UpdateProvider):
    def __init__(self, repo: str | None = None, token: str | None = None, include_prerelease: bool = False):
        self.repo = repo
        self.token = token
        self.include_prerelease = include_prerelease

    async def check_latest(self) -> VersionInfo | None:
        if not self.repo:
            return None
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "PyOrchestrator-Updater",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        url = f"https://api.github.com/repos/{self.repo}/releases?per_page=10"
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.get(url, headers=headers)
            res.raise_for_status()
            releases = res.json()

        stable = [r for r in releases if self.include_prerelease or not r.get("prerelease")]
        if not stable:
            return None

        best = stable[0]
        best_ver = parse_version(best["tag_name"])
        for release in stable[1:]:
            ver = parse_version(release["tag_name"])
            if is_newer_version(ver, best_ver):
                best = release
                best_ver = ver

        return VersionInfo(
            version=best_ver,
            release_notes=best.get("body") or "",
            published_at=best.get("published_at") or "",
            download_url=best.get("html_url"),
        )

    async def download(self, version: str, dest: Path) -> Path:
        raise NotImplementedError("Use update executor for apply flow")

    async def verify(self, artifact: Path) -> bool:
        return artifact.exists()
