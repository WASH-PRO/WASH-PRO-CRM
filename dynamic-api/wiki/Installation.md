## Docker (recommended)

```bash
git clone https://github.com/Dynamic-API-Platform/Dynamic-API-Platform.git
cd Dynamic-API-Platform
cp .env.example .env
docker compose up -d
```

Open http://localhost:8080

## Requirements

- Docker 24+ & Docker Compose v2
- Or: Node.js 20+, MongoDB 7+

## Verify

```bash
docker compose ps
curl http://localhost:3001/api/health
```

## Local development

```bash
docker run -d -p 27017:27017 mongo:7
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

See full guide: [docs/getting-started.md](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform/blob/main/docs/getting-started.md)
