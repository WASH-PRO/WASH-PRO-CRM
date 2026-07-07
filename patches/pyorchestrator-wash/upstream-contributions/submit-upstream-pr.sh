#!/usr/bin/env bash
# Push generic PyOrchestrator fixes upstream (fork → branch → PR).
# Idempotent: safe to re-run if branch/PR already exist.
# Usage: ./patches/pyorchestrator-wash/upstream-contributions/submit-upstream-pr.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PATCH_DIR="$ROOT/patches/pyorchestrator-wash"
UPSTREAM_REF="${PYORCHESTRATOR_REF:-v0.1.11}"
BRANCH="fix/script-update-runtime-resilience"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI required: https://cli.github.com/" >&2
  exit 1
fi

OWNER="$(gh api user --jq .login)"

existing_pr() {
  gh pr list --repo PyOrchestrator/PyOrchestrator --head "${OWNER}:${BRANCH}" \
    --json url --jq '.[0].url // empty' 2>/dev/null || true
}

if PR_URL="$(existing_pr)"; [ -n "$PR_URL" ]; then
  echo "==> Pull request already exists"
  echo "$PR_URL"
  echo "==> Done"
  exit 0
fi

echo "==> Fork and clone PyOrchestrator"
gh repo fork PyOrchestrator/PyOrchestrator --clone -- "$WORKDIR/PyOrchestrator"
cd "$WORKDIR/PyOrchestrator"
git fetch origin "$BRANCH" 2>/dev/null || true

if git show-ref --verify --quiet "refs/remotes/origin/${BRANCH}"; then
  echo "==> Reuse existing fork branch ${BRANCH}"
  git checkout -B "$BRANCH" "origin/${BRANCH}"
else
  echo "==> Create branch ${BRANCH} from ${UPSTREAM_REF}"
  git checkout -b "$BRANCH" "$UPSTREAM_REF"
fi

patches_applied=0

if ! grep -q 'code = update_data.pop' backend/app/api/v1/scripts.py 2>/dev/null; then
  echo "    Applying script-update-code.patch"
  patch -p1 --no-backup-if-mismatch < "$PATCH_DIR/script-update-code.patch"
  patches_applied=1
else
  echo "    script-update-code.patch already applied"
fi

if ! grep -q 'NotificationDismissal' backend/app/services/script_service.py 2>/dev/null; then
  echo "    Applying delete-script-notifications.patch"
  patch -p1 --no-backup-if-mismatch < "$PATCH_DIR/delete-script-notifications.patch"
  patches_applied=1
else
  echo "    delete-script-notifications.patch already applied"
fi

if ! grep -q 'create_redis_client' runtime/engine/main.py 2>/dev/null; then
  echo "    Applying runtime-redis-reconnect.patch"
  patch -p1 --no-backup-if-mismatch < "$PATCH_DIR/runtime-redis-reconnect.patch"
  patches_applied=1
else
  echo "    runtime-redis-reconnect.patch already applied"
fi

find . -name '*.orig' -delete

if [ "$patches_applied" -eq 1 ]; then
  git add -A
  if git diff --cached --quiet; then
    echo "==> No changes to commit"
  else
    git commit -m "$(cat <<'EOF'
fix: script code updates, delete FK cascade, runtime Redis reconnect

- ScriptUpdate.code now updates entrypoint file (parity with ScriptCreate)
- Delete notifications before runs when removing a script
- Runtime reconnects to Redis after connection loss; resilient log publishing
EOF
)"
  fi
fi

echo "==> Push branch"
if git push -u origin "$BRANCH" 2>/dev/null; then
  :
elif git show-ref --verify --quiet "refs/remotes/origin/${BRANCH}"; then
  echo "    Remote branch already up to date or diverged; using existing remote branch"
  git fetch origin "$BRANCH"
  git checkout -B "$BRANCH" "origin/${BRANCH}"
else
  echo "ERROR: git push failed" >&2
  exit 1
fi

echo "==> Create pull request"
if PR_URL="$(existing_pr)"; [ -n "$PR_URL" ]; then
  echo "$PR_URL"
else
  pr_out=""
  if ! pr_out="$(gh pr create --repo PyOrchestrator/PyOrchestrator \
    --head "${OWNER}:${BRANCH}" \
    --title "fix: script code updates, delete FK cascade, runtime Redis reconnect" \
    --body "$(cat <<'EOF'
## Summary
- **ScriptUpdate.code**: `PUT /scripts/{id}` with `code` now updates the entrypoint file in DB and object storage (same behavior as create).
- **Delete script**: remove `Notification` / `NotificationDismissal` rows for script runs before deleting runs (fixes 500 on script delete).
- **Runtime**: reconnect to Redis after `ConnectionError`; do not fail runs when log publish to Redis/backend fails transiently.

## Motivation
Found while integrating PyOrchestrator with WASH PRO CRM (Telegram bots):
1. Updating bot code via API silently ignored `code` on PUT — only create worked.
2. Deleting scripts with notification history returned FK constraint errors.
3. Runtime stopped dequeuing jobs after Redis restarts.

## Test plan
- [ ] Create script with `code`, PUT with new `code`, verify file content updated via `GET /scripts/{id}/files`
- [ ] Create script, run it, generate notification, delete script — no 500
- [ ] Restart Redis during active long-running script — runtime reconnects and continues
EOF
)" 2>&1)"; then
    if echo "$pr_out" | grep -qE 'already exists|https://github.com/'; then
      PR_URL="$(existing_pr)"
      if [ -z "$PR_URL" ]; then
        echo "$pr_out" | grep -oE 'https://github.com/[^ ]+' | head -1
      else
        echo "$PR_URL"
      fi
    else
      echo "$pr_out" >&2
      exit 1
    fi
  else
    echo "$pr_out"
  fi
fi

echo "==> Done"
