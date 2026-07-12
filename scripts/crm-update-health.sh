#!/usr/bin/env bash
# CRM auto-update: health checks after build/seed.
set -euo pipefail

wget -qO- http://dynamic-api:3001/api/health >/dev/null
wget -qO- http://message-processor:3022/health >/dev/null

for attempt in 1 2 3 4 5; do
  if wget -qO- http://modules-bridge:3024/health >/dev/null; then
    exit 0
  fi
  echo "[crm-update-health] modules-bridge not ready (attempt ${attempt}/5), waiting…" >&2
  sleep 5
done

echo "[crm-update-health] modules-bridge health check failed" >&2
exit 1
