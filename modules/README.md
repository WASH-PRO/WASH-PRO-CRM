**Language:** **English** · [Русский](README.ru.md)

# WASH PRO CRM Modules

System extensions from separate GitHub repositories, installed into `modules/installed/`.

| Path | Purpose |
|------|---------|
| `registry.json` | Available modules catalog (updated from the main CRM repo) |
| `installed/` | Installed modules (not committed to git) |

Each module includes `wash-module.json`, source code, UI (`ui/`), and gets a `data/` directory on install.

Documentation: [GitHub Pages — Modules](https://wash-pro.github.io/WASH-PRO-CRM/en/modules/).

Catalog: `registry.json`. Module icons without a GitHub repo live in `modules/icons/{id}.svg`, served via `/api/crm/modules/icon/{id}`.

Repositories: [post-occupancy](https://github.com/WASH-PRO/wash-module-post-occupancy), [usage-stats](https://github.com/WASH-PRO/wash-module-usage-stats), [starter](https://github.com/WASH-PRO/wash-module-starter), [vk-publisher](https://github.com/WASH-PRO/wash-module-vk-publisher) (v1.2.0 — **text only** to VK; images for CRM/Telegram), [washesnearby](https://github.com/WASH-PRO/wash-module-washesnearby).

## Localization

Same convention as the main CRM repo:

| File | Language |
|------|----------|
| `README.md` | English (default) |
| `README.ru.md` | Russian |
| `ui/help.html` | Help, English |
| `ui/help.ru.html` | Help, Russian |

The dashboard loads `help.html` or `help.ru.html` based on the selected UI language.
