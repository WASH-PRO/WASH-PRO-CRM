#!/usr/bin/env bash
# CRM auto-update: health checks after build/seed.
# Core CRM must be healthy; modules-bridge failure is a warning (update still succeeds).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
source "$ROOT/scripts/crm-update-compose-env.sh"

echo "[crm-update-health] WASH_HOST_PROJECT_ROOT=${WASH_HOST_PROJECT_ROOT:-?} WASH_BUILD_ROOT=${WASH_BUILD_ROOT:-?}" >&2

wget -qO- http://dynamic-api:3001/api/health >/dev/null
wget -qO- http://message-processor:3022/health >/dev/null

modules_ok=0
if docker compose $COMPOSE_FILES config --services 2>/dev/null | grep -qx 'modules-bridge'; then
  echo "[crm-update-health] Ensuring modules-bridge before health check…" >&2
  bash "$ROOT/scripts/crm-update-ensure-modules-bridge.sh" || true

  for attempt in 1 2 3 4 5 6; do
    if wget -qO- http://modules-bridge:3024/health >/dev/null 2>&1; then
      echo "[crm-update-health] modules-bridge OK" >&2
      modules_ok=1
      break
    fi
    echo "[crm-update-health] modules-bridge not ready (attempt ${attempt}/6), waiting…" >&2
    sleep 5
  done

  if [ "$modules_ok" -ne 1 ]; then
    bash "$ROOT/scripts/crm-update-ensure-modules-bridge.sh" || true
    sleep 8
    if wget -qO- http://modules-bridge:3024/health >/dev/null 2>&1; then
      modules_ok=1
      echo "[crm-update-health] modules-bridge OK after retry" >&2
    fi
  fi
else
  modules_ok=1
fi

if [ "$modules_ok" -eq 1 ]; then
  echo "[crm-update-health] All checks passed" >&2
  exit 0
fi

echo "[crm-update-health] MODULES_BRIDGE_WARN: modules-bridge unavailable after update" >&2
docker compose $COMPOSE_FILES ps modules-bridge 2>&1 || true
docker compose $COMPOSE_FILES logs --tail 40 modules-bridge 2>&1 || true
echo "[crm-update-health] Core CRM is healthy; update completed with modules-bridge warning" >&2
echo "[crm-update-health] Repair: Settings → Integrity and repair → Rebuild modules-bridge + dashboard" >&2
exit 0
