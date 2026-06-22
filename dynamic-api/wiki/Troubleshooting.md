Full guide: [Troubleshooting](https://dynamic-api-platform.github.io/Dynamic-API-Platform/troubleshooting/)

## Port in use

Change ports in `docker-compose.yml`.

## API errors in frontend

Check `curl http://localhost:3001/api/health` and `CORS_ORIGIN`.

## Login fails

Default: `admin` / `Admin123!`. Check lockout in Settings.

## Reset all data

```bash
docker compose down -v
docker compose up -d
```
