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

# shellcheck disable=SC1091
source "$ROOT/scripts/compose-files.sh"

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
echo "MQTT (посты):      mqtt://<логин-поста>@<IP-сервера>:${MQTT_EXTERNAL_PORT:-1883}  (system — только CRM)"
