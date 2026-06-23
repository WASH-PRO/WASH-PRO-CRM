#!/bin/sh
set -e

USER="${RABBITMQ_USER:-wash}"
PASS="${RABBITMQ_PASSWORD:-wash_secret_change_me}"

# Требуется общий volume rabbitmq_data — иначе CLI-узел получает другой Erlang cookie
# и сервер отвечает: Invalid challenge reply.

echo "Waiting for RabbitMQ node rabbit@wash-rabbitmq..."
for i in $(seq 1 60); do
  if rabbitmqctl await_startup 2>/dev/null; then
    echo "RabbitMQ node is up (attempt $i)"
    break
  fi
  sleep 2
done

rabbitmqctl await_startup

if rabbitmqctl list_users 2>/dev/null | grep -q "^${USER}[[:space:]]"; then
  rabbitmqctl change_password "$USER" "$PASS"
else
  rabbitmqctl add_user "$USER" "$PASS"
fi

rabbitmqctl set_permissions -p / "$USER" ".*" ".*" ".*"
rabbitmqctl set_user_tags "$USER" administrator
echo "RabbitMQ user '$USER' ready."
