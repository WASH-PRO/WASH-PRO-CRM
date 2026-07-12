#!/usr/bin/env bash
# Патч VK публикатора на сервере: SECRET_ env + перерегистрация в PyOrchestrator.
# Запуск на хосте CRM (где docker compose):
#   bash scripts/patch-vk-publisher-on-server.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
source "$ROOT/scripts/crm-update-compose-env.sh"

MODULE_MAIN="$ROOT/modules/installed/vk-publisher/src/main.py"
BOOTSTRAP='# --- WASH module env bootstrap ---'
PATCHED=0

if [ -f "$MODULE_MAIN" ] && ! grep -q "$BOOTSTRAP" "$MODULE_MAIN"; then
  python3 - "$MODULE_MAIN" <<'PY'
import re, sys
path = sys.argv[1]
code = open(path, encoding="utf-8").read()
bootstrap = '''
# --- WASH module env bootstrap ---
import os as _wash_os
for _wash_k, _wash_v in list(_wash_os.environ.items()):
    if _wash_k.startswith("SECRET_") and _wash_k[7:] not in _wash_os.environ:
        _wash_os.environ[_wash_k[7:]] = _wash_v
# --- end bootstrap ---
'''
code = re.sub(r'# --- WASH module env bootstrap ---.*?# --- end bootstrap ---\n', '', code, flags=re.S)
marker = "from __future__ import annotations\n"
if marker in code:
    code = code.replace(marker, marker + bootstrap + "\n", 1)
else:
    code = bootstrap + "\n" + code
open(path, "w", encoding="utf-8").write(code)
PY
  echo "[patch-vk] Patched $MODULE_MAIN with SECRET_ env bootstrap"
  PATCHED=1
else
  echo "[patch-vk] main.py already patched or missing: $MODULE_MAIN"
fi

echo "[patch-vk] Rebuilding modules-bridge (if compose includes fix)…"
bash "$ROOT/scripts/crm-update-ensure-modules-bridge.sh" || true

echo "[patch-vk] Restarting pyorch-runtime…"
docker compose $COMPOSE_FILES up -d pyorch-runtime pyorch-backend pyorch-scheduler 2>/dev/null || true

API_URL="${API_URL:-http://127.0.0.1}"
LOGIN="${SERVICE_LOGIN:-service}"
PASSWORD="${SERVICE_PASSWORD:-ServiceInternal123!}"

echo "[patch-vk] Updating vk-publisher module via API ($API_URL)…"
TOKEN="$(curl -sf -X POST "$API_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"login\":\"$LOGIN\",\"password\":\"$PASSWORD\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")"

curl -sf -X POST "$API_URL/api/crm/modules/installed/vk-publisher/stop" \
  -H "Authorization: Bearer $TOKEN" >/dev/null || true

curl -sf -X POST "$API_URL/api/crm/modules/installed/vk-publisher/update" \
  -H "Authorization: Bearer $TOKEN" >/dev/null

curl -sf -X POST "$API_URL/api/crm/modules/installed/vk-publisher/start" \
  -H "Authorization: Bearer $TOKEN" >/dev/null

echo "[patch-vk] Done. Check status:"
curl -sf "$API_URL/api/crm/modules/installed/vk-publisher/status" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print('run:', d.get('activeRunStatus')); print('configured:', (d.get('snapshot') or {}).get('configured')); print('snapshot:', d.get('snapshot'))"
