#!/bin/sh
set -e
USER="${RABBITMQ_USER:-wash}"
PASS="${RABBITMQ_PASSWORD:-wash_secret_change_me}"

echo "Waiting for RabbitMQ..."
until rabbitmq-diagnostics -q ping 2>/dev/null; do sleep 2; done

if rabbitmqctl list_users | grep -q "^${USER}"; then
  rabbitmqctl change_password "$USER" "$PASS"
else
  rabbitmqctl add_user "$USER" "$PASS"
fi

rabbitmqctl set_permissions -p / "$USER" ".*" ".*" ".*"
rabbitmqctl set_user_tags "$USER" administrator
echo "RabbitMQ user '$USER' ready."
