#!/bin/sh
set -e

CONF="/etc/nginx/conf.d/default.conf"
TEMPLATE="/etc/nginx/templates/default.conf.template"

if [ "${PYORCHESTRATOR_ENABLED:-false}" = "true" ]; then
  cp "$TEMPLATE" "$CONF"
else
  sed '/# PYORCH_BLOCK_START/,/# PYORCH_BLOCK_END/d' "$TEMPLATE" > "$CONF"
fi

if [ -n "${APP_VERSION:-}" ]; then
  printf '{"version":"%s"}\n' "$APP_VERSION" > /usr/share/nginx/html/version.json
fi

exec nginx -g 'daemon off;'
