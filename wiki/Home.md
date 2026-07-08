# WASH PRO CRM / SCADA

Локальная CRM/SCADA для автомоек на базе [Dynamic API Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform) **v1.5.13** и опционально [PyOrchestrator](https://github.com/PyOrchestrator/PyOrchestrator) **v0.1.13**.

**Версия WASH PRO:** **v1.1.11** · **Документация:** https://wash-pro.github.io/WASH-PRO-CRM/

## Возможности

- **Мастер настройки** — первичная настройка после установки (`/setup`)
- **Информация** — новости и акции для **информационного Telegram-бота**
- SCADA: состояние постов, **онлайн/оффлайн** (30 с), live-таймер, интерактивный график
- Автомойки, посты, **учётные записи MQTT**, настройки устройства (цены, команды)
- Карты (regular/service/VIP), журнал применений NFC
- Аналитика до/после инкассации, архив, бэкапы MongoDB
- Уведомления web + Telegram, настраиваемые типы событий
- Пользователи и группы RBAC, **Telegram user_id**, профиль пользователя
- **Telegram-боты:** Управление / Сервисный / **Информационный (v1.8)**; QR-ссылка; только **личные чаты**
- MCP-сервер для AI-агентов (`services/crm-mcp`, v1.1.9+)
- MQTT (Mosquitto): изоляция постов по serial
- Live-обновление 3–15 с; глобальный переключатель Live/Static (v1.1.8)

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

## Changelog v1.1.11

- Информационный бот: лента, рассылка, отправка изображений файлом
- Изоляция личных чатов (группы отключены)
- Исправления ленты новостей и `expiresAt`

Полный список: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Репозиторий

https://github.com/WASH-PRO/WASH-PRO-CRM
