#!/usr/bin/env bash
# Создаёт дерево каталогов для bind-mount (DATA_DIR).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

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

DIRS=(
  "$DATA_DIR/mongodb"
  "$DATA_DIR/mosquitto/data"
  "$DATA_DIR/mosquitto/config"
  "$DATA_DIR/redis"
  "$DATA_DIR/backups"
  "$DATA_DIR/dynamic-api/logs"
  "$DATA_DIR/pyorchestrator/postgres"
  "$DATA_DIR/pyorchestrator/redis"
  "$DATA_DIR/pyorchestrator/minio"
  "$DATA_DIR/pyorchestrator/runtime-workspaces"
  "$DATA_DIR/pyorchestrator/prometheus"
  "$DATA_DIR/pyorchestrator/grafana"
  "$DATA_DIR/pyorchestrator/loki"
  "$ROOT/modules/installed"
)

for dir in "${DIRS[@]}"; do
  mkdir -p "$dir"
done

echo "Каталог данных: $DATA_DIR"
