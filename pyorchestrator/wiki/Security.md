## Аутентификация

- **JWT** (Bearer) для REST API и WebSocket
- Пароли: bcrypt-хеш в PostgreSQL
- Учётная запись admin по умолчанию создаётся при первом старте — **смените немедленно**

## RBAC

Встроенные роли с кодами прав (`scripts:read`, `scripts:write`, `scripts:run`, `schedules:write`, …).

Проверка на каждом endpoint через `require_permission()`.

## Секреты скриптов

- Шифрование AES-GCM с `SECRET_MASTER_KEY`
- В БД: `ciphertext` + `nonce`
- В runtime: переменные окружения `SECRET_{KEY}`
- **Никогда** не храните токены в исходном коде

## Внутренний API

Runtime и scheduler обращаются к backend через `X-Internal-Key: INTERNAL_API_KEY`.

Не публикуйте internal endpoints наружу.

## Изоляция sandbox

- Subprocess + rlimits (не полная VM-изоляция)
- Общая Docker-сеть (egress не фильтруется в v0.1)
- Для недоверенного кода рассмотрите network policies или отдельный пул runtime

## Рекомендации для production

1. Уникальные длинные секреты в `.env`
2. TLS для UI и API
3. Firewall: наружу только 443/80
4. Регулярные бэкапы PostgreSQL + MinIO
5. Аудит `audit_logs` (таблица есть, UI — в дорожной карте)
6. Отключите demo seed или смените учётные данные

## Сообщить об уязвимости

См. [SECURITY.md](https://github.com/PyOrchestrator/PyOrchestrator/blob/main/SECURITY.md) в корне репозитория.
