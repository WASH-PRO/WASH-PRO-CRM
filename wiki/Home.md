# WASH PRO CRM / SCADA

Локальная CRM/SCADA для автомоек на базе [Dynamic API Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform) **v1.5.13** и опционально [PyOrchestrator](https://github.com/Developer-RU/pyorchestrator) **v0.1.0**.

**Документация (GitHub Pages):** https://wash-pro.github.io/WASH-PRO-CRM/

## Возможности

- SCADA: состояние постов, live-таймер, интерактивный график
- Автомойки, посты (серийный номер контроллера), карты (regular/service/VIP)
- Аналитика до/после инкассации, архив, бэкапы MongoDB
- **Пользователи и группы RBAC** в Dashboard
- **Telegram-боты** (несколько) через PyOrchestrator + pyorch-bridge
- **Resources** — статус Dynamic API (`:8080`) и PyOrchestrator (`:8090`)
- Live-обновление 3–15 с

## Быстрый старт

```bash
git clone https://github.com/Developer-RU/WASH-PRO-CRM.git
cd WASH-PRO-CRM
cp .env.example .env
chmod +x scripts/*.sh
./scripts/start.sh
```

| Интерфейс | URL |
|-----------|-----|
| Dashboard | http://localhost |
| Dynamic API Panel | http://localhost:8080 |
| PyOrchestrator Panel *(опц.)* | http://localhost:8090 |

Логин Dashboard: `admin` / `Admin123!`

PyOrchestrator: `PYORCHESTRATOR_ENABLED=true` в `.env`

## Wiki

- [Быстрый старт](Getting-Started)
- [Dashboard](Dashboard)
- [Архитектура](Architecture)
- [Встроенные сервисы](Embedded-Services)
- [Схема данных](Database-Schema)

## Архитектура

```
Контроллеры → RabbitMQ → Message Processor → Dynamic API → MongoDB
Dashboard ──nginx──► Dynamic API
Dashboard ──pyorch-bridge──► PyOrchestrator (Telegram, опц.)
```

## Репозиторий

https://github.com/Developer-RU/WASH-PRO-CRM
