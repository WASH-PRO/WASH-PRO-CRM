#!/usr/bin/env bash
# Self-update runner — runs in a detached Docker container (see update_executor_service.py).
set -euo pipefail

JOB_ID="${1:?job id required}"
DATA_DIR="${2:?data dir required}"
DEPLOY_MODE="${3:-docker}"
COMPOSE_FILE="${4:-/deploy/docker-compose.yml}"
PROJECT_ROOT="${5:-/deploy}"
PORT="${6:-8000}"
HEALTH_URL="${7:-http://backend:8000/health}"

PROGRESS_FILE="$DATA_DIR/update-progress.json"
RESULT_FILE="$DATA_DIR/update-result.json"
MANIFEST_FILE="$DATA_DIR/job-${JOB_ID}.json"
LOG_FILE="$DATA_DIR/update-${JOB_ID}.log"

mkdir -p "$DATA_DIR"
exec >>"$LOG_FILE" 2>&1

if [[ ! -f "$MANIFEST_FILE" ]]; then
  echo "Manifest not found: $MANIFEST_FILE"
  exit 1
fi

TARGET_TAG="$(jq -r '.targetTag' "$MANIFEST_FILE")"
FROM_VERSION="$(jq -r '.fromVersion' "$MANIFEST_FILE")"
GITHUB_REPO="$(jq -r '.githubRepo // "PyOrchestrator/PyOrchestrator"' "$MANIFEST_FILE")"

STEPS='[{"id":"snapshot","label":"Save rollback snapshot","status":"pending"},{"id":"fetch","label":"Fetch release","status":"pending"},{"id":"deploy","label":"Apply update","status":"pending"},{"id":"health","label":"Verify health","status":"pending"}]'
ROLLBACK_SNAPSHOT="{}"
JOB_STATUS="running"
ROLLBACK_DONE=0

write_progress() {
  local status="${1:-$JOB_STATUS}"
  jq -n \
    --arg jobId "$JOB_ID" \
    --arg status "$status" \
    --argjson steps "$STEPS" \
    --argjson snapshot "$ROLLBACK_SNAPSHOT" \
    '{jobId: $jobId, status: $status, steps: $steps, rollbackSnapshot: $snapshot}' > "$PROGRESS_FILE"
}

write_result() {
  local status="$1"
  local error="${2:-}"
  jq -n \
    --arg jobId "$JOB_ID" \
    --arg status "$status" \
    --arg error "$error" \
    --argjson snapshot "$ROLLBACK_SNAPSHOT" \
    '{jobId: $jobId, status: $status, error: $error, rollbackSnapshot: $snapshot}' > "$RESULT_FILE"
  rm -f "$PROGRESS_FILE"
}

set_step() {
  local id="$1"
  local status="$2"
  local message="${3:-}"
  STEPS="$(echo "$STEPS" | jq --arg id "$id" --arg st "$status" --arg msg "$message" \
    'map(if .id == $id then . + {status: $st, message: $msg} else . end)')"
  write_progress "$JOB_STATUS"
}

wait_for_health() {
  local url="$1"
  local attempts="${2:-72}"
  local delay="${3:-5}"
  local i=1
  while [ "$i" -le "$attempts" ]; do
    if curl -sf "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
    i=$((i + 1))
  done
  return 1
}

download_release_archive() {
  local tag="$1"
  local dest="$2"
  local tag_path="$tag"
  if ! curl -sfL "https://github.com/${GITHUB_REPO}/archive/refs/tags/${tag_path}.tar.gz" -o "$dest"; then
    local alt="${tag#v}"
    curl -sfL "https://github.com/${GITHUB_REPO}/archive/refs/tags/v${alt}.tar.gz" -o "$dest"
  fi
}

apply_release_archive() {
  local archive="$1"
  local extract_dir="/tmp/pyorch-extract-${JOB_ID}-$$"
  rm -rf "$extract_dir"
  mkdir -p "$extract_dir"
  tar -xzf "$archive" -C "$extract_dir"
  local src_dir
  src_dir="$(find "$extract_dir" -mindepth 1 -maxdepth 1 -type d | head -1)"
  rsync -a --delete \
    --exclude='node_modules' \
    --exclude='frontend/node_modules' \
    --exclude='.git' \
    "$src_dir"/ "$PROJECT_ROOT"/
  rm -rf "$extract_dir"
}

do_rollback() {
  if [[ "$ROLLBACK_DONE" -eq 1 ]]; then
    return
  fi
  ROLLBACK_DONE=1
  JOB_STATUS="rolling_back"
  write_progress "$JOB_STATUS"
  echo "Starting automatic rollback..."
  if [[ -f "$PROJECT_ROOT/scripts/self-update-rollback.sh" ]]; then
    bash "$PROJECT_ROOT/scripts/self-update-rollback.sh" \
      "$JOB_ID" "$DATA_DIR" "$DEPLOY_MODE" "$COMPOSE_FILE" "$PROJECT_ROOT" "$PORT" "$HEALTH_URL" || true
  fi
}

