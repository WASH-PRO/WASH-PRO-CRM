#!/usr/bin/env bash
# Обновить vendored dynamic-api/ из Dynamic API Platform и применить патчи WASH-PRO-CRM.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DA="$ROOT/dynamic-api"
UPSTREAM_REPO="${DYNAMIC_API_UPSTREAM:-https://github.com/Dynamic-API-Platform/Dynamic-API-Platform.git}"
UPSTREAM_REF="${DYNAMIC_API_REF:-origin/main}"

replace_tree() {
  local target="$1"
  if [ -d "$target" ]; then
    chmod -R u+w "$target" 2>/dev/null || true
    find "$target" -mindepth 1 -delete 2>/dev/null || rm -rf "${target:?}/"*
    rmdir "$target" 2>/dev/null || rm -rf "$target"
  fi
  mkdir -p "$target"
}

echo "==> Fetch upstream: $UPSTREAM_REPO ($UPSTREAM_REF)"
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

# Без шаблонов hooks — иначе падает в sandbox (Operation not permitted на .git/hooks)
GIT_TEMPLATE_DIR=/dev/null git -C "$tmpdir" init -q
git -C "$tmpdir" remote add origin "$UPSTREAM_REPO"
git -C "$tmpdir" fetch -q origin "${UPSTREAM_REF#origin/}" --depth 1

echo "==> Replace $DA"
replace_tree "$DA"
git -C "$tmpdir" archive FETCH_HEAD | tar -x -C "$DA"

echo "==> Apply WASH-PRO-CRM patches (see patches/dynamic-api-wash.patch)"
perl -i -0pe 's/app\.use\(cors\(\{\n    origin: env\.corsOrigin,/const corsOrigins = env.corsOrigin.split(\x27,\x27).map((o) => o.trim()).filter(Boolean);\n\n  app.use(cors({\n    origin: corsOrigins.length > 1 ? corsOrigins : corsOrigins[0] || true,/s' \
  "$DA/backend/src/app.ts" 2>/dev/null || true

if grep -q 'Invalid response' "$DA/frontend/src/services/api.ts" 2>/dev/null; then
  perl -i -0pe 's/throw new Error\(`Request failed \(\$\{response\.status\}\)`\);/const hint = response.status === 502\n          ? \x27API unavailable (502). Restart dynamic-api-panel or check dynamic-api.\x27\n          : `Request failed (\${response.status})`;\n        throw new Error(hint);/s' \
    "$DA/frontend/src/services/api.ts" || true
  perl -i -pe "s/throw new Error\('Invalid response'\);/throw new Error('Invalid API response (expected JSON)');/" \
    "$DA/frontend/src/services/api.ts" || true
fi

if grep -q 'type="email"' "$DA/frontend/src/pages/UsersPage.tsx" 2>/dev/null; then
  perl -i -pe 's/<form onSubmit=\{handleSubmit\} className="space-y-4">/<form onSubmit={handleSubmit} className="space-y-4" noValidate>/' \
    "$DA/frontend/src/pages/UsersPage.tsx"
  perl -i -0pe 's/<input type="email" className="input" value=\{form\.email\} onChange=\{\(e\) => setForm\(\{ \.\.\.form, email: e\.target\.value \}\)\} required \/>/<input\n                type="text"\n                inputMode="email"\n                autoComplete="email"\n                className="input"\n                value={form.email}\n                onChange={(e) => setForm({ ...form, email: e.target.value })}\n                required\n              \/>/s' \
    "$DA/frontend/src/pages/UsersPage.tsx" || true
fi

echo "==> Apply WASH embedded panel UI"
bash "$ROOT/patches/wash-embedded/apply-wash-embedded-ui.sh" "$DA"

# Upstream Dockerfile задаёт устаревший ENV APP_VERSION — мешает отображению реальной версии из package.json
if grep -q '^ENV APP_VERSION=' "$DA/backend/Dockerfile" 2>/dev/null; then
  perl -i -pe 's/^ENV APP_VERSION=.*\n//;' "$DA/backend/Dockerfile"
  echo "==> Removed stale ENV APP_VERSION from backend/Dockerfile"
fi

DA_VERSION="$(node -p "require('$DA/backend/package.json').version" 2>/dev/null || echo '?')"
if [ -f "$ROOT/.env.example" ] && [ "$DA_VERSION" != '?' ]; then
  perl -i -pe "s/^DYNAMIC_API_VERSION=.*/DYNAMIC_API_VERSION=$DA_VERSION/" "$ROOT/.env.example"
fi
if [ -f "$ROOT/.env" ] && [ "$DA_VERSION" != '?' ]; then
  if grep -q '^DYNAMIC_API_VERSION=' "$ROOT/.env"; then
    perl -i -pe "s/^DYNAMIC_API_VERSION=.*/DYNAMIC_API_VERSION=$DA_VERSION/" "$ROOT/.env"
  else
    echo "DYNAMIC_API_VERSION=$DA_VERSION" >> "$ROOT/.env"
  fi
fi

echo "==> Dynamic API Platform v$DA_VERSION"
echo "==> Done. Rebuild: docker compose up -d --build dynamic-api dynamic-api-panel"
echo "    Then if needed: ./scripts/run-init-seed.sh"
