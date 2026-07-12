> **English** · **[Русский](ru-Modules)** · [← Wiki](Home)

# Modules

Full documentation: [GitHub Pages — Modules](https://wash-pro.github.io/WASH-PRO-CRM/en/modules/)

## Summary

| Topic | Details |
|-------|---------|
| **CRM menu** | **Automation → Modules** (`/modules`) |
| **Catalog** | `modules/registry.json` in the CRM repo |
| **Bridge** | `modules-bridge:3024` → `/api/crm/modules/` |
| **Runtime** | PyOrchestrator daemon + `http://dynamic-api:3001` |

## Quick start

1. **Dashboard → Automation → Modules**
2. **Install** from the Available section
3. Enable PyOrch: `PYORCHESTRATOR_ENABLED=true ./scripts/start.sh`
4. **Start** → **Settings** (module UI in iframe)

## Repositories

| Module | GitHub |
|--------|--------|
| Post occupancy | [wash-module-post-occupancy](https://github.com/WASH-PRO/wash-module-post-occupancy) |
| Usage stats | [wash-module-usage-stats](https://github.com/WASH-PRO/wash-module-usage-stats) |
| VK Publisher | Text from **Publications** → VK wall (no images) | [wash-module-vk-publisher](https://github.com/WASH-PRO/wash-module-vk-publisher) |

## VK Publisher *(v1.1.42)*

- VK posts are **text only** (title + body, HTML stripped)
- `imageUrl` is for CRM and the information Telegram bot — **not sent to VK**
- **Community** access key (`wall`, `groups`); `photos` scope not required
- Module help: **Help** tab on the module settings page

## Custom module

```bash
git clone https://github.com/WASH-PRO/wash-module-starter my-module
```

Required files: `wash-module.json`, `src/main.py`, `ui/index.html`.

Add an entry to CRM `modules/registry.json` and push.

## Safari & repair *(v1.1.33)*

Safari JWT fix in v1.1.33+. If the page still fails, use **Settings → Integrity repair** to rebuild `modules-bridge` without SSH.

## Notifications *(v1.1.34)*

Module install/start/stop/update events appear in **System → Notifications**.

See [Embedded-Services](en-Embedded-Services), [Telegram](en-Telegram), [Dashboard](en-Dashboard).
