#!/usr/bin/env bash
# Scan docs/ and README for known-bad link patterns; optionally HTTP-check GitHub Pages.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
errors=0

check_pattern() {
  local label="$1"
  local pattern="$2"
  local paths=("${@:3}")
  local hits
  hits="$(rg -n "$pattern" "${paths[@]}" 2>/dev/null || true)"
  if [[ -n "$hits" ]]; then
    echo "FAIL: $label"
    echo "$hits"
    errors=$((errors + 1))
  fi
}

check_pattern 'wiki nested paths in markdown link' \
  '\]\((en|ru)/[^)]+\)' \
  "$ROOT/README.md" "$ROOT/README.ru.md" "$ROOT/docs"

check_pattern 'docs link to unpublished data/ on Pages' \
  '\]\(\.\./data/' \
  "$ROOT/docs"

check_pattern 'wiki source path in markdown link' \
  '\]\(wiki/(en|ru)/' \
  "$ROOT/README.md" "$ROOT/README.ru.md" "$ROOT/docs"

check_pattern 'repo-relative dashboard path (breaks on GitHub Pages)' \
  '\]\(\.\./\.\./dashboard/' \
  "$ROOT/docs"

if [[ "${CHECK_HTTP:-0}" == "1" ]]; then
  BASE="https://wash-pro.github.io/WASH-PRO-CRM"
  for path in /en/ /ru/ /en/architecture/ /en/troubleshooting/; do
    code="$(curl -s -o /dev/null -w '%{http_code}' -L "$BASE$path")"
    if [[ "$code" != "200" ]]; then
      echo "FAIL: HTTP $code $BASE$path"
      errors=$((errors + 1))
    fi
  done
  for path in /wiki/en-Home /wiki/ru-Home; do
    code="$(curl -s -o /dev/null -w '%{http_code}' -L "https://github.com/WASH-PRO/WASH-PRO-CRM$path")"
    if [[ "$code" != "200" ]]; then
      echo "FAIL: HTTP $code GitHub Wiki $path"
      errors=$((errors + 1))
    fi
  done
fi

if [[ "$errors" -gt 0 ]]; then
  echo "$errors issue(s) found"
  exit 1
fi

echo "Docs/README link patterns OK."
