#!/usr/bin/env bash
set -euo pipefail

JOB_ID="${1:?job id required}"
DATA_DIR="${2:?data dir required}"
DEPLOY_MODE="${3:-docker}"
COMPOSE_FILE="${4:-/deploy/docker-compose.yml}"
PROJECT_ROOT="${5:-/deploy}"
PORT="${6:-8000}"
HEALTH_URL="${7:-http://backend:8000/health}"

SNAPSHOT_FILE="$DATA_DIR/rollback-${JOB_ID}.json"

if [[ ! -f "$SNAPSHOT_FILE" ]]; then
  echo "Rollback snapshot not found: $SNAPSHOT_FILE"
  exit 1
fi

cd "$PROJECT_ROOT"

COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-pyorchestrator}"
export COMPOSE_PROJECT_NAME

GIT_REF="$(jq -r '.gitRef // empty' "$SNAPSHOT_FILE")"
MODE="$(jq -r '.mode // "docker"' "$SNAPSHOT_FILE")"
USE_GIT="$(jq -r '.useGit // 1' "$SNAPSHOT_FILE")"
FROM_VERSION="$(jq -r '.fromVersion // empty' "$SNAPSHOT_FILE")"
GITHUB_REPO="$(jq -r '.githubRepo // "PyOrchestrator/PyOrchestrator"' "$SNAPSHOT_FILE")"

echo "Rolling back job $JOB_ID to v${FROM_VERSION:-$GIT_REF}"

if [[ "$USE_GIT" == "1" && -n "$GIT_REF" && "$GIT_REF" != "unknown" && "$GIT_REF" != "null" && "$GIT_REF" != "archive" ]]; then
  rm -f .git/index.lock
  git fetch --tags --force origin || true
  git checkout "$GIT_REF"
elif [[ -n "$FROM_VERSION" ]]; then
  TMP_ARCHIVE="/tmp/pyorch-rollback-${JOB_ID}.tar.gz"
  TAG="v${FROM_VERSION#v}"
  if ! curl -sfL "https://github.com/${GITHUB_REPO}/archive/refs/tags/${TAG}.tar.gz" -o "$TMP_ARCHIVE"; then
    curl -sfL "https://github.com/${GITHUB_REPO}/archive/refs/tags/${FROM_VERSION}.tar.gz" -o "$TMP_ARCHIVE"
  fi
  EXTRACT_DIR="/tmp/pyorch-rollback-extract-${JOB_ID}"
  rm -rf "$EXTRACT_DIR"
  mkdir -p "$EXTRACT_DIR"
  tar -xzf "$TMP_ARCHIVE" -C "$EXTRACT_DIR"
  SRC_DIR="$(find "$EXTRACT_DIR" -mindepth 1 -maxdepth 1 -type d | head -1)"
  rsync -a --delete \
    --exclude='node_modules' \
    --exclude='frontend/node_modules' \
    --exclude='.git' \
    "$SRC_DIR"/ "$PROJECT_ROOT"/
  rm -rf "$EXTRACT_DIR" "$TMP_ARCHIVE"
else
  echo "No git ref or version available for rollback"
  exit 1
fi

if [[ "$MODE" == "docker" || "$MODE" == "docker-replica" || "$DEPLOY_MODE" == "docker" || "$DEPLOY_MODE" == "docker-replica" ]]; then
  HOST_ROOT="${UPDATE_HOST_PROJECT_ROOT:-${PYORCH_HOST_PROJECT_ROOT:-}}"
  if [[ -n "$HOST_ROOT" && "$HOST_ROOT" != "/deploy" ]]; then
    export PYORCH_HOST_PROJECT_ROOT="$HOST_ROOT"
    export PYORCH_BUILD_ROOT="$PROJECT_ROOT"
  fi
  docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" up -d --build --remove-orphans
else
  echo "Native rollback is not supported"
  exit 1
fi

for i in $(seq 1 60); do
  if curl -sf "$HEALTH_URL" >/dev/null 2>&1; then
    echo "Rollback health check OK"
    exit 0
  fi
  sleep 5
done

echo "Rollback completed but health check did not pass"
exit 1
