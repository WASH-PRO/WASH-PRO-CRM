#!/usr/bin/env bash
# Validate wiki internal links against existing pages (en/ + ru/).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WIKI="$ROOT/wiki"
errors=0

pages=()
while IFS= read -r -d '' f; do
  rel="${f#"$WIKI"/}"
  page="${rel%.md}"
  pages+=("$page")
done < <(find "$WIKI/en" "$WIKI/ru" -name '*.md' -print0)

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
  local from_dir from_base

  if [[ "$href" == http* || "$href" == mailto:* ]]; then
    return 0
  fi
  if [[ "$href" == /* ]]; then
    return 0
  fi

  from_dir="$(dirname "$from")"
  if [[ "$from_dir" == "." ]]; then from_dir=""; fi

  if [[ "$href" == ../* ]]; then
    local rest="${href#../}"
    if [[ "$rest" == Home ]]; then
      return 0
    fi
    if has_page "$rest"; then
      return 0
    fi
    echo "BROKEN: $from -> $href (resolved ../$rest)"
    return 1
  fi

  if [[ "$href" == */* ]]; then
    if has_page "$href"; then
      return 0
    fi
    echo "BROKEN: $from -> $href (missing page)"
    return 1
  fi

  from_base="${from_dir}/${href}"
  from_base="${from_base#./}"
  if has_page "$from_base"; then
    return 0
  fi
  echo "BROKEN: $from -> $href (expected $from_base)"
  return 1
}

while IFS= read -r -d '' file; do
  rel="${file#"$WIKI"/}"
  while read -r href; do
    [[ -z "$href" ]] && continue
    resolve_link "$rel" "$href" || errors=$((errors + 1))
  done < <(grep -oE '\]\([^)]+\)' "$file" | sed 's/](//;s/)$//' | grep -v '^https\?://' || true)
done < <(find "$WIKI/en" "$WIKI/ru" -name '*.md' -print0)

if [[ "$errors" -gt 0 ]]; then
  echo "$errors broken link(s)"
  exit 1
fi

echo "All wiki internal links OK (${#pages[@]} pages)."
