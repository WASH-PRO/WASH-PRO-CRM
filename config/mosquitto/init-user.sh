#!/bin/sh
set -e

USER="${MQTT_USER:-wash}"
PASS="${MQTT_PASSWORD:-wash_secret_change_me}"
PASSWD_FILE="/mosquitto/config/passwd"

cp /mosquitto-conf/mosquitto.conf /mosquitto/config/mosquitto.conf

if [ -f "$PASSWD_FILE" ]; then
  mosquitto_passwd -b "$PASSWD_FILE" "$USER" "$PASS"
else
  mosquitto_passwd -b -c "$PASSWD_FILE" "$USER" "$PASS"
fi

chmod 644 "$PASSWD_FILE"

echo "MQTT user '$USER' ready."
