#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ]; then
  echo "Использование: $0 <имя_файла_бэкапа>"
  echo "Пример: $0 wash-crm-2024-01-01.archive.gz"
  exit 1
fi

docker compose -f "$ROOT/docker-compose.yml" exec backup \
  node -e "
    import('node:child_process').then(({ exec }) => {
      const uri = process.env.MONGODB_URI;
      const file = '/backups/$BACKUP_FILE';
      exec('mongorestore --uri=\"' + uri + '\" --archive=\"' + file + '\" --gzip --drop', (err, stdout, stderr) => {
        if (err) { console.error(stderr); process.exit(1); }
        console.log('Восстановление завершено:', '$BACKUP_FILE');
      });
    });
  "
