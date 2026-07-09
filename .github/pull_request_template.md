## Summary

<!-- Кратко: что меняется и зачем. Связанные Issues: Fixes #123, Closes #456 -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation
- [ ] Refactoring / chore

## Changes

<!-- Основные изменения по областям (отметьте затронутое) -->

- [ ] Dashboard (`dashboard/`)
- [ ] Dynamic API / CRM endpoints (`dynamic-api/`, `services/init-seed/`)
- [ ] Message processor / MQTT (`services/message-processor/`)
- [ ] Telegram / pyorch-bridge (`services/pyorch-bridge/`)
- [ ] PyOrchestrator (`pyorchestrator/`, `docker-compose.pyorchestrator.yml`)
- [ ] Docker / scripts / CI (`.github/`, `scripts/`, `docker-compose*.yml`)
- [ ] Docs / wiki (`docs/`, `wiki/`)

## Test plan

<!-- Как проверить изменения -->

- [ ] `cd dashboard && npm run build` *(если менялся Dashboard)*
- [ ] `cd services/pyorch-bridge && npm run build` *(если менялись Telegram-боты)*
- [ ] `docker compose up -d --build` *(если менялись контейнеры)*
- [ ] `./scripts/run-init-seed.sh` *(если менялись CRM endpoints / RBAC)*
- [ ] Ручная проверка:
  1. ...
  2. ...

## Checklist

- [ ] Код следует стилю существующего проекта
- [ ] [CHANGELOG.md](../CHANGELOG.md) обновлён *(если изменение видно пользователю)*
- [ ] Документация обновлена в `docs/` и зеркале `wiki/` *(если меняется поведение или конфигурация)*
- [ ] i18n обновлён в `dashboard/src/i18n/messages/` *(если менялись строки UI)*
- [ ] Секреты, `.env` и токены **не** включены в коммит
- [ ] Security-sensitive изменения описаны или согласованы ([SECURITY.md](../SECURITY.md))
