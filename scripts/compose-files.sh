#!/usr/bin/env bash
# Shared docker compose file list (source after .env). Used by start.sh and update-bridge executor.
COMPOSE_FILES="-f docker-compose.yml"
if [ -f docker-compose.override.yml ]; then
  COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.override.yml"
fi
if [ "${REDIS_ENABLED:-false}" = "true" ]; then
  COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.redis.yml"
fi
if [ "${MQTT_BIND:-}" = "127.0.0.1" ]; then
  export MQTT_PORT_PUBLISH="127.0.0.1:${MQTT_EXTERNAL_PORT:-1883}:1883"
else
  export MQTT_PORT_PUBLISH="${MQTT_EXTERNAL_PORT:-1883}:1883"
fi
if [ "${PYORCHESTRATOR_ENABLED:-false}" = "true" ]; then
  COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.pyorchestrator.yml"
  if [ "${PYORCH_OBSERVABILITY_ENABLED:-false}" = "true" ]; then
    export COMPOSE_PROFILES=pyorch-observability
    export PYORCH_GRAFANA_PUBLIC_URL="${PYORCH_GRAFANA_PUBLIC_URL:-http://localhost:${PYORCH_GRAFANA_PORT:-3000}}"
    export PYORCH_GRAFANA_INTERNAL_URL="${PYORCH_GRAFANA_INTERNAL_URL:-http://pyorch-grafana:3000}"
  fi
fi
export COMPOSE_FILES

if [ -n "${DEPLOY_ROOT:-}" ] && [ -d "${DEPLOY_ROOT}/scripts" ]; then
  SCRIPT_DIR="${DEPLOY_ROOT}/scripts"
else
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi
chmod +x "$SCRIPT_DIR/crm-update-build.sh" 2>/dev/null || true
chmod +x "$SCRIPT_DIR/crm-update-ensure-modules-bridge.sh" 2>/dev/null || true
chmod +x "$SCRIPT_DIR/crm-update-health.sh" 2>/dev/null || true
chmod +x "$SCRIPT_DIR/crm-update-compose-env.sh" 2>/dev/null || true
chmod +x "$SCRIPT_DIR/crm-update-sync-host-env.sh" 2>/dev/null || true

# CRM auto-update (update-bridge container): older baked executor images run composeSetup()
# then a hardcoded docker compose line without modules-bridge. When this script is sourced
# inside update-bridge (UPDATE_HTTP_PORT set), run the full CRM build once.
# Skipped when executor sets WASH_CRM_UPDATE_V2=1 (it calls crm-update-build.sh directly).
if [ -n "${UPDATE_HTTP_PORT:-}" ] && [ "${WASH_CRM_UPDATE_V2:-}" != "1" ] && [ "${WASH_CRM_UPDATE_BUILD_RUNNING:-}" != "1" ]; then
  if [ -f "$SCRIPT_DIR/crm-update-build.sh" ]; then
    bash "$SCRIPT_DIR/crm-update-build.sh"
  fi
fi
