#!/usr/bin/env bash
# Обновить vendored dynamic-api/ из Dynamic API Platform и применить патчи WASH-PHO-CRM.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DA="$ROOT/dynamic-api"
UPSTREAM_REPO="${DYNAMIC_API_UPSTREAM:-https://github.com/Dynamic-API-Platform/Dynamic-API-Platform.git}"
BASE_REF="${DYNAMIC_API_REF:-origin/cursor/db-explorer-reference-fields-and-auth-fixes}"
THEME_REF="${DYNAMIC_API_THEME_REF:-origin/cursor/fix-light-theme-and-auth-proxy}"

echo "==> Fetch upstream: $UPSTREAM_REPO"
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

git -C "$tmpdir" init -q
git -C "$tmpdir" remote add origin "$UPSTREAM_REPO"
git -C "$tmpdir" fetch -q origin "${BASE_REF#origin/}" "${THEME_REF#origin/}" --depth 1

echo "==> Replace $DA from base: $BASE_REF"
rm -rf "$DA"
mkdir -p "$DA"
git -C "$tmpdir" archive FETCH_HEAD | tar -x -C "$DA" 2>/dev/null || {
  git -C "$tmpdir" fetch -q origin "${BASE_REF#origin/}" --depth 1
  git -C "$tmpdir" archive FETCH_HEAD | tar -x -C "$DA"
}

echo "==> Apply WASH-PHO-CRM patches"
perl -i -0pe 's/app\.use\(cors\(\{\n    origin: env\.corsOrigin,/const corsOrigins = env.corsOrigin.split(\x27,\x27).map((o) => o.trim()).filter(Boolean);\n\n  app.use(cors({\n    origin: corsOrigins.length > 1 ? corsOrigins : corsOrigins[0] || true,/s' \
  "$DA/backend/src/app.ts" 2>/dev/null || true

if grep -q 'Request failed (\${response.status})' "$DA/frontend/src/services/api.ts" 2>/dev/null; then
  perl -i -0pe 's/throw new Error\(`Request failed \(\$\{response\.status\}\)`\);/const hint = response.status === 502\n          ? \x27API unavailable (502). Restart dynamic-api-panel or check dynamic-api.\x27\n          : `Request failed (\${response.status})`;\n        throw new Error(hint);/s' \
    "$DA/frontend/src/services/api.ts" || true
fi

if grep -q 'type="email"' "$DA/frontend/src/pages/UsersPage.tsx" 2>/dev/null; then
  perl -i -pe 's/<form onSubmit=\{handleSubmit\} className="space-y-4">/<form onSubmit={handleSubmit} className="space-y-4" noValidate>/' \
    "$DA/frontend/src/pages/UsersPage.tsx"
  perl -i -0pe 's/<input type="email" className="input" value=\{form\.email\} onChange=\{\(e\) => setForm\(\{ \.\.\.form, email: e\.target\.value \}\)\} required \/>/<input\n                type="text"\n                inputMode="email"\n                autoComplete="email"\n                className="input"\n                value={form.email}\n                onChange={(e) => setForm({ ...form, email: e.target.value })}\n                required\n              \/>/s' \
    "$DA/frontend/src/pages/UsersPage.tsx" || true
fi

echo "==> Apply light theme overlay: $THEME_REF"
theme_tmp="$(mktemp -d)"
git -C "$tmpdir" fetch -q origin "${THEME_REF#origin/}" --depth 1
git -C "$tmpdir" archive FETCH_HEAD \
  frontend/src/index.css \
  frontend/src/components/UI.tsx \
  frontend/src/pages/LoginPage.tsx \
  frontend/src/pages/EndpointsPage.tsx \
  frontend/src/pages/LogsPage.tsx \
  frontend/src/pages/SettingsPage.tsx \
  frontend/tailwind.config.js \
  | tar -x -C "$theme_tmp"
cp "$theme_tmp"/frontend/src/index.css "$DA/frontend/src/index.css"
cp "$theme_tmp"/frontend/src/components/UI.tsx "$DA/frontend/src/components/UI.tsx"
cp "$theme_tmp"/frontend/src/pages/LoginPage.tsx "$DA/frontend/src/pages/LoginPage.tsx"
cp "$theme_tmp"/frontend/src/pages/EndpointsPage.tsx "$DA/frontend/src/pages/EndpointsPage.tsx"
cp "$theme_tmp"/frontend/src/pages/LogsPage.tsx "$DA/frontend/src/pages/LogsPage.tsx"
cp "$theme_tmp"/frontend/src/pages/SettingsPage.tsx "$DA/frontend/src/pages/SettingsPage.tsx"
cp "$theme_tmp"/frontend/tailwind.config.js "$DA/frontend/tailwind.config.js"
rm -rf "$theme_tmp"

echo "==> Note: Layout.tsx and DashboardPage.tsx need manual merge (Database nav + auth guards)."
echo "    See git history for WASH-PHO-CRM merged versions."
echo "==> Done. Rebuild: docker compose up -d --build dynamic-api dynamic-api-panel"
