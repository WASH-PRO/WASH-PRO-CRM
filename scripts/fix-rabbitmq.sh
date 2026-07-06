#!/usr/bin/env bash
# Устарело: RabbitMQ заменён на MQTT (Mosquitto).
echo "RabbitMQ заменён на MQTT. Запускаю fix-mqtt.sh..."
exec "$(dirname "$0")/fix-mqtt.sh"
