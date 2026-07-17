#!/usr/bin/env bash
# Пересоздаёт конфиг Mosquitto (conf/ACL bootstrap), перезапускает брокер и processor.
# Существующий passwd не затирается из .env (см. init-user.sh) — processor при старте
# лечит seed-пароль washpro → MQTT_PASSWORD и делает sync-users.
# Принудительно сбросить system из .env: FORCE_MQTT_SYSTEM_PASS=1 ./scripts/fix-mqtt.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ "${FORCE_MQTT_SYSTEM_PASS:-}" == "1" ]]; then
  docker compose run --rm -e FORCE_MQTT_SYSTEM_PASS=1 mosquitto-init
else
  docker compose run --rm mosquitto-init
fi
docker compose restart mosquitto message-processor

echo "MQTT broker reconfigured. Sync post users: Setup wizard → MQTT, or save a post / wait for processor startup heal."
