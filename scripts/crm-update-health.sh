#!/usr/bin/env bash
# CRM auto-update: health checks after build/seed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

set -a
# shellcheck disable=SC1091
[ -f .env ] && source .env
set +a
# shellcheck disable=SC1091
source "$ROOT/scripts/compose-files.sh"

wget -qO- http://dynamic-api:3001/api/health >/dev/null
wget -qO- http://message-processor:3022/health >/dev/null

if docker compose $COMPOSE_FILES config --services 2>/dev/null | grep -qx 'modules-bridge'; then
  echo "[crm-update-health] Ensuring modules-bridge before health check…" >&2
  bash "$ROOT/scripts/crm-update-ensure-modules-bridge.sh" || true
fi

for attempt in 1 2 3 4 5 6 7 8; do
  if wget -qO- http://modules-bridge:3024/health >/dev/null 2>&1; then
    echo "[crm-update-health] modules-bridge OK" >&2
    exit 0
  fi
  echo "[crm-update-health] modules-bridge not ready (attempt ${attempt}/8), waiting…" >&2
  sleep 5
done

echo "[crm-update-health] modules-bridge health check failed — retrying ensure…" >&2
bash "$ROOT/scripts/crm-update-ensure-modules-bridge.sh" || true
sleep 8
if wget -qO- http://modules-bridge:3024/health >/dev/null 2>&1; then
  echo "[crm-update-health] modules-bridge OK after ensure retry" >&2
  exit 0
fi

echo "[crm-update-health] modules-bridge health check failed" >&2
exit 1
