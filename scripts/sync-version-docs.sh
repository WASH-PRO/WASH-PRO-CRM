#!/usr/bin/env bash
# Write docs/_data/version.yml and .env.example APP_VERSION from dashboard/package.json.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$("$ROOT/scripts/app-version.sh")"

mkdir -p "$ROOT/docs/_data"
cat > "$ROOT/docs/_data/version.yml" <<EOF
# Synced from dashboard/package.json — run: ./scripts/sync-version-docs.sh
current: "$VERSION"
EOF

if [[ "$(uname)" == "Darwin" ]]; then
  sed -i '' "s/^APP_VERSION=.*/APP_VERSION=$VERSION/" "$ROOT/.env.example"
else
  sed -i "s/^APP_VERSION=.*/APP_VERSION=$VERSION/" "$ROOT/.env.example"
fi

echo "Synced docs version to $VERSION"
