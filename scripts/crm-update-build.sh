#!/usr/bin/env bash
# CRM auto-update: build and restart stack (used by update-bridge executor).
# Also invoked from compose-files.sh for older update-bridge images (v1.1.31 and below).
set -euo pipefail
export WASH_CRM_UPDATE_BUILD_RUNNING=1

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -z "${COMPOSE_FILES:-}" ]; then
  set -a
  # shellcheck disable=SC1091
  [ -f .env ] && source .env
  set +a
  # shellcheck disable=SC1091
  source "$ROOT/scripts/compose-files.sh"
fi

echo "[crm-update-build] Building init-seed, modules-bridge, dashboard…"
docker compose $COMPOSE_FILES build init-seed modules-bridge dashboard

echo "[crm-update-build] Restarting CRM services (incl. modules-bridge)…"
docker compose $COMPOSE_FILES up -d --build --force-recreate --no-deps \
  dynamic-api dynamic-api-panel dashboard modules-bridge message-processor backup

echo "[crm-update-build] Ensuring modules-bridge is up…"
bash "$ROOT/scripts/crm-update-ensure-modules-bridge.sh"

echo "[crm-update-build] Done."
