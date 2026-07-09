# GitHub Releases — bilingual notes (EN / RU)

Release titles and bodies for [GitHub Releases](https://github.com/WASH-PRO/WASH-PRO-CRM/releases).

Each file: `vX.Y.Z.md` — used with `gh release edit`.

```bash
gh release edit v1.1.14 --title "$(head -1 releases/v1.1.14.md)" --notes-file releases/v1.1.14.md
```

Skip the first line (title) when using `--notes-file` — scripts should use `tail -n +3`.
