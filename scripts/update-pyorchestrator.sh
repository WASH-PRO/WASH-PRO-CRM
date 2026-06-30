#!/usr/bin/env bash
# Обновить vendored pyorchestrator/ из PyOrchestrator и применить патчи WASH-PRO-CRM.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PO="$ROOT/pyorchestrator"
UPSTREAM_REPO="${PYORCHESTRATOR_UPSTREAM:-https://github.com/PyOrchestrator/PyOrchestrator.git}"
UPSTREAM_REF="${PYORCHESTRATOR_REF:-v0.1.0}"

echo "==> Fetch upstream: $UPSTREAM_REPO ($UPSTREAM_REF)"
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

GIT_TEMPLATE_DIR=/dev/null git -C "$tmpdir" init -q
git -C "$tmpdir" remote add origin "$UPSTREAM_REPO"
git -C "$tmpdir" fetch -q origin "${UPSTREAM_REF#origin/}" --depth 1

echo "==> Replace $PO"
rm -rf "$PO"
mkdir -p "$PO"
git -C "$tmpdir" archive FETCH_HEAD | tar -x -C "$PO"

echo "==> Apply WASH-PRO-CRM patches"

# Embedded panel: same-origin API + WebSocket через nginx
CLIENT="$PO/frontend/src/api/client.ts"
if [ -f "$CLIENT" ] && ! grep -q 'VITE_WASH_EMBEDDED' "$CLIENT"; then
  perl -i -pe 's/^const API_URL = import\.meta\.env\.VITE_API_URL/const washEmbedded = import.meta.env.VITE_WASH_EMBEDDED === '\''true'\'';\nconst API_URL = washEmbedded ? '\'''\'' : import.meta.env.VITE_API_URL/' "$CLIENT"
  perl -i -pe 's/^const WS_URL = import\.meta\.env\.VITE_WS_URL/const WS_URL = washEmbedded\n  ? `\${window.location.protocol === '\''https:'\'' ? '\''wss:'\'' : '\''ws:'\''}\/\/\${window.location.host}\/ws`\n  : import.meta.env.VITE_WS_URL/' "$CLIENT"
  echo "==> Patched frontend API client for WASH embedded panel"
fi

if [ -f "$PO/frontend/src/vite-env.d.ts" ] && ! grep -q 'VITE_WASH_EMBEDDED' "$PO/frontend/src/vite-env.d.ts"; then
  perl -i -pe 's/(readonly VITE_WS_URL: string;)/$1\n  readonly VITE_WASH_EMBEDDED?: string;/' \
    "$PO/frontend/src/vite-env.d.ts"
fi

bash "$ROOT/patches/pyorchestrator-wash/apply-wash-patches.sh" "$PO"

PO_VERSION="$(grep -E '^APP_VERSION=' "$PO/.env.example" 2>/dev/null | cut -d= -f2 || echo '?')"
if [ -f "$ROOT/.env.example" ] && [ "$PO_VERSION" != '?' ]; then
  perl -i -pe "s/^PYORCHESTRATOR_VERSION=.*/PYORCHESTRATOR_VERSION=$PO_VERSION/" "$ROOT/.env.example"
fi

echo "==> PyOrchestrator v$PO_VERSION"
echo "==> Done. Rebuild: docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build pyorch-backend pyorchestrator-panel"
