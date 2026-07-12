#!/usr/bin/env bash
# CRM auto-update: health checks after build/seed.
set -euo pipefail

wget -qO- http://dynamic-api:3001/api/health >/dev/null
wget -qO- http://message-processor:3022/health >/dev/null
wget -qO- http://modules-bridge:3024/health >/dev/null
