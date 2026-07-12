#!/usr/bin/env bash
# Публикует тестовые модули в GitHub (WASH-PRO).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPOS_ROOT="$ROOT/local/module-repos"

publish_repo() {
  local name="$1"
  local dir="$REPOS_ROOT/$name"
  if [ ! -d "$dir" ]; then
    echo "Missing $dir" >&2
    exit 1
  fi
  echo "==> $name"
  cd "$dir"
  if [ ! -d .git ]; then
    git init -b main
    git add .
    git commit -m "Initial release v1.0.0"
  fi
  if gh repo view "WASH-PRO/$name" >/dev/null 2>&1; then
    git remote remove origin 2>/dev/null || true
    git remote add origin "https://github.com/WASH-PRO/$name.git"
    git push -u origin main
  else
    gh repo create "WASH-PRO/$name" --public --source=. --remote=origin --push \
      --description "WASH PRO CRM module: $name"
  fi
}

publish_repo wash-module-post-occupancy
publish_repo wash-module-usage-stats
publish_repo wash-module-starter
publish_repo wash-module-vk-publisher
publish_repo wash-module-dynamic-pricing

echo "Done."
