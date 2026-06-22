# Contributing to Dynamic API Platform

Thank you for your interest in contributing! This document explains how to get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [Pull Requests](#pull-requests)
- [Reporting Bugs](#reporting-bugs)

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting Started

### Prerequisites

- Docker & Docker Compose **or**
- Node.js 20+, npm, MongoDB 7+

### Quick setup

```bash
git clone https://github.com/Dynamic-API-Platform/Dynamic-API-Platform.git
cd Dynamic-API-Platform
cp .env.example .env
docker compose up -d
```

Open http://localhost:8080 and log in with `admin` / `Admin123!`.

### Local development (without Docker)

```bash
# Terminal 1 — MongoDB (or use Docker for MongoDB only)
docker run -d -p 27017:27017 mongo:7

# Terminal 2 — Backend
cd backend && npm install && npm run dev

# Terminal 3 — Frontend
cd frontend && npm install && npm run dev
```

## Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run builds:
   ```bash
   cd backend && npm run build
   cd ../frontend && npm run build
   ```
5. Commit with a clear message
6. Push and open a Pull Request

## Project Structure

```
backend/src/
  config/       Environment and database
  models/       Mongoose schemas
  repositories/ Data access layer
  services/     Business logic
  routes/       Express route handlers
  middleware/   Auth, RBAC, rate limit, errors
  dto/          Request/response types
  seed/         Initial data
  utils/        Shared helpers

frontend/src/
  components/   Reusable UI (Layout, SearchInput, Pagination…)
  pages/        Route pages
  services/     API client
  context/      Auth context
  types/        TypeScript interfaces
  utils/        Formatting, search helpers
```

## Coding Standards

### TypeScript
- Strict typing — avoid `any` unless unavoidable
- Match existing naming: `camelCase` for variables/functions, `PascalCase` for types/components
- Keep changes focused — one concern per PR

### Backend
- Business logic belongs in **services**, not routes
- Database access only through **repositories**
- New permissions must be added to `Permission` type and seed data
- Log significant actions via `logRepository`

### Frontend
- Reuse components from `components/UI.tsx`
- Use `SearchInput` for list filtering
- API calls only through `services/api.ts`

### Comments
- Comment non-obvious business logic only
- Do not add comments that restate the code

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add endpoint export to OpenAPI
fix: correct pagination on users page
docs: update deployment guide
chore: bump mongoose to 8.10
```

## Pull Requests

- Fill in the PR template completely
- Link related issues (`Fixes #123`)
- Ensure CI passes
- Update `CHANGELOG.md` under `[Unreleased]` for user-facing changes
- Add/update documentation in `docs/` if behavior changes

## Reporting Bugs

Use the [Bug Report issue template](.github/ISSUE_TEMPLATE/bug_report.yml). Include:

- Steps to reproduce
- Expected vs actual behavior
- Environment (OS, Docker version, browser)
- Relevant logs (no secrets!)

## Questions?

Open a [Discussion](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/discussions) or an issue with the `question` label.
