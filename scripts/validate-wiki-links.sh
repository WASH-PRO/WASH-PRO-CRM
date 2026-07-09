#!/usr/bin/env bash
# Validate wiki links for flat GitHub Wiki slugs (en-Page / ru-Page).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WIKI="$ROOT/wiki"
errors=0

pages=()
while IFS= read -r -d '' f; do
  rel="${f#"$WIKI"/}"
  lang="$(basename "$(dirname "$f")")"
  base="$(basename "$f" .md)"
  pages+=("${lang}-${base}")
done < <(find "$WIKI/en" "$WIKI/ru" -name '*.md' -print0)
pages+=("Home")

has_page() {
  local target="$1"
  local p
  for p in "${pages[@]}"; do
    [[ "$p" == "$target" ]] && return 0
  done
  return 1
}

resolve_link() {
  local from="$1"
  local href="$2"

  if [[ "$href" == http* || "$href" == mailto:* ]]; then
    return 0
  fi
  if [[ "$href" == ../* ]]; then
    return 0
  fi
  if [[ "$href" == Home ]]; then
    return 0
  fi
  if has_page "$href"; then
    return 0
  fi
  echo "BROKEN: $from -> $href"
  return 1
}

while IFS= read -r -d '' file; do
  rel="${file#"$WIKI"/}"
  while read -r href; do
    [[ -z "$href" ]] && continue
    resolve_link "$rel" "$href" || errors=$((errors + 1))
  done < <(grep -oE '\]\([^)]+\)' "$file" | sed 's/](//;s/)$//' | grep -v '^https\?://' || true)
done < <(find "$WIKI/en" "$WIKI/ru" "$WIKI/README.md" -name '*.md' -print0 2>/dev/null || find "$WIKI/en" "$WIKI/ru" -name '*.md' -print0)

if [[ "$errors" -gt 0 ]]; then
  echo "$errors broken link(s)"
  exit 1
fi

echo "All wiki internal links OK (${#pages[@]} pages)."
