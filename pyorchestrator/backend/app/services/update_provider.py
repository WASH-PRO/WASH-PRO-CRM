"""Abstract OTA update provider interface."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path


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
    """Placeholder until GITHUB_UPDATE_REPO is configured."""

    def __init__(self, repo: str | None = None, token: str | None = None):
        self.repo = repo
        self.token = token

    async def check_latest(self) -> VersionInfo | None:
        if not self.repo:
            return None
        raise NotImplementedError("GitHub OTA provider — configure repo URL in Production-2")

    async def download(self, version: str, dest: Path) -> Path:
        raise NotImplementedError

    async def verify(self, artifact: Path) -> bool:
        raise NotImplementedError
