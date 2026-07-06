#!/usr/bin/env bash
# Однократная миграция данных из named Docker volumes в DATA_DIR (bind mount).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

"$ROOT/scripts/ensure-data-dirs.sh"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

DATA_DIR="${DATA_DIR:-./data}"
if [[ "$DATA_DIR" != /* ]]; then
  DATA_DIR="$ROOT/$DATA_DIR"
fi

COMPOSE_FILES="-f docker-compose.yml"
if [ "${PYORCHESTRATOR_ENABLED:-false}" = "true" ]; then
  COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.pyorchestrator.yml"
fi

echo "Останавливаем стек (без удаления bind mount)..."
docker compose $COMPOSE_FILES stop 2>/dev/null || true

migrate_volume() {
  local volume_name="$1"
  local dest_dir="$2"

  if ! docker volume inspect "$volume_name" >/dev/null 2>&1; then
    echo "  — volume $volume_name не найден, пропуск"
    return 0
  fi

  if [ -n "$(find "$dest_dir" -mindepth 1 -maxdepth 1 2>/dev/null | head -1)" ]; then
    echo "  — $dest_dir уже не пуст, пропуск $volume_name"
    return 0
  fi

  echo "  → $volume_name → $dest_dir"
  docker run --rm \
    -v "${volume_name}:/from:ro" \
    -v "${dest_dir}:/to" \
    alpine:3.20 \
    sh -c 'cp -a /from/. /to/ 2>/dev/null || true'
}

echo ""
echo "Миграция в $DATA_DIR"
migrate_volume wash_mongodb_data "$DATA_DIR/mongodb"
migrate_volume wash_backend_logs "$DATA_DIR/dynamic-api/logs"
migrate_volume wash_mosquitto_data "$DATA_DIR/mosquitto/data"
migrate_volume wash_mosquitto_config "$DATA_DIR/mosquitto/config"
migrate_volume wash_redis_data "$DATA_DIR/redis"
migrate_volume wash_backup_data "$DATA_DIR/backups"
migrate_volume wash_pyorch_postgres_data "$DATA_DIR/pyorchestrator/postgres"
migrate_volume wash_pyorch_redis_data "$DATA_DIR/pyorchestrator/redis"
migrate_volume wash_pyorch_minio_data "$DATA_DIR/pyorchestrator/minio"
migrate_volume wash_pyorch_runtime_workspaces "$DATA_DIR/pyorchestrator/runtime-workspaces"
migrate_volume wash_pyorch_prometheus_data "$DATA_DIR/pyorchestrator/prometheus"
migrate_volume wash_pyorch_grafana_data "$DATA_DIR/pyorchestrator/grafana"
migrate_volume wash_pyorch_loki_data "$DATA_DIR/pyorchestrator/loki"

echo ""
echo "Готово. Запустите стек: ./scripts/start.sh"
echo "Старые volumes можно удалить вручную после проверки: docker volume ls | grep wash_"
