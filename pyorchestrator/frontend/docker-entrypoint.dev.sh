#!/bin/sh
set -e
# Sync deps when package.json changes (src is bind-mounted, node_modules lives in the image)
npm install --prefer-offline
exec npm run dev -- --host 0.0.0.0
