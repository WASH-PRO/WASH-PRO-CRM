# PyOrchestrator upstream contributions (WASH-PRO-CRM)

Patches in this folder are **generic bug fixes / reliability improvements** suitable for
[PyOrchestrator/PyOrchestrator](https://github.com/PyOrchestrator/PyOrchestrator).
They are also applied automatically by `../apply-wash-patches.sh` after each
`./scripts/update-pyorchestrator.sh` run.

## Patches

| Patch | Problem | Files |
|-------|---------|-------|
| `../script-update-code.patch` | `ScriptCreate` accepts `code`, but `ScriptUpdate` ignored it — entrypoint file never updated on PUT | `schemas`, `scripts.py` |
| `../delete-script-notifications.patch` | Deleting a script with run notifications fails with FK violation | `script_service.py` |
| `../runtime-redis-reconnect.patch` | Runtime dies or stalls when Redis restarts; log publish errors abort runs | `runtime/engine/main.py` |

Tested against upstream **v0.1.11**.

## Open a PR upstream

```bash
# 1. Fork PyOrchestrator on GitHub, then:
git clone https://github.com/YOUR_USER/PyOrchestrator.git
cd PyOrchestrator
git checkout -b fix/script-update-and-runtime-resilience v0.1.11

# 2. Apply patches (from WASH-PRO-CRM checkout)
PO_WASH=/path/to/WASH-PRO-CRM/patches/pyorchestrator-wash
patch -p1 < "$PO_WASH/script-update-code.patch"
patch -p1 < "$PO_WASH/delete-script-notifications.patch"
patch -p1 < "$PO_WASH/runtime-redis-reconnect.patch"

# 3. Commit and push
git add -A
git commit -m "$(cat <<'EOF'
fix: script code updates, delete FK cascade, runtime Redis reconnect

- ScriptUpdate.code now updates entrypoint file (parity with ScriptCreate)
- Delete notifications before runs when removing a script
- Runtime reconnects to Redis after connection loss; resilient log publishing
EOF
)"
git push -u origin fix/script-update-and-runtime-resilience

# 4. Create PR
gh pr create --repo PyOrchestrator/PyOrchestrator \
  --title "fix: script code updates, delete FK cascade, runtime Redis reconnect" \
  --body "$(cat <<'EOF'
## Summary
- **ScriptUpdate.code**: `PUT /scripts/{id}` with `code` now updates the entrypoint file in DB and object storage (same behavior as create).
- **Delete script**: remove `Notification` / `NotificationDismissal` rows for script runs before deleting runs (fixes 500 on script delete).
- **Runtime**: reconnect to Redis after `ConnectionError`; do not fail runs when log publish to Redis/backend fails transiently.

## Test plan
- [ ] Create script with `code`, PUT same endpoint with new `code`, verify `GET .../files` shows updated content
- [ ] Create script, run it, trigger notification, delete script — no FK error
- [ ] Restart Redis while a long-running bot script is active — runtime recovers and continues dequeuing jobs
EOF
)"
```

After upstream merges, remove duplicate logic from WASH patches if identical, or keep idempotent checks until vendored version includes the fix.
