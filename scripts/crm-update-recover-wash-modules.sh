#!/usr/bin/env bash
# После обновления CRM / перезапуска PyOrch: восстановить runtime и перерегистрировать wash-модули.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
source "$ROOT/scripts/crm-update-compose-env.sh"

if [ "${PYORCHESTRATOR_ENABLED:-false}" != "true" ]; then
  echo "[crm-update-recover-wash-modules] PyOrchestrator disabled — skip"
  exit 0
fi

echo "[crm-update-recover-wash-modules] Restarting PyOrchestrator stack…"
bash "$ROOT/scripts/fix-pyorch.sh"

echo "[crm-update-recover-wash-modules] Ensuring modules-bridge…"
bash "$ROOT/scripts/crm-update-ensure-modules-bridge.sh"

echo "[crm-update-recover-wash-modules] Reconciling orphan module directories…"
bash "$ROOT/scripts/crm-update-reconcile-orphan-modules.sh" || true

LOGIN="${SERVICE_LOGIN:-service}"
PASSWORD="${SERVICE_PASSWORD:-ServiceInternal123!}"
AUTH_URL="${CRM_AUTH_URL:-http://dynamic-api:3001/api/auth/login}"
MODULES_URL="${MODULES_BRIDGE_URL:-http://modules-bridge:3024/recover-all}"

echo "[crm-update-recover-wash-modules] Waiting for modules-bridge…"
for attempt in 1 2 3 4 5 6 8 10; do
  if wget -qO- http://modules-bridge:3024/health >/dev/null 2>&1; then
    break
  fi
  sleep 3
done

TOKEN="$(wget -qO- --header='Content-Type: application/json' \
  --post-data="{\"login\":\"$LOGIN\",\"password\":\"$PASSWORD\"}" \
  "$AUTH_URL" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")"

echo "[crm-update-recover-wash-modules] Recovering installed modules (reregister + restart)…"
wget -qO- --header="Authorization: Bearer $TOKEN" \
  --header='Content-Type: application/json' \
  --post-data='{}' \
  "$MODULES_URL" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok:', d.get('success'), 'modules:', d.get('data'))"

echo "[crm-update-recover-wash-modules] Done."
