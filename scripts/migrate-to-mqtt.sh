#!/usr/bin/env bash
# Удаляет контейнеры и volume RabbitMQ после перехода на MQTT.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Останавливаем устаревшие сервисы RabbitMQ (если есть)..."
docker rm -f wash-rabbitmq wash-rabbitmq-init 2>/dev/null || true

echo "Удаляем volume RabbitMQ (если есть)..."
docker volume rm wash_rabbitmq_data 2>/dev/null || true

echo "Поднимаем MQTT-брокер (порт 1883 доступен из локальной сети)..."
export MQTT_PORT_PUBLISH="${MQTT_EXTERNAL_PORT:-1883}:1883"
if [ "${MQTT_BIND:-}" = "127.0.0.1" ]; then
  export MQTT_PORT_PUBLISH="127.0.0.1:${MQTT_EXTERNAL_PORT:-1883}:1883"
fi
docker compose up -d --force-recreate mosquitto-init mosquitto

echo "Готово. Контроллеры должны публиковать в MQTT-топик wash/telemetry/# на порт 1883."
echo "Документация: docs/mqtt.md"
