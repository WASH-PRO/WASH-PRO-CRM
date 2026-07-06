#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Создан файл .env из .env.example — отредактируйте секреты перед production!"
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

"$ROOT/scripts/ensure-data-dirs.sh"

COMPOSE_FILES="-f docker-compose.yml"
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

docker compose $COMPOSE_FILES up -d --build "$@"

# После one-shot init-seed зависимые сервисы могут остаться в Created — поднимаем ещё раз.
docker compose $COMPOSE_FILES up -d

echo ""
echo "WASH PRO CRM запущен."
echo "Dashboard:         http://localhost:${DASHBOARD_PORT:-80}"
echo "Dynamic API:       http://localhost:${DYNAMIC_API_PORT:-3001}/api/health"
echo "Dynamic API Panel: http://localhost:${DYNAMIC_API_PANEL_PORT:-8080}"
if [ "${PYORCHESTRATOR_ENABLED:-false}" = "true" ]; then
  echo "PyOrchestrator API:   http://localhost:${PYORCH_BACKEND_PORT:-8000}/health"
  echo "PyOrchestrator Panel: http://localhost:${PYORCH_PANEL_PORT:-8090}"
fi
echo "Логин по умолчанию: ${ADMIN_LOGIN:-admin} / ${ADMIN_PASSWORD:-Admin123!}"
DATA_DIR_DISPLAY="${DATA_DIR:-./data}"
echo "Данные на диске:    ${DATA_DIR_DISPLAY} (см. data/README.md)"
echo "MQTT (контроллеры): mqtt://${MQTT_USER:-wash}@<IP-сервера>:${MQTT_EXTERNAL_PORT:-1883}  топик wash/telemetry/#"
