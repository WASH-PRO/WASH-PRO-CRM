#!/usr/bin/env bash
set -euo pipefail

ORG_LOGIN="Dynamic-API-Platform"
ORG_NAME="Dynamic API Platform"
REPO_NAME="Dynamic-API-Platform"
OLD_OWNER="Developer-RU"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
AVATAR_PATH="${AVATAR_PATH:-/tmp/dap-org-avatar.png}"
PROFILE_DIR="$SCRIPT_DIR/org-profile"

log() { printf '\n▸ %s\n' "$*"; }
die() { printf '\n✗ %s\n' "$*" >&2; exit 1; }

require_gh() {
  command -v gh >/dev/null 2>&1 || die "GitHub CLI (gh) is required."
  gh auth status >/dev/null 2>&1 || die "Run: gh auth login"
}

org_exists() {
  gh api "orgs/$ORG_LOGIN" --jq .login >/dev/null 2>&1
}

wait_for_org() {
  local attempts="${1:-30}"
  local delay="${2:-10}"
  log "Waiting for organization $ORG_LOGIN (up to $((attempts * delay))s)..."
  for ((i = 1; i <= attempts; i++)); do
    if org_exists; then
      log "Organization found."
      return 0
    fi
    sleep "$delay"
  done
  return 1
}

prepare_avatar() {
  local source="$PROJECT_DIR/docs/assets/org-logo.png"
  [[ -f "$source" ]] || die "Missing $source — add org logo first."
  sips -z 512 512 "$source" --out "$AVATAR_PATH" >/dev/null 2>&1 || cp "$source" "$AVATAR_PATH"
  log "Avatar prepared: $AVATAR_PATH ($(file -b "$AVATAR_PATH"))"
}

upload_avatar() {
  log "Uploading organization avatar..."
  local source="$PROJECT_DIR/docs/assets/org-logo.png"
  local token
  token="$(gh auth token)"
  local size response
  for size in 200 400 512; do
    sips -z "$size" "$size" "$source" --out "$AVATAR_PATH" >/dev/null 2>&1 || cp "$source" "$AVATAR_PATH"
    response="$(curl -sS -X POST \
      -H "Authorization: token $token" \
      -H "Accept: application/vnd.github+json" \
      -F "file=@$AVATAR_PATH;type=image/png" \
      "https://uploads.github.com/orgs/$ORG_LOGIN/assets/logo")"
    if echo "$response" | grep -q '"url"'; then
      log "Avatar uploaded (${size}x${size})."
      return 0
    fi
    log "Avatar upload ${size}x${size} rejected: $(echo "$response" | tr -d '\n')"
  done
  printf '%s\n' "$response" >&2
  log "Avatar upload failed — set logo manually: https://github.com/organizations/$ORG_LOGIN/settings/profile"
}

update_org_profile() {
  log "Updating organization profile metadata..."
  gh api -X PATCH "orgs/$ORG_LOGIN" \
    -f name="$ORG_NAME" \
    -f description="Open-source platform for creating, managing, and testing dynamic REST APIs without writing backend code." \
    -f blog="https://dynamic-api-platform.github.io/Dynamic-API-Platform/" \
    -f company="$ORG_NAME" \
    -f location="Global" >/dev/null
}

transfer_repo() {
  local current_owner
  current_owner="$(gh repo view "$OLD_OWNER/$REPO_NAME" --json owner --jq .owner.login 2>/dev/null || true)"
  if [[ "$current_owner" == "$ORG_LOGIN" ]]; then
    log "Repository already under $ORG_LOGIN."
    return 0
  fi
  log "Transferring $OLD_OWNER/$REPO_NAME → $ORG_LOGIN..."
  gh api -X POST "repos/$OLD_OWNER/$REPO_NAME/transfer" \
    -f new_owner="$ORG_LOGIN" >/dev/null
  log "Transfer initiated (may take a few seconds)."
  sleep 5
}

publish_org_readme() {
  log "Publishing organization profile README..."
  local tmp
  tmp="$(mktemp -d)"
  if gh repo view "$ORG_LOGIN/.github" >/dev/null 2>&1; then
    gh repo clone "$ORG_LOGIN/.github" "$tmp/.github" -- --depth=1
  else
    gh repo create "$ORG_LOGIN/.github" --public \
      --description "Dynamic API Platform organization profile"
    gh repo clone "$ORG_LOGIN/.github" "$tmp/.github" -- --depth=1
  fi
  mkdir -p "$tmp/.github/profile"
  cp "$PROFILE_DIR/profile/README.md" "$tmp/.github/profile/README.md"
  cp "$PROJECT_DIR/docs/assets/org-logo.png" "$tmp/.github/profile/org-logo.png" 2>/dev/null || true
  (
    cd "$tmp/.github"
    git add profile/README.md
    if [[ -f profile/org-logo.png ]]; then git add profile/org-logo.png; fi
    if git diff --cached --quiet; then
      log "Organization profile README unchanged."
    else
      git commit -m "docs: update organization profile README"
      git push origin HEAD
      log "Organization profile README published."
    fi
  )
  rm -rf "$tmp"
}

update_local_remote() {
  log "Updating local git remote..."
  (
    cd "$PROJECT_DIR"
    if git remote get-url origin >/dev/null 2>&1; then
      git remote set-url origin "https://github.com/$ORG_LOGIN/$REPO_NAME.git"
      log "origin → https://github.com/$ORG_LOGIN/$REPO_NAME.git"
    fi
  )
}

enable_pages() {
  log "Checking GitHub Pages source..."
  if gh api "repos/$ORG_LOGIN/$REPO_NAME/pages" >/dev/null 2>&1; then
    log "GitHub Pages already configured."
    return 0
  fi
  gh api -X POST "repos/$ORG_LOGIN/$REPO_NAME/pages" \
    -f source[branch]=main \
    -f source[path]=/docs >/dev/null 2>&1 || log "Configure Pages manually: Settings → Pages → /docs on main"
}

main() {
  require_gh

  if ! org_exists; then
    cat <<EOF

Organization "$ORG_LOGIN" does not exist yet.

Create it in the browser (required — GitHub has no public API for org creation):
  https://github.com/account/organizations/new

Suggested settings:
  • Organization name: $ORG_LOGIN
  • Contact email: your email
  • Plan: Free
  • Belongs to: Developer-RU (personal account)

Then re-run:
  ./scripts/setup-github-org.sh

Or wait automatically:
  ./scripts/setup-github-org.sh --wait

EOF
    if [[ "${1:-}" == "--wait" ]]; then
      wait_for_org || die "Timed out waiting for organization creation."
    else
      exit 1
    fi
  fi

  prepare_avatar
  upload_avatar
  update_org_profile
  transfer_repo
  publish_org_readme
  update_local_remote
  enable_pages

  cat <<EOF

✓ Setup complete

  Organization: https://github.com/$ORG_LOGIN
  Repository:   https://github.com/$ORG_LOGIN/$REPO_NAME
  Profile:      https://github.com/$ORG_LOGIN

EOF
}

main "$@"
