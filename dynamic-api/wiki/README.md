# Wiki mirror (v1.5.13)

> This folder mirrors the GitHub Wiki content.  
> Push to `Dynamic-API-Platform/.github` wiki repo when releasing.

| Page | Description |
|------|-------------|
| [Home](Home.md) | Project overview, v1.5.x highlights |
| [Live UI](Live-UI.md) | Header Live badge — polling vs static data |
| [Software Updates](Software-Updates.md) | In-app updates from GitHub Releases |
| [UI Themes](Themes.md) | Dark, Light, Ocean, Forest |
| [Installation](Installation.md) | Prerequisites and install |
| [Quick Start Guide](Quick-Start-Guide.md) | First endpoint walkthrough |
| [Deployment](Deployment.md) | Production deployment |
| [Deployment Variants](Deployment-Variants.md) | Docker / replica set / K8s |
| [Configuration](Configuration.md) | Environment variables |
| [Architecture](Architecture.md) | System design |
| [API Reference](API-Reference.md) | Management REST API |
| [RBAC & Permissions](RBAC-and-Permissions.md) | Groups and permissions |
| [API Schema](API-Schema.md) | ER diagram |
| [Network Access](Network-Access.md) | Domain and IP rules |
| [Database Explorer](Database-Explorer.md) | Raw MongoDB UI |
| [Testing](Testing.md) | Unit and load tests |
| [Kubernetes](Kubernetes.md) | K8s manifests |
| [MongoDB Replica Set](MongoDB-Replica-Set.md) | 3-node Docker replica |
| [Screenshots](Screenshots.md) | UI gallery |
| [FAQ](FAQ.md) | Common questions |
| [Troubleshooting](Troubleshooting.md) | Problem solving |
| [Contributing](Contributing.md) | How to contribute |

## Sync command

```bash
git clone https://github.com/Dynamic-API-Platform/Dynamic-API-Platform.wiki.git /tmp/DAP-wiki
rsync -av --exclude README.md wiki/ /tmp/DAP-wiki/
cd /tmp/DAP-wiki
git add -A
git commit -m "docs: sync wiki with v1.5.13"
git push
```
