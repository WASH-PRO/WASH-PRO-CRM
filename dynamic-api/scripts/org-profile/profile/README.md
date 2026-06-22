<div align="center">

<img src="https://raw.githubusercontent.com/Dynamic-API-Platform/Dynamic-API-Platform/main/docs/banner.png" alt="Dynamic API Platform" width="100%" />

# Dynamic API Platform

**Open-source platform for creating, managing, and testing REST APIs without writing backend code.**

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/blob/main/LICENSE)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/blob/main/docker-compose.yml)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/blob/main/backend/package.json)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/blob/main/frontend/package.json)

[Documentation](https://dynamic-api-platform.github.io/Dynamic-API-Platform/) · [Quick Start](https://dynamic-api-platform.github.io/Dynamic-API-Platform/getting-started/) · [Main Repository](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform) · [Wiki](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/wiki)

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

---

## Flagship project

### [Dynamic-API-Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform)

The main repository — backend (Express + TypeScript), admin panel (React + Tailwind), Docker Compose deployment, and GitHub Pages docs.

```bash
git clone https://github.com/Dynamic-API-Platform/Dynamic-API-Platform.git
cd Dynamic-API-Platform
docker compose up -d
# Admin UI → http://localhost:8080
```

**Highlights**

| Capability | Description |
|------------|-------------|
| **Dynamic engine** | GET/POST/PUT/PATCH/DELETE routes defined in the UI |
| **`reference` fields** | Foreign keys between endpoints with `?populate=` |
| **Network access** | Restrict callers by domain and IP/CIDR pools |
| **Database Explorer** | Raw MongoDB admin UI for power users |
| **RBAC** | Permission-based groups for users and management API |
| **Zero downtime** | Route changes without restarting the server |

---

## Stack

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   React     │────▶│   Express   │────▶│   MongoDB   │
│  Admin UI   │     │  TypeScript │     │      7      │
└─────────────┘     └─────────────┘     └─────────────┘
```

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS  
- **Backend:** Node.js 20, Express, Mongoose, JWT  
- **Deploy:** Docker Compose, nginx, GitHub Actions CI  

---

## Documentation

| Resource | Link |
|----------|------|
| GitHub Pages | https://dynamic-api-platform.github.io/Dynamic-API-Platform/ |
| Getting Started | https://dynamic-api-platform.github.io/Dynamic-API-Platform/getting-started/ |
| Dynamic API Engine | https://dynamic-api-platform.github.io/Dynamic-API-Platform/dynamic-api-engine/ |
| Network Access | https://dynamic-api-platform.github.io/Dynamic-API-Platform/network-access/ |
| Wiki | https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/wiki |

---

## Get involved

- **Report bugs** — [Issues](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/issues)
- **Suggest features** — [Feature requests](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/issues/new?template=feature_request.yml)
- **Contribute** — see [CONTRIBUTING.md](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/blob/main/CONTRIBUTING.md)
- **Security** — private reports via [SECURITY.md](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/blob/main/SECURITY.md)

---

## License

Projects under this organization are open source under the **[Apache License 2.0](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/blob/main/LICENSE)** unless stated otherwise.

---

<div align="center">

**Build APIs at the speed of configuration.**

<sub>Maintained by the Dynamic API Platform community.</sub>

</div>
