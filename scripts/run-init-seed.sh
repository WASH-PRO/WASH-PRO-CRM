#!/usr/bin/env bash
# Ручной перезапуск инициализации CRM (если init-seed не отработал при первом старте)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

COMPOSE_FILES="-f docker-compose.yml"
if [ "${REDIS_ENABLED:-false}" = "true" ]; then
  COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.redis.yml"
fi
if [ "${PYORCHESTRATOR_ENABLED:-false}" = "true" ]; then
  COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.pyorchestrator.yml"
fi

echo "Пересборка и запуск init-seed..."
docker compose $COMPOSE_FILES build init-seed
docker compose $COMPOSE_FILES run --rm init-seed

echo ""
echo "Готово. Поднимаем зависимые сервисы..."
docker compose $COMPOSE_FILES up -d

echo ""
docker compose $COMPOSE_FILES ps init-seed dashboard message-processor backup
