#!/bin/sh
set -e

USER="${MQTT_USER:-superadmin}"
PASS="${MQTT_PASSWORD:?MQTT_PASSWORD is required}"
PASSWD_FILE="/mosquitto/config/passwd"

cp /mosquitto-conf/mosquitto.conf /mosquitto/config/mosquitto.conf
sed "s/^user superadmin/user $USER/" /mosquitto-conf/acl > /mosquitto/config/acl

rm -f "$PASSWD_FILE"
mosquitto_passwd -b -c "$PASSWD_FILE" "$USER" "$PASS"

chmod 600 "$PASSWD_FILE"
chmod 644 /mosquitto/config/acl

echo "MQTT user '$USER' ready."
