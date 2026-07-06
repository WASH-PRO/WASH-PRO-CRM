# WASH PRO CRM / SCADA

Локальная CRM/SCADA для автомоек на базе [Dynamic API Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform) **v1.5.13** и опционально [PyOrchestrator](https://github.com/PyOrchestrator/PyOrchestrator) **v0.1.10**.

**Документация (GitHub Pages):** https://wash-pro.github.io/WASH-PRO-CRM/

## Возможности

- SCADA: состояние постов, live-таймер, интерактивный график
- Автомойки, посты, **настройки устройства** (цены режимов, команды MQTT)
- Карты (regular/service/VIP), журнал применений NFC
- Аналитика до/после инкассации, архив, бэкапы MongoDB
- Уведомления web + Telegram, настраиваемые типы событий
- Пользователи и группы RBAC в Dashboard, профиль пользователя
- **Telegram-боты** (несколько) через PyOrchestrator + pyorch-bridge
- MQTT (Mosquitto) вместо RabbitMQ для телеметрии
- Live-обновление 3–15 с

## Быстрый старт

```bash
git clone https://github.com/WASH-PRO/WASH-PRO-CRM.git
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
- [MQTT и управление постами](MQTT)
- [Встроенные сервисы](Embedded-Services)
- [Схема данных](Database-Schema)

## Архитектура

```
Контроллеры ⇄ MQTT (Mosquitto) ⇄ Message Processor ⇄ Dynamic API ⇄ MongoDB
Dashboard ──nginx──► Dynamic API, post-device API, backup, telegram-bots
Dashboard ──pyorch-bridge──► PyOrchestrator (Telegram, опц.)
```

## Changelog

См. [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md) в репозитории.

## Репозиторий

https://github.com/WASH-PRO/WASH-PRO-CRM
