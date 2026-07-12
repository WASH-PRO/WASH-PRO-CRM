#!/usr/bin/env bash
# Detect host project root (for docker compose volume binds) and persist to .env.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ENV_FILE="$ROOT/.env"

detect_host_project_root() {
  local detected="" target
  if command -v docker >/dev/null 2>&1; then
    for target in "${HOSTNAME:-}" wash-update-bridge wash-dashboard; do
      [ -z "$target" ] && continue
      detected="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/deploy"}}{{.Source}}{{end}}{{end}}' "$target" 2>/dev/null || true)"
      if [ -n "$detected" ] && [ "$detected" != "/deploy" ]; then
        echo "$detected"
        return 0
      fi
    done
  fi

  if [ -r /proc/self/mountinfo ]; then
    while IFS= read -r line; do
      case "$line" in
        *" /deploy "*)
          detected="${line##* - }"
          detected="${detected%% *}"
          if [ -n "$detected" ] && [ "$detected" != "/deploy" ]; then
            echo "$detected"
            return 0
          fi
          ;;
      esac
    done < /proc/self/mountinfo
  fi

  return 1
}

upsert_env_key() {
  local key="$1" value="$2"
  touch "$ENV_FILE"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    if [[ "$(uname)" == "Darwin" ]]; then
      sed -i '' "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    else
      sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
    fi
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

host_root="$(detect_host_project_root || true)"
if [ -z "$host_root" ]; then
  echo "[crm-update-sync-host-env] Could not detect host project root — set WASH_HOST_PROJECT_ROOT in .env manually" >&2
  exit 0
fi

current=""
if [ -f "$ENV_FILE" ]; then
  current="$(grep -E '^WASH_HOST_PROJECT_ROOT=' "$ENV_FILE" | tail -1 | cut -d= -f2- || true)"
fi

if [ "$current" = "$host_root" ]; then
  echo "[crm-update-sync-host-env] WASH_HOST_PROJECT_ROOT already OK ($host_root)" >&2
  exit 0
fi

if [ -z "$current" ] || [ "$current" = "." ] || [ "$current" = "/deploy" ]; then
  upsert_env_key WASH_HOST_PROJECT_ROOT "$host_root"
  echo "[crm-update-sync-host-env] Set WASH_HOST_PROJECT_ROOT=$host_root" >&2
else
  echo "[crm-update-sync-host-env] Keeping custom WASH_HOST_PROJECT_ROOT=$current (detected $host_root)" >&2
fi
