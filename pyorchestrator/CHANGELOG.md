# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.13] - 2026-07-07

### Changed

- Backend dependencies: uvicorn 0.49.0, alembic 1.18.5, python-jose 3.5.0, psutil 7.2.2 (runtime image aligned)
- Documentation, wiki, and release notes synced with current stack and dependency versions

[0.1.13]: https://github.com/PyOrchestrator/PyOrchestrator/releases/tag/v0.1.13

## [0.1.12] - 2026-07-07

### Fixed

- `PUT /scripts/{id}` with `code` now updates the entrypoint file in DB and object storage (parity with create)
- Script deletion removes related notifications before runs, fixing FK constraint errors (HTTP 500)
- Runtime reconnects to Redis after `ConnectionError`; log publishing tolerates transient Redis/backend failures

### Changed

- Backend: SQLAlchemy 2.0.51, Pydantic 2.13.4, pydantic-settings 2.14.2, redis 8.0.1, python-multipart 0.0.32
- Frontend: react-router-dom 7.18.1, @tailwindcss/vite 4.3.2
- CI: actions/checkout v7

[0.1.12]: https://github.com/PyOrchestrator/PyOrchestrator/releases/tag/v0.1.12

## [0.1.11] - 2026-06-30

### Added

- Optional Grafana observability: dashboard block shown only when Grafana is enabled and reachable
- Optional MinIO web console: `MINIO_CONSOLE_ENABLED` (off by default; S3 API on port 9000 always works)
- New settings: `GRAFANA_PUBLIC_URL`, `GRAFANA_INTERNAL_URL`, `MINIO_CONSOLE_PUBLIC_URL`

### Changed

- Grafana Observability panel on the dashboard is shown only when Grafana responds to a health check
- MinIO web console link in System info is optional (`MINIO_CONSOLE_ENABLED`, `MINIO_CONSOLE_PUBLIC_URL`)
- System page: storage bucket and MinIO status cards span full width when console is disabled
- Documentation, wiki, and GitHub Pages updated for OTA updates and optional observability/storage UI

[0.1.11]: https://github.com/PyOrchestrator/PyOrchestrator/releases/tag/v0.1.11

## [0.1.10] - 2026-06-30

### Changed

- GitHub OTA test release — install via Settings → Updates from GitHub Releases

[0.1.10]: https://github.com/PyOrchestrator/PyOrchestrator/releases/tag/v0.1.10

## [0.1.9] - 2026-06-30

### Changed

- Test release for OTA update verification

[0.1.9]: https://github.com/PyOrchestrator/PyOrchestrator/releases/tag/v0.1.9

## [0.1.8] - 2026-06-30

### Changed

- Test release for OTA update verification

[0.1.8]: https://github.com/PyOrchestrator/PyOrchestrator/releases/tag/v0.1.8

## [0.1.7] - 2026-06-30

### Fixed

- OTA self-update: correct Compose project name to avoid container name conflicts
- OTA self-update: bind mounts use `PYORCH_HOST_PROJECT_ROOT` for cross-platform host paths
- OTA self-update: split `PYORCH_BUILD_ROOT` vs `PYORCH_HOST_PROJECT_ROOT` for Docker Desktop Mac
- OTA self-update: auto-detect host project root from `/deploy` volume mount
- OTA self-update: sync `APP_VERSION` in `.env` after successful update

[0.1.7]: https://github.com/PyOrchestrator/PyOrchestrator/releases/tag/v0.1.7

## [0.1.6] - 2026-06-30

### Fixed

- OTA self-update: runtime build context path on Docker Desktop Mac

[0.1.6]: https://github.com/PyOrchestrator/PyOrchestrator/releases/tag/v0.1.6

## [0.1.5] - 2026-06-30

### Fixed

- OTA self-update: use host project root for bind mounts in updater container

[0.1.5]: https://github.com/PyOrchestrator/PyOrchestrator/releases/tag/v0.1.5

## [0.1.4] - 2026-06-30

### Fixed

- OTA self-update: Compose project name `-p pyorchestrator` flag

[0.1.4]: https://github.com/PyOrchestrator/PyOrchestrator/releases/tag/v0.1.4

## [0.1.3] - 2026-06-30

### Fixed

- OTA self-update: container name conflicts on re-deploy

[0.1.3]: https://github.com/PyOrchestrator/PyOrchestrator/releases/tag/v0.1.3

## [0.1.2] - 2026-06-30

### Changed

- OTA updates via GitHub Releases from Settings UI

[0.1.2]: https://github.com/PyOrchestrator/PyOrchestrator/releases/tag/v0.1.2

## [0.1.1] - 2026-06-27

### Added

- OTA update infrastructure (update executor, GitHub provider, Settings UI)

[0.1.1]: https://github.com/PyOrchestrator/PyOrchestrator/releases/tag/v0.1.1

## [0.1.0] - 2026-06-27

### Added

- Initial release: script orchestration platform with Docker Compose stack
- Script CRUD, Monaco editor, scheduler, webhooks, RBAC
- Runtime sandbox engine, MinIO workspaces, Prometheus/Grafana/Loki observability
- Vault for script secrets, notifications, backups

[0.1.0]: https://github.com/PyOrchestrator/PyOrchestrator/releases/tag/v0.1.0