on_error() {
  JOB_STATUS="failed"
  echo "Update failed at line $1"
  do_rollback
  write_result "rolled_back" "Update failed; automatic rollback attempted"
  exit 1
}
trap 'on_error $LINENO' ERR

write_progress "running"
set_step snapshot running "Recording current version"

cd "$PROJECT_ROOT"

COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-pyorchestrator}"
export COMPOSE_PROJECT_NAME

USE_GIT=0
if [[ -d .git ]]; then
  USE_GIT=1
fi

if [[ "$USE_GIT" -eq 1 ]]; then
  GIT_REF="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
else
  GIT_REF="archive"
fi

if [[ "$DEPLOY_MODE" == "docker" || "$DEPLOY_MODE" == "docker-replica" ]]; then
  ROLLBACK_SNAPSHOT="$(jq -n \
    --arg mode "$DEPLOY_MODE" \
    --arg ref "$GIT_REF" \
    --arg from "$FROM_VERSION" \
    --arg compose "$COMPOSE_FILE" \
    --arg repo "$GITHUB_REPO" \
    --argjson useGit "$USE_GIT" \
    '{mode: $mode, gitRef: $ref, fromVersion: $from, composeFile: $compose, githubRepo: $repo, useGit: $useGit}')"
else
  ROLLBACK_SNAPSHOT="$(jq -n \
    --arg ref "$GIT_REF" \
    --arg from "$FROM_VERSION" \
    --arg repo "$GITHUB_REPO" \
    --argjson useGit "$USE_GIT" \
    '{mode: "native", gitRef: $ref, fromVersion: $from, githubRepo: $repo, useGit: $useGit}')"
fi

echo "$ROLLBACK_SNAPSHOT" > "$DATA_DIR/rollback-${JOB_ID}.json"
set_step snapshot completed "Snapshot saved (v${FROM_VERSION})"

set_step fetch running "Fetching $TARGET_TAG"
if [[ "$USE_GIT" -eq 1 ]]; then
  rm -f .git/index.lock
  if ! git remote get-url origin >/dev/null 2>&1; then
    git remote add origin "https://github.com/${GITHUB_REPO}.git"
  fi
  git fetch --tags --force origin
  git checkout "$TARGET_TAG"
else
  TMP_ARCHIVE="/tmp/pyorch-release-${JOB_ID}.tar.gz"
  download_release_archive "$TARGET_TAG" "$TMP_ARCHIVE"
  apply_release_archive "$TMP_ARCHIVE"
  rm -f "$TMP_ARCHIVE"
fi
set_step fetch completed "Checked out $TARGET_TAG"

TARGET_VER="${TARGET_TAG#v}"
ENV_FILE="$PROJECT_ROOT/.env"
if [[ -f "$ENV_FILE" ]]; then
  if grep -q '^APP_VERSION=' "$ENV_FILE"; then
    sed -i "s/^APP_VERSION=.*/APP_VERSION=${TARGET_VER}/" "$ENV_FILE"
  else
    printf '\nAPP_VERSION=%s\n' "$TARGET_VER" >> "$ENV_FILE"
  fi
else
  printf 'APP_VERSION=%s\n' "$TARGET_VER" > "$ENV_FILE"
fi

set_step deploy running "Rebuilding services"
if [[ "$DEPLOY_MODE" == "docker" || "$DEPLOY_MODE" == "docker-replica" ]]; then
  HOST_ROOT="${UPDATE_HOST_PROJECT_ROOT:-${PYORCH_HOST_PROJECT_ROOT:-}}"
  if [[ -z "$HOST_ROOT" || "$HOST_ROOT" == "/deploy" ]]; then
    echo "ERROR: Could not resolve host project path. Set UPDATE_HOST_PROJECT_ROOT or PYORCH_HOST_PROJECT_ROOT."
    exit 1
  fi
  export PYORCH_HOST_PROJECT_ROOT="$HOST_ROOT"
  export PYORCH_BUILD_ROOT="$PROJECT_ROOT"
  docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" pull --ignore-buildable 2>/dev/null || docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" pull || true
  docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" up -d --build --remove-orphans
else
  echo "Native deploy mode is not fully supported for PyOrchestrator"
  exit 1
fi
set_step deploy completed "Services restarted"

set_step health running "Waiting for health check"
if ! wait_for_health "$HEALTH_URL" 72 5; then
  set_step health failed "Health check timed out"
  JOB_STATUS="failed"
  do_rollback
  write_result "rolled_back" "Health check failed after update"
  exit 1
fi
set_step health completed "Application is healthy"

JOB_STATUS="completed"
write_progress "completed"
write_result "completed" ""
echo "Update to $TARGET_TAG completed successfully"
