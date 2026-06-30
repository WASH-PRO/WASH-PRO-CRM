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

COMPOSE_FILES="-f docker-compose.yml"
if [ "${REDIS_ENABLED:-false}" = "true" ]; then
  COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.redis.yml"
fi
if [ -n "${RABBITMQ_EXTERNAL_PORT:-}" ]; then
  COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.controllers.yml"
fi
if [ "${PYORCHESTRATOR_ENABLED:-false}" = "true" ]; then
  COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.pyorchestrator.yml"
  if [ "${PYORCH_OBSERVABILITY_ENABLED:-false}" = "true" ]; then
    export COMPOSE_PROFILES=pyorch-observability
  fi
fi

docker compose $COMPOSE_FILES up -d --build "$@"

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
