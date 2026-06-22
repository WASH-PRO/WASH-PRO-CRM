# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security issue, please report it privately:

1. Open a [GitHub Security Advisory](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/security/advisories/new), **or**
2. Email the maintainer via GitHub profile contact

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We aim to respond within **72 hours** and will keep you informed of the resolution timeline.

## Security Best Practices for Deployments

### Before production

1. **Change all default secrets** in `.env`:
   - `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CSRF_SECRET`
2. **Change default admin password** immediately after first login
3. **Disable registration** in Settings unless needed
4. **Use HTTPS** behind a reverse proxy (nginx, Traefik, Caddy)
5. **Restrict MongoDB** — do not expose port 27017 publicly
6. **Set strong `CORS_ORIGIN`** to your actual frontend domain
7. **Review rate limit settings** in Settings page and environment variables
8. **Enable log retention** and periodically review audit logs

### Default credentials (development only)

| Field    | Default     |
|----------|-------------|
| Login    | `admin`     |
| Password | `Admin123!` |

These are seeded on first run. **Never use in production without changing.**

### Authentication

- Passwords hashed with bcrypt (cost factor 12)
- JWT access tokens (short-lived) + refresh tokens (long-lived)
- Failed login lockout configurable per IP
- RBAC enforced on all management endpoints

### Known considerations

- Dynamic endpoints created as `public` are accessible without authentication
- CSRF protection is available via `/api/csrf-token` but cookie-based flows require HTTPS in production
- JWT expiry from Settings UI is stored in DB; server restart may still use env defaults for token generation until fully dynamic

## Security Updates

Security fixes will be released as patch versions (e.g. `1.0.1`) and documented in [CHANGELOG.md](CHANGELOG.md).
