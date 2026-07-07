#!/usr/bin/env bash
# Быстрая проверка работоспособности WASH PRO CRM после деплоя.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

DASHBOARD_PORT="${DASHBOARD_PORT:-80}"
DYNAMIC_API_PORT="${DYNAMIC_API_PORT:-3001}"
MQTT_EXTERNAL_PORT="${MQTT_EXTERNAL_PORT:-1883}"
ADMIN_LOGIN="${ADMIN_LOGIN:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123!}"

pass=0
fail=0

check() {
  local name="$1"
  shift
  if "$@"; then
    echo "  OK   $name"
    pass=$((pass + 1))
  else
    echo "  FAIL $name"
    fail=$((fail + 1))
  fi
}

echo "WASH PRO CRM — smoke test"
echo ""

check "Dynamic API /api/health" \
  curl -fsS "http://localhost:${DYNAMIC_API_PORT}/api/health" >/dev/null

check "Dashboard HTTP" \
  curl -fsS -o /dev/null "http://localhost:${DASHBOARD_PORT}/"

TOKEN=""
if TOKEN_JSON="$(curl -fsS -X POST "http://localhost:${DYNAMIC_API_PORT}/api/login" \
  -H 'Content-Type: application/json' \
  -d "{\"login\":\"${ADMIN_LOGIN}\",\"password\":\"${ADMIN_PASSWORD}\"}" 2>/dev/null)"; then
  TOKEN="$(echo "$TOKEN_JSON" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"
fi

check "Admin login" test -n "$TOKEN"

if [ -n "$TOKEN" ]; then
  check "CRM washes list" \
    curl -fsS "http://localhost:${DYNAMIC_API_PORT}/api/crm/washes?limit=1" \
      -H "Authorization: Bearer ${TOKEN}" >/dev/null

  check "CRM posts list" \
    curl -fsS "http://localhost:${DYNAMIC_API_PORT}/api/crm/posts?limit=1" \
      -H "Authorization: Bearer ${TOKEN}" >/dev/null

  check "CRM settings" \
    curl -fsS "http://localhost:${DYNAMIC_API_PORT}/api/crm/settings?limit=10" \
      -H "Authorization: Bearer ${TOKEN}" >/dev/null

  check "MQTT user sync (dashboard API)" \
    curl -fsS -X POST "http://localhost:${DYNAMIC_API_PORT}/api/crm/post-device/mqtt/sync-users" \
      -H "Authorization: Bearer ${TOKEN}" >/dev/null
fi

if command -v nc >/dev/null 2>&1; then
  check "MQTT port ${MQTT_EXTERNAL_PORT}" nc -z localhost "${MQTT_EXTERNAL_PORT}"
elif command -v bash >/dev/null 2>&1; then
  check "MQTT port ${MQTT_EXTERNAL_PORT}" \
    bash -c "echo >/dev/tcp/127.0.0.1/${MQTT_EXTERNAL_PORT}" 2>/dev/null
fi

echo ""
echo "Итого: ${pass} OK, ${fail} FAIL"
if [ "$fail" -gt 0 ]; then
  echo "Проверьте: docker compose ps && docker compose logs --tail=50"
  exit 1
fi

echo "Smoke test пройден."
