import re


def parse_version(tag: str) -> str:
    return re.sub(r"^v", "", tag.strip(), flags=re.IGNORECASE)


def _parts(version: str) -> list[int]:
    parts: list[int] = []
    for chunk in re.split(r"[.\-+]", version):
        if chunk.isdigit():
            parts.append(int(chunk))
        elif chunk:
            parts.append(0)
    return parts or [0]


def is_newer_version(candidate: str, current: str) -> bool:
    a = _parts(parse_version(candidate))
    b = _parts(parse_version(current))
    length = max(len(a), len(b))
    a.extend([0] * (length - len(a)))
    b.extend([0] * (length - len(b)))
    return a > b
