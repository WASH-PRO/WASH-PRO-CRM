#!/usr/bin/env bash
# Ручной перезапуск инициализации CRM (если init-seed не отработал при первом старте)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Пересборка и запуск init-seed..."
docker compose build init-seed
docker compose run --rm init-seed

echo ""
echo "Готово. Перезапуск зависимых сервисов..."
docker compose up -d message-processor backup telegram-bot dashboard

echo ""
docker compose ps init-seed message-processor dashboard
