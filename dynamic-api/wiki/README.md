# Dynamic API Platform Wiki

> This folder mirrors the GitHub Wiki content.  
> Full documentation is also available on [GitHub Pages](https://dynamic-api-platform.github.io/Dynamic-API-Platform/).

## Pages

| Wiki Page | Description |
|-----------|-------------|
| [Home](Home.md) | Project overview |
| [Installation](Installation.md) | Setup guide |
| [Quick-Start-Guide](Quick-Start-Guide.md) | First endpoint in 5 minutes |
| [Architecture](Architecture.md) | System design |
| [API-Reference](API-Reference.md) | REST API docs |
| [RBAC-and-Permissions](RBAC-and-Permissions.md) | Access control |
| [Dynamic-API-Engine](Dynamic-API-Engine.md) | Runtime engine |
| [Deployment](Deployment.md) | Production deploy |
| [Configuration](Configuration.md) | Env vars & settings |
| [FAQ](FAQ.md) | Common questions |
| [Troubleshooting](Troubleshooting.md) | Problem solving |
| [Screenshots](Screenshots.md) | UI gallery |
| [Contributing](Contributing.md) | How to contribute |

## Importing to GitHub Wiki

```bash
# Clone wiki repo (after creating first wiki page on GitHub)
git clone https://github.com/Dynamic-API-Platform/Dynamic-API-Platform.wiki.git
cp wiki/*.md Dynamic-API-Platform.wiki/
cd Dynamic-API-Platform.wiki
git add . && git commit -m "docs: import wiki pages" && git push
```

Or copy pages manually via GitHub Wiki web editor.
