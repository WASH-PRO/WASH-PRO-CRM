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
  sed -i '' "s|version-1\.1\.[0-9]*-0d9488|version-${VERSION}-0d9488|g" "$ROOT/README.md" "$ROOT/README.ru.md"
  sed -i '' "s|\`1\.1\.[0-9]*\` |\\\`${VERSION}\\\` |" "$ROOT/docs/en/configuration.md" "$ROOT/docs/ru/configuration.md"
  sed -i '' "s|checkout v1\.1\.[0-9]*|checkout v${VERSION}|g" "$ROOT/docs/en/troubleshooting.md" "$ROOT/docs/ru/troubleshooting.md"
  for f in "$ROOT/wiki/en/Home.md" "$ROOT/wiki/ru/Home.md"; do
    perl -pi -e 's/\*\*WASH PRO version:\*\* \*\*v?1\.1\.\d+\*\*/**WASH PRO version:** **'"${VERSION}"'**/g' "$f"
  done
  perl -pi -e 's/\*\*Current version:\*\* v1\.1\.\d+/**Current version:** v'"${VERSION}"'/g' "$ROOT/wiki/README.md"
else
  sed -i "s/^APP_VERSION=.*/APP_VERSION=$VERSION/" "$ROOT/.env.example"
  sed -i "s|version-1\.1\.[0-9]*-0d9488|version-${VERSION}-0d9488|g" "$ROOT/README.md" "$ROOT/README.ru.md"
  sed -i "s|\`1\.1\.[0-9]*\` |\`${VERSION}\` |" "$ROOT/docs/en/configuration.md" "$ROOT/docs/ru/configuration.md"
  sed -i "s|checkout v1\.1\.[0-9]*|checkout v${VERSION}|g" "$ROOT/docs/en/troubleshooting.md" "$ROOT/docs/ru/troubleshooting.md"
  for f in "$ROOT/wiki/en/Home.md" "$ROOT/wiki/ru/Home.md"; do
    perl -pi -e 's/\*\*WASH PRO version:\*\* \*\*v?1\.1\.\d+\*\*/**WASH PRO version:** **'"${VERSION}"'**/g' "$f"
  done
  perl -pi -e 's/\*\*Current version:\*\* v1\.1\.\d+/**Current version:** v'"${VERSION}"'/g' "$ROOT/wiki/README.md"
fi

echo "Synced docs version to $VERSION"
