#!/bin/sh
set -e

USER="${MQTT_USER:-system}"
PASS="${MQTT_PASSWORD:?MQTT_PASSWORD is required}"
PASSWD_FILE="/mosquitto/config/passwd"
ACL_FILE="/mosquitto/config/acl"

cp /mosquitto-conf/mosquitto.conf /mosquitto/config/mosquitto.conf

# Не затираем passwd/ACL после sync постов — только bootstrap при первом запуске.
if [ -f "$PASSWD_FILE" ]; then
  mosquitto_passwd -b "$PASSWD_FILE" "$USER" "$PASS"
  echo "MQTT user '$USER' password refreshed (post users preserved)."
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
