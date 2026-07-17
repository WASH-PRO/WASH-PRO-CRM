#!/usr/bin/env bash
# CRM auto-update: build and restart stack (used by update-bridge executor).
# Also invoked from compose-files.sh for older update-bridge images (v1.1.31 and below).
set -euo pipefail
export WASH_CRM_UPDATE_BUILD_RUNNING=1

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
source "$ROOT/scripts/crm-update-compose-env.sh"

echo "[crm-update-build] WASH_HOST_PROJECT_ROOT=${WASH_HOST_PROJECT_ROOT:-?} WASH_BUILD_ROOT=${WASH_BUILD_ROOT:-?}" >&2

echo "[crm-update-build] Building init-seed and dashboard…"
docker compose $COMPOSE_FILES build init-seed dashboard

echo "[crm-update-build] Building modules-bridge (best effort)…"
if ! docker compose $COMPOSE_FILES build modules-bridge; then
  echo "[crm-update-build] WARN: modules-bridge build failed — continuing with dashboard" >&2
fi

echo "[crm-update-build] Restarting core CRM services…"
docker compose $COMPOSE_FILES up -d --build --force-recreate --no-deps \
  dynamic-api dynamic-api-panel dashboard message-processor backup

echo "[crm-update-build] Starting modules-bridge (best effort)…"
if ! docker compose $COMPOSE_FILES up -d --build --force-recreate --no-deps modules-bridge; then
  echo "[crm-update-build] WARN: modules-bridge up failed — running ensure" >&2
  bash "$ROOT/scripts/crm-update-ensure-modules-bridge.sh" || \
    echo "[crm-update-build] WARN: modules-bridge ensure failed — repair from Settings after update" >&2
else
  bash "$ROOT/scripts/crm-update-ensure-modules-bridge.sh" || \
    echo "[crm-update-build] WARN: modules-bridge ensure check failed" >&2
fi

if [ "${PYORCHESTRATOR_ENABLED:-false}" = "true" ]; then
  if docker compose $COMPOSE_FILES config --services 2>/dev/null | grep -qx 'pyorch-backend'; then
    echo "[crm-update-build] Building pyorch-backend + pyorch-runtime + pyorch-bridge…"
    if docker compose $COMPOSE_FILES build pyorch-backend pyorch-runtime pyorch-bridge; then
      docker compose $COMPOSE_FILES up -d --no-deps --force-recreate \
        pyorch-backend pyorch-runtime pyorch-bridge || \
        echo "[crm-update-build] WARN: pyorch services up failed" >&2
    else
      echo "[crm-update-build] WARN: pyorch build failed" >&2
    fi
  fi
fi

echo "[crm-update-build] Done."
