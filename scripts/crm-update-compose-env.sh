#!/usr/bin/env bash
# Shared compose env for CRM update scripts (host paths + compose file list).
# When run from update-bridge, preserves composeCommandEnv() paths over .env values.
set -euo pipefail

export WASH_CRM_UPDATE_V2=1

CRM_UPDATE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$CRM_UPDATE_ROOT"

_preserve_host="${WASH_HOST_PROJECT_ROOT:-}"
_preserve_build="${WASH_BUILD_ROOT:-}"
_preserve_data="${DATA_DIR:-}"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [ -n "$_preserve_host" ] && [ "$_preserve_host" != "." ] && [ "$_preserve_host" != "/deploy" ]; then
  export WASH_HOST_PROJECT_ROOT="$_preserve_host"
elif [ -z "${WASH_HOST_PROJECT_ROOT:-}" ] || [ "$WASH_HOST_PROJECT_ROOT" = "." ] || [ "$WASH_HOST_PROJECT_ROOT" = "/deploy" ]; then
  detected=""
  if [ -n "${HOSTNAME:-}" ] && command -v docker >/dev/null 2>&1; then
    detected="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/deploy"}}{{.Source}}{{end}}{{end}}' "${HOSTNAME}" 2>/dev/null || true)"
  fi
  if [ -n "$detected" ] && [ "$detected" != "/deploy" ]; then
    export WASH_HOST_PROJECT_ROOT="$detected"
  fi
fi

if [ -n "$_preserve_build" ]; then
  export WASH_BUILD_ROOT="$_preserve_build"
elif [ -n "${WASH_HOST_PROJECT_ROOT:-}" ] && [ "$WASH_HOST_PROJECT_ROOT" != "/deploy" ] && [ -d /deploy ]; then
  export WASH_BUILD_ROOT="/deploy"
fi

if [ -n "$_preserve_data" ]; then
  export DATA_DIR="$_preserve_data"
elif [ -n "${WASH_HOST_PROJECT_ROOT:-}" ] && [ -n "${DATA_DIR:-}" ] && [[ "${DATA_DIR}" != /* ]]; then
  export DATA_DIR="${WASH_HOST_PROJECT_ROOT}/${DATA_DIR#./}"
fi

if [ -z "${COMPOSE_FILES:-}" ]; then
  # shellcheck disable=SC1091
  source "$CRM_UPDATE_ROOT/scripts/compose-files.sh"
fi
