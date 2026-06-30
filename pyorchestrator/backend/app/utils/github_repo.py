import re

_GITHUB_REPO_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")


def validate_github_repo(repo: str) -> str:
    value = repo.strip()
    if not _GITHUB_REPO_RE.fullmatch(value):
        raise ValueError("GitHub repo must be in owner/repo format")
    return value
