#!/usr/bin/env bash
# Пересоздаёт конфиг Mosquitto, ACL, system и перезапускает брокер.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

docker compose run --rm mosquitto-init
docker compose restart mosquitto message-processor

echo "MQTT broker reconfigured. Sync post users from CRM: Мастер настроек → MQTT или сохранение поста."
