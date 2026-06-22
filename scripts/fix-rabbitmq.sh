#!/usr/bin/env bash
# Пересоздаёт пользователя RabbitMQ (если volume был инициализирован с пустым users: [])
set -euo pipefail

USER="${RABBITMQ_USER:-wash}"
PASS="${RABBITMQ_PASSWORD:-wash_secret_change_me}"

docker exec wash-rabbitmq rabbitmqctl add_user "$USER" "$PASS" 2>/dev/null || \
  docker exec wash-rabbitmq rabbitmqctl change_password "$USER" "$PASS"

docker exec wash-rabbitmq rabbitmqctl set_permissions -p / "$USER" ".*" ".*" ".*"
docker exec wash-rabbitmq rabbitmqctl set_user_tags "$USER" administrator

echo "RabbitMQ user '$USER' configured."
