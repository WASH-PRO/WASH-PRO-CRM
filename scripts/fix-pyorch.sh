#!/bin/sh
set -e
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml"

if [ "${PYORCHESTRATOR_ENABLED:-false}" != "true" ]; then
  echo "PYORCHESTRATOR_ENABLED не true в .env — PyOrchestrator не используется."
  exit 1
fi

echo "==> Перезапуск PyOrchestrator (Redis, backend, runtime, scheduler, bridge, telegram-egress)..."
$COMPOSE up -d telegram-egress pyorch-redis pyorch-postgres pyorch-minio pyorch-backend pyorch-runtime pyorch-scheduler pyorch-bridge

echo "==> Ожидание health backend..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  if $COMPOSE exec -T pyorch-backend curl -fsS http://localhost:8000/health >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "==> Проверка Redis из runtime..."
$COMPOSE exec -T pyorch-runtime python -c "import redis; print('redis:', redis.from_url('redis://pyorch-redis:6379/0').ping())"

echo "Готово. Перезапустите Telegram-бота в Dashboard → Telegram (Стоп → Запуск)."
