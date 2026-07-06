#!/usr/bin/env bash
# Пересоздаёт пользователя Mosquitto (если volume был инициализирован с другим паролем)
set -euo pipefail

USER="${MQTT_USER:-wash}"
PASS="${MQTT_PASSWORD:-wash_secret_change_me}"

docker exec wash-mosquitto sh -c "
  if [ -f /mosquitto/config/passwd ]; then
    mosquitto_passwd -b /mosquitto/config/passwd '$USER' '$PASS'
  else
    mosquitto_passwd -b -c /mosquitto/config/passwd '$USER' '$PASS'
  fi
  chmod 644 /mosquitto/config/passwd
"

docker restart wash-mosquitto
echo "MQTT user '$USER' configured."
