.PHONY: up down build logs ps health

up:
	cp -n .env.example .env 2>/dev/null || true
	docker compose up --build -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

ps:
	docker compose ps

health:
	@curl -sf http://localhost:8000/health | python3 -m json.tool
	@curl -sf http://localhost:9091/health 2>/dev/null || echo "runtime: starting..."
	@curl -sf http://localhost:9092/health 2>/dev/null || echo "scheduler: starting..."
