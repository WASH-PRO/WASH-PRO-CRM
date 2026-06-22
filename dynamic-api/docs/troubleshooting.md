---
layout: default
redirect_from:
  - /troubleshooting.html

title: Troubleshooting
---

## Docker

### Containers not starting

```bash
docker compose ps
docker compose logs backend
docker compose logs mongodb
```

**MongoDB not healthy:** Wait 30s for first start. Check port 27017 not in use.

**Backend unhealthy:** Verify `wget` can reach `http://localhost:3001/api/health` inside container.

### Port already in use

```
Error: bind: address already in use
```

Change ports in `docker-compose.yml`:

```yaml
frontend:
  ports:
    - "8090:80"   # was 8080
backend:
  ports:
    - "3002:3001" # was 3001
```

Update `CORS_ORIGIN` accordingly.

### Frontend shows API errors / blank after login

- Ensure `VITE_API_URL` build arg is `""` in Docker (uses nginx proxy)
- Check backend is healthy: `curl http://localhost:3001/api/health`
- Check browser console for CORS errors → fix `CORS_ORIGIN`

---

## Authentication

### "Session expired" immediately

- Check JWT secrets haven't changed between restarts (invalidates tokens)
- Clear localStorage and log in again
- Verify system clock is correct
- After token refresh, permissions must be present in the JWT — update to the latest backend image if APIs return 403 right after idle time

### Dashboard shows "Failed to load dashboard" instead of login

This was a known issue when the access token expired. Current builds redirect to `/login` automatically. Rebuild Docker images if you run an older container:

```bash
docker compose build --no-cache && docker compose up -d
```

Clear browser cache / hard refresh after redeploy.

### Login returns 401

- Default credentials: `admin` / `Admin123!`
- Check if IP is locked out (wait lockout duration or restart backend)
- Check `ADMIN_PASSWORD` env matches what you're using (only applies to seeded admin)

### Registration returns 403

Registration disabled in Settings. Enable or create users via admin panel.

---

## Endpoints

### Dynamic endpoint returns 404

1. Endpoint exists and `enabled: true`
2. Path matches exactly (check trailing slashes)
3. HTTP method matches definition
4. Backend was not restarted needed — changes are immediate from DB

### Validation errors on POST

Request body doesn't match schema. Check required fields and types in endpoint editor.

### GET returns empty array

No data created yet. POST a record first.

### Built-in test returns "Forbidden: insufficient group permissions" on `/api/users`

System endpoints (`/api/users`, `/api/groups`, `/api/profile`) are **management APIs** with RBAC — not dynamic CRUD routes. Older builds tested them through the dynamic engine incorrectly. Update to the latest backend; the tester now calls the real routes. Ensure your user has `manage_users` or `view` permission.

### Reference field validation fails on POST

The value must be a valid **record ID** from the linked endpoint's collection. Create the target record first (e.g. a category), then pass its `id` in the reference field (e.g. `categoryId`).

### Database page not visible or returns 403

The **Database** menu item requires **`manage_users`** permission. Assign user to Admin or Super Admin group. Direct URL: `/database`.

### Forbidden: network access denied

Dynamic endpoint has **Network access** enabled and the request did not match any allowed domain or IP rule.

1. Open the endpoint (or its group) → **Network Access** tab/section
2. Add your client domain (e.g. `localhost` or `app.example.com`) and/or IP (e.g. `127.0.0.1`)
3. If the endpoint inherits group rules, check the parent **Endpoint Group** rules too
4. Behind a reverse proxy, ensure `X-Forwarded-For` is set correctly
5. Browser calls need a matching `Origin`/`Referer` for domain rules; server clients rely on IP rules

See [Network Access]({{ '/network-access/' | relative_url }}).

---

## Database

### Reset everything

```bash
docker compose down -v
docker compose up -d
```

This deletes all data and re-seeds on startup.

### Connection refused to MongoDB

Local dev: ensure MongoDB running on `localhost:27017`.

Docker: use `mongodb://mongodb:27017/dynamic_api` (service name, not localhost).

---

## Build errors

### Backend TypeScript errors

```bash
cd backend && rm -rf dist && npm run build
```

### Frontend build fails

```bash
cd frontend && rm -rf dist node_modules && npm install && npm run build
```

---

## Performance

### Slow with many records

- EndpointData queries use pagination — ensure clients pass `page` and `limit`
- Add MongoDB indexes if scaling beyond thousands of records per endpoint
- Review rate limit settings if legitimate traffic is throttled

---

## Getting help

1. Check [FAQ](faq.md)
2. Search [GitHub Issues](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/issues)
3. Open a new issue with logs and reproduction steps (no secrets!)
