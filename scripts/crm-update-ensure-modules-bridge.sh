#!/usr/bin/env bash
# Ensure modules-bridge image exists and container is running (CRM auto-update / health / repair).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
source "$ROOT/scripts/crm-update-compose-env.sh"

if ! docker compose $COMPOSE_FILES config --services 2>/dev/null | grep -qx 'modules-bridge'; then
  echo "[crm-update-ensure-modules-bridge] Service modules-bridge is missing from compose config" >&2
  exit 1
fi

echo "[crm-update-ensure-modules-bridge] WASH_HOST_PROJECT_ROOT=${WASH_HOST_PROJECT_ROOT:-?} WASH_BUILD_ROOT=${WASH_BUILD_ROOT:-?}" >&2
echo "[crm-update-ensure-modules-bridge] Building modules-bridge (if needed)…"
if ! docker compose $COMPOSE_FILES build modules-bridge; then
  echo "[crm-update-ensure-modules-bridge] Build failed" >&2
  exit 1
fi

echo "[crm-update-ensure-modules-bridge] Starting / recreating modules-bridge…"
if ! docker compose $COMPOSE_FILES up -d --build --force-recreate --no-deps modules-bridge; then
  echo "[crm-update-ensure-modules-bridge] up failed" >&2
  docker compose $COMPOSE_FILES ps modules-bridge 2>&1 || true
  docker compose $COMPOSE_FILES logs --tail 30 modules-bridge 2>&1 || true
  exit 1
fi

echo "[crm-update-ensure-modules-bridge] Done."
