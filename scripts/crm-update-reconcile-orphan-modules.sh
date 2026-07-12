#!/usr/bin/env bash
# Remove module directories that exist on disk but are missing from _state.json (interrupted install).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/crm-update-compose-env.sh"

MODULES_ROOT="${WASH_HOST_PROJECT_ROOT:-$ROOT}/modules/installed"
STATE_FILE="$MODULES_ROOT/_state.json"

if [ ! -d "$MODULES_ROOT" ]; then
  echo "[reconcile-orphan-modules] No installed dir: $MODULES_ROOT"
  exit 0
fi

if [ ! -f "$STATE_FILE" ]; then
  echo "[reconcile-orphan-modules] No state file — skip"
  exit 0
fi

python3 - "$MODULES_ROOT" "$STATE_FILE" <<'PY'
import json, shutil, sys
from pathlib import Path

root = Path(sys.argv[1])
state_file = Path(sys.argv[2])
known = {m["id"] for m in json.loads(state_file.read_text()).get("modules", [])}
removed = 0
for child in root.iterdir():
    if not child.is_dir() or child.name.startswith("_"):
        continue
    if child.name in known:
        continue
    if not (child / "wash-module.json").is_file():
        continue
    shutil.rmtree(child)
    print(f"[reconcile-orphan-modules] Removed orphan: {child.name}")
    removed += 1
if removed == 0:
    print("[reconcile-orphan-modules] No orphan module directories found")
PY
