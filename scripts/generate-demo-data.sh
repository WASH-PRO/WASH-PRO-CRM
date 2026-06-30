#!/usr/bin/env bash
# Генерация демо-данных: 30 моек, 100 постов, статистика до/после инкассации
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_URL="${API_URL:-http://localhost:3001}"
export API_URL ADMIN_LOGIN="${ADMIN_LOGIN:-admin}" ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123!}"

echo "==> Generate demo data (API: $API_URL)"
node "$ROOT/scripts/generate-demo-data.mjs"
