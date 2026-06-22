#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
docker compose -f "$ROOT/docker-compose.yml" exec backup \
  node -e "import('$ROOT/services/backup/src/index.ts').then(m => m.runBackup('manual'))" 2>/dev/null \
  || docker compose -f "$ROOT/docker-compose.yml" exec backup sh -c 'echo "Создайте бэкап через Dashboard → Резервные копии"'
