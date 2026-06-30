# Organization profile (`Dynamic-API-Platform/.github`)

GitHub shows `profile/README.md` from the **`.github`** repository on the [organization page](https://github.com/Dynamic-API-Platform).

## Source of truth (in main repo)

Edit: `scripts/org-profile/profile/README.md`

## Publish to GitHub

```bash
git clone https://github.com/Dynamic-API-Platform/.github.git /tmp/DAP-dotgithub
cp scripts/org-profile/profile/README.md /tmp/DAP-dotgithub/profile/README.md
cd /tmp/DAP-dotgithub
git add profile/README.md
git commit -m "docs: sync org profile for v1.5.13"
git push
```

## Organization metadata (GitHub API)

```bash
gh api -X PATCH orgs/Dynamic-API-Platform \
  -f description='Open-source dynamic REST API platform — admin UI, MCP auth, MongoDB, in-app software updates, cron/webhooks/MCP, Docker & Kubernetes (v1.5.13)' \
  -f blog='https://dynamic-api-platform.github.io/Dynamic-API-Platform/'
```
