# WASH PRO CRM / SCADA

Локальная CRM/SCADA для автомоек на базе [Dynamic API Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform) **v1.5.13** и опционально [PyOrchestrator](https://github.com/PyOrchestrator/PyOrchestrator) **v0.1.13**.

**Документация (GitHub Pages):** https://wash-pro.github.io/WASH-PRO-CRM/

## Возможности

- **Мастер настройки** — первичная настройка после установки (`/setup`)
- SCADA: состояние постов, **онлайн/оффлайн** (30 с), live-таймер, интерактивный график
- Автомойки, посты, **учётные записи MQTT**, настройки устройства (цены, команды)
- Карты (regular/service/VIP), журнал применений NFC
- Аналитика до/после инкассации, архив, бэкапы MongoDB
- Уведомления web + Telegram, настраиваемые типы событий
- Пользователи и группы RBAC в Dashboard, **Telegram user_id**, профиль пользователя
- **Telegram-боты v2.7** (несколько) через PyOrchestrator + pyorch-bridge; CRM RBAC в боте
- MQTT (Mosquitto): изоляция постов по serial, `system` для CRM
- Live-обновление 3–15 с
- **Таблицы:** пагинация 20/40/60/80/100, Назад/Далее, Загрузить ещё ([Dashboard](Dashboard#пагинация-таблиц-v115))

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

Логин Dashboard: `admin` / `Admin123!` → мастер настройки при первом входе.

PyOrchestrator: `PYORCHESTRATOR_ENABLED=true` в `.env`

## Wiki

- [Быстрый старт](Getting-Started)
- [Мастер настройки](Setup-Wizard)
- [Dashboard](Dashboard)
- [Архитектура](Architecture)
- [MQTT и управление постами](MQTT)
- [Telegram-боты](Telegram)
- [Встроенные сервисы](Embedded-Services)
- [Схема данных](Database-Schema)

## Архитектура

```
Контроллеры ⇄ MQTT (Mosquitto, ACL по serial) ⇄ Message Processor ⇄ Dynamic API ⇄ MongoDB
Dashboard ──nginx──► Dynamic API, post-device API, backup, telegram-bots
Dashboard ──pyorch-bridge──► PyOrchestrator (Telegram, опц.)
```

## Changelog

См. [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md) в репозитории.

## Репозиторий

https://github.com/WASH-PRO/WASH-PRO-CRM
