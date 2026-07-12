# GitHub Releases — bilingual notes (EN / RU)

Release titles and bodies for [GitHub Releases](https://github.com/WASH-PRO/WASH-PRO-CRM/releases).

Each file: `vX.Y.Z.md` — used with `gh release create` / `gh release edit`.

```bash
gh release edit v1.1.40 --title "$(head -1 releases/v1.1.40.md)" --notes-file releases/v1.1.40.md
```

## Policy — create only recent releases

- **Publish GitHub Releases only for the latest patch** (and optionally the previous one if users may still be upgrading).
- **Do not backfill** old tags (`v1.1.10`, `v1.1.20`, …) — they clutter the releases page and confuse auto-update.
- **CHANGELOG.md** remains the full history; `releases/v*.md` files are templates for **new** tags only.
- When cutting a new version, add **one** file `releases/vX.Y.Z.md`; older release note files in git are archival — no need to create matching GitHub Release retroactively.
- After bumping `dashboard/package.json`, run `./scripts/sync-version-docs.sh` (badges, `.env.example`, `docs/_data/version.yml`) and update README/wiki feature lists.

## Bilingual format

Each `vX.Y.Z.md` starts with a one-line title, then `---`, then **English** and **Русский** sections.

Skip the first line (title) when using `--notes-file` — scripts should use `tail -n +3` if the title is duplicated in the body.
