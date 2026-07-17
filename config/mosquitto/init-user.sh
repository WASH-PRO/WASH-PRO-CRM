#!/bin/sh
set -e

USER="${MQTT_USER:-system}"
PASS="${MQTT_PASSWORD:?MQTT_PASSWORD is required}"
PASSWD_FILE="/mosquitto/config/passwd"
ACL_FILE="/mosquitto/config/acl"

cp /mosquitto-conf/mosquitto.conf /mosquitto/config/mosquitto.conf

# Bootstrap only: do not overwrite an existing passwd on every restart.
# Otherwise .env MQTT_PASSWORD fights CRM settings mqtt-broker.systemPassword
# (message-processor sync is the source of truth after first boot).
# Emergency reset from .env: FORCE_MQTT_SYSTEM_PASS=1
if [ -f "$PASSWD_FILE" ] && [ "${FORCE_MQTT_SYSTEM_PASS:-}" != "1" ]; then
  echo "MQTT passwd exists — leaving users intact (not overwriting from .env)."
elif [ "${FORCE_MQTT_SYSTEM_PASS:-}" = "1" ] && [ -f "$PASSWD_FILE" ]; then
  mosquitto_passwd -b "$PASSWD_FILE" "$USER" "$PASS"
  echo "MQTT user '$USER' password force-refreshed from .env (post users preserved)."
else
  mosquitto_passwd -b -c "$PASSWD_FILE" "$USER" "$PASS"
  echo "MQTT user '$USER' created."
fi

if [ ! -f "$ACL_FILE" ]; then
  sed "s/^user system/user $USER/" /mosquitto-conf/acl > "$ACL_FILE"
  chmod 644 "$ACL_FILE"
  echo "MQTT ACL template created."
else
  echo "MQTT ACL preserved (post rules kept)."
fi

chmod 600 "$PASSWD_FILE"
