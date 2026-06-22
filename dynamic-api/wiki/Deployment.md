Full guide: [Deployment](https://dynamic-api-platform.github.io/Dynamic-API-Platform/deployment/)

## Production checklist

1. Change `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CSRF_SECRET`
2. Change admin password
3. Set `CORS_ORIGIN` to your domain
4. Use HTTPS (reverse proxy)
5. Don't expose MongoDB publicly
6. Disable registration if not needed

## Commands

```bash
docker compose up -d --build
docker compose logs -f backend
docker compose down -v  # removes data!
```
