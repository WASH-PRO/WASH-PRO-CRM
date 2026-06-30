# Участие в проекте

Спасибо за интерес к PyOrchestrator.

## Сообщения об ошибках

Создайте [Issue](https://github.com/PyOrchestrator/PyOrchestrator/issues) с описанием:

- Шаги воспроизведения
- Ожидаемое и фактическое поведение
- Версия (`APP_VERSION` из `.env` или `GET /health`)
- Вывод `docker compose ps` и релевантные логи (`docker compose logs <service>`)

## Pull Requests

1. Форкните репозиторий и создайте ветку от `main`
2. Следуйте стилю существующего кода (Python: async FastAPI; frontend: React + TypeScript + Tailwind)
3. Не включайте `.env`, секреты, `node_modules`, `__pycache__`
4. Обновите документацию в `docs/` и при необходимости `wiki/`, если меняется поведение или конфигурация
5. Убедитесь, что CI проходит (backend compile, frontend build, `docker compose build`)
6. Опишите изменения в PR

## Документация

Документация — Jekyll-сайт в папке `docs/`:

- Markdown-страницы с front matter (`layout: default`)
- Навигация в `docs/_config.yml` → `nav`
- Стили: `docs/assets/css/style.css`

После push в `main` GitHub Actions публикует сайт на Pages: https://pyorchestrator.github.io/PyOrchestrator/

Копия для GitHub Wiki: папка `wiki/`.

## Локальная разработка

```bash
cp .env.example .env
docker compose up --build

# Frontend hot-reload (опционально, вне Docker)
cd frontend && npm install && npm run dev

# Backend (опционально)
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload
```

Документация локально:

```bash
cd docs && bundle install && bundle exec jekyll serve
```

## Вопросы

См. [документацию](https://pyorchestrator.github.io/PyOrchestrator/) или создайте Issue.
