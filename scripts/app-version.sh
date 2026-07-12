#!/usr/bin/env bash
# Print CRM app version from dashboard/package.json (single source of truth).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
node -p "require('$ROOT/dashboard/package.json').version"
