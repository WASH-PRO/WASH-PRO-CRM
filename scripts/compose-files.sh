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
