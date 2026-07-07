# Постоянные данные WASH PRO CRM

Все базы, бэкапы и runtime-данные сервисов хранятся **на диске хоста** в этом каталоге (bind mount), а не в анонимных Docker volumes.

Пересборка образов (`docker compose up -d --build`) **не удаляет** эти файлы.  
`docker compose down` **без** флага `-v` тоже безопасен.

## Расположение

По умолчанию: `./data` в корне репозитория.  
Чтобы вынести данные за пределы проекта (рекомендуется на production):

```bash
# в .env
DATA_DIR=/var/lib/wash-pro-crm
```

После смены `DATA_DIR` выполните миграцию из старых volumes: `./scripts/migrate-volumes-to-data.sh`

## Структура

| Путь | Сервис | Содержимое |
|------|--------|------------|
| `mongodb/` | MongoDB | CRM, Dynamic API (endpoint data, users, …) |
| `mosquitto/data/` | Mosquitto | MQTT persistence |
| `mosquitto/config/` | Mosquitto | `passwd`, `acl`, `mosquitto.conf` (генерируется init + sync) |
| `redis/` | Redis *(опц.)* | Кеш message-processor |
| `backups/` | backup | Архивы `mongodump` |
| `dynamic-api/logs/` | dynamic-api | Логи API |
| `pyorchestrator/postgres/` | PyOrchestrator | PostgreSQL |
| `pyorchestrator/redis/` | PyOrchestrator | Redis |
| `pyorchestrator/minio/` | PyOrchestrator | Объекты MinIO |
| `pyorchestrator/runtime-workspaces/` | pyorch-runtime | Sandbox-воркспейсы |
| `pyorchestrator/prometheus/` | *(опц.)* | Метрики |
| `pyorchestrator/grafana/` | *(опц.)* | Дашборды Grafana |
| `pyorchestrator/loki/` | *(опц.)* | Логи Loki |

## Бэкап каталога

```bash
tar -czf wash-pro-crm-data-$(date +%F).tar.gz -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"
```

Или используйте встроенный сервис: Dashboard → **Резервные копии** / `./scripts/backup.sh`.

## Опасные команды

- `docker compose down -v` — **не удалит** bind mount, но удалит старые named volumes, если они ещё остались
- `rm -rf data/` или `rm -rf /var/lib/wash-pro-crm` — **полная потеря данных**

## Права доступа

Каталог должен быть доступен для записи пользователю Docker (на Linux часто `chmod 755` достаточно; при ошибках MongoDB/Postgres см. UID контейнера).
