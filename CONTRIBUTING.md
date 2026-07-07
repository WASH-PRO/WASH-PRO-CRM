# Участие в проекте

Спасибо за интерес к WASH PRO CRM.

## Сообщения об ошибках

Создайте [Issue](https://github.com/WASH-PRO/WASH-PRO-CRM/issues) с описанием:

- Шаги воспроизведения
- Ожидаемое и фактическое поведение
- Версия (`APP_VERSION` из `.env`)
- Вывод `docker compose ps` и релевантные логи (`docker logs <container>`)

## Pull Requests

1. Форкните репозиторий и создайте ветку от `main`
2. Следуйте стилю существующего кода
3. Не включайте `.env`, секреты и `node_modules`
4. Обновите документацию в `docs/` и зеркало `wiki/`, если меняется поведение или конфигурация (в т.ч. [setup-wizard.md](docs/setup-wizard.md))
5. Опишите изменения в PR

## Документация

Документация — Jekyll-сайт в папке `docs/`:

- Markdown-страницы с front matter (`layout: default`)
- Навигация в `docs/_config.yml` → `nav`
- Стили и гамбургер-меню: `docs/assets/`

После push в `main` GitHub Actions публикует сайт на Pages.

## Локальная разработка

```bash
# Dashboard
cd dashboard && npm install && npm run dev

# Пересборка Docker
docker compose up -d --build

# Повторная инициализация CRM
./scripts/run-init-seed.sh
```

## Вопросы

Для вопросов по развёртыванию см. [документацию](docs/getting-started.md) или создайте Issue.
