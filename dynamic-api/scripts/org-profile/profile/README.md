<div align="center">

<img src="https://raw.githubusercontent.com/Dynamic-API-Platform/Dynamic-API-Platform/main/docs/banner.png" alt="Dynamic API Platform" width="100%" />

# Dynamic API Platform

**Open-source platform for creating, managing, and testing REST APIs without writing backend code.**

[![Release](https://img.shields.io/github/v/release/Dynamic-API-Platform/Dynamic-API-Platform?label=v1.5.13)](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/releases/tag/v1.5.13)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/blob/main/LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/blob/main/docker-compose.yml)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-manifests-326CE5?logo=kubernetes&logoColor=white)](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/tree/main/k8s)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/blob/main/backend/package.json)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/blob/main/frontend/package.json)

[Documentation](https://dynamic-api-platform.github.io/Dynamic-API-Platform/) · [Quick Start](https://dynamic-api-platform.github.io/Dynamic-API-Platform/getting-started/) · [Main Repository](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform) · [Wiki](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/wiki) · [Releases](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/releases)

</div>

---

## About

**Dynamic API Platform** is a full-stack, self-hosted product for teams who need REST APIs that evolve as fast as their ideas.

Endpoints are stored in **MongoDB** and served by a **runtime engine** — save a route in the admin panel and call it immediately. No server restart. No redeploy. No boilerplate controllers.

We built this organization to host the core platform, documentation, and community resources around that idea: **APIs as configuration, not ceremony.**

---

## Why we exist

| Problem | Our approach |
|---------|----------------|
| New APIs require code changes and redeploys | Endpoints are live the moment you save them |
| Headless CMS tools are heavy for simple REST | Focused engine: schemas, access control, CRUD |
| Prototypes stall on backend scaffolding | UI-first endpoint builder + built-in tester |
| Security is bolted on late | JWT, RBAC, network access rules, audit logs from day one |
| Production needs HA and scale | Docker replica set or Kubernetes manifests included |

---

## Flagship project

### [Dynamic-API-Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform)

Backend (Express + TypeScript), admin panel (React + Tailwind), three deployment options, GitHub Pages docs.

```bash
git clone https://github.com/Dynamic-API-Platform/Dynamic-API-Platform.git
cd Dynamic-API-Platform
docker compose up -d
# Admin UI → http://localhost:8080  (admin / Admin123!)
```

**Deployment options**

| Variant | Command |
|---------|---------|
| Docker (single) | `docker compose up -d` |
| MongoDB replica set | `docker compose -f docker-compose.replica.yml up -d` |
| Kubernetes | `./k8s/scripts/deploy.sh` |

[Full comparison →](https://dynamic-api-platform.github.io/Dynamic-API-Platform/deployment-variants/)

**Highlights**

| Capability | Description |
|------------|-------------|
| **Dynamic engine** | GET/POST/PUT/PATCH/DELETE routes defined in the UI |
| **Data retention** | Optional per-endpoint TTL in days — or keep data forever |
| **Editable path** | Change route path after creation; data migrates automatically |
| **`reference` fields** | Foreign keys between endpoints with `?populate=` |
| **Automation** | Cron, webhooks, API keys, **MCP server** for AI agents |
| **Network access** | Restrict callers by domain and IP/CIDR pools |
| **Database Explorer** | Raw MongoDB admin UI for power users |
| **RBAC** | Permission-based groups for users and management API |
| **Software updates** | In-app updates from GitHub Releases (Docker, out of the box; v1.5.11 host-path fix) |
| **Deployment** | Docker, MongoDB replica set, Kubernetes |
| **Testing** | Vitest (38 tests), load test, GitHub Actions CI |
| **UI themes** | Dark, Light, Ocean, Forest color schemes |
| **Live UI** | Header badge — auto-refresh or static data pages |

<p align="center">
  <img src="https://raw.githubusercontent.com/Dynamic-API-Platform/Dynamic-API-Platform/main/docs/screenshots/dashboard.png" alt="Dashboard" width="720" />
</p>

---

## Stack

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   React     │────▶│   Express   │────▶│   MongoDB   │
│  Admin UI   │     │  TypeScript │     │  7 / rs0    │
└─────────────┘     └─────────────┘     └─────────────┘
```

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS  
- **Backend:** Node.js 20, Express, Mongoose, JWT  
- **Deploy:** Docker Compose, MongoDB replica set, Kubernetes (`k8s/`), GitHub Actions CI  

---

## Documentation

| Resource | Link |
|----------|------|
| GitHub Pages | https://dynamic-api-platform.github.io/Dynamic-API-Platform/ |
| Getting Started | https://dynamic-api-platform.github.io/Dynamic-API-Platform/getting-started/ |
| Deployment Variants | https://dynamic-api-platform.github.io/Dynamic-API-Platform/deployment-variants/ |
| Automation & MCP | https://dynamic-api-platform.github.io/Dynamic-API-Platform/automation/ |
| Testing | https://dynamic-api-platform.github.io/Dynamic-API-Platform/testing/ |
| Kubernetes | https://dynamic-api-platform.github.io/Dynamic-API-Platform/kubernetes/ |
| Software Updates | https://dynamic-api-platform.github.io/Dynamic-API-Platform/updates/ |
| Live UI | https://dynamic-api-platform.github.io/Dynamic-API-Platform/live-ui/ |
| Wiki | https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/wiki |

---

## Get involved

- **Report bugs** — [Issues](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/issues)
- **Suggest features** — [Feature requests](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/issues/new?template=feature_request.yml)
- **Contribute** — [CONTRIBUTING.md](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/blob/main/CONTRIBUTING.md)
- **Security** — [SECURITY.md](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/blob/main/SECURITY.md)

---

## License

Projects under this organization are open source under the **[Apache License 2.0](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/blob/main/LICENSE)** unless stated otherwise.

---

<div align="center">

**Build APIs at the speed of configuration.**

<sub>Maintained by the Dynamic API Platform community · <a href="https://github.com/Dynamic-API-Platform">Dynamic-API-Platform</a></sub>

</div>
