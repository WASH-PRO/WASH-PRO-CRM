# WASH-PRO-CRM overlays on vendored PyOrchestrator

This file is copied into `pyorchestrator/` by `apply-wash-patches.sh` on each
`./scripts/update-pyorchestrator.sh` run.

## Generic fixes (candidate for upstream PR)

See `patches/pyorchestrator-wash/upstream-contributions/README.md`.

| Fix | Status in this tree |
|-----|---------------------|
| `ScriptUpdate.code` updates entrypoint file | Applied |
| Delete script clears run notifications (FK) | Applied |
| Runtime Redis reconnect + resilient logging | Applied |

## WASH-only integration

- `metadata` on scripts (CRM Telegram bot flags)
- Embedded panel UI (`VITE_WASH_EMBEDDED`)
- Observability storage toggles
- Demo Telegram bot template in seed

After `./scripts/update-pyorchestrator.sh`, rebuild:

```bash
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build pyorch-backend pyorch-runtime pyorch-bridge
```
