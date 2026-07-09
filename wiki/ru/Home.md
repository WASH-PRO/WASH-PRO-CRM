> **[English](en-Home)** · **Русский** · [← Wiki](Home)

# WASH PRO CRM / SCADA

Локальная CRM/SCADA для автомоек на базе [Dynamic API Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform) **v1.5.13** и опционально [PyOrchestrator](https://github.com/PyOrchestrator/PyOrchestrator) **v0.1.13**.

**Версия WASH PRO:** **v1.1.14** · **Документация:** https://wash-pro.github.io/WASH-PRO-CRM/ru/  
Языки: [EN](https://wash-pro.github.io/WASH-PRO-CRM/en/) · [RU](https://wash-pro.github.io/WASH-PRO-CRM/ru/)

## Возможности

- **Мастер настройки** — первичная настройка после установки (`/setup`)
- **Состояние** — все посты, онлайн/оффлайн, интерактивный график *(Главное)*
- **Информация** — новости и акции для **информационного Telegram-бота** *(Автоматизация)*
- SCADA: MQTT, телеметрия, команды и цены постов
- Автомойки, посты, **учётные записи MQTT**, настройки устройства
- Карты (regular/service/VIP), журнал применений NFC
- Аналитика до/после инкассации, архив, бэкапы MongoDB
- Уведомления web + Telegram, настраиваемые типы событий
- Пользователи и группы RBAC, **Telegram user_id**, профиль
- **Telegram-боты:** Управление / Сервисный / **Информационный (v1.9)**; QR-ссылка; только **личные чаты**
- **Локализация Dashboard** — English / Русский; по умолчанию English; переключатель в шапке и Настройках (v1.1.13+)
- **Локализованные уведомления** — сообщения в списке по типу события следуют языку интерфейса, в т.ч. старые записи (v1.1.14)
- **MCP сервер** в Dashboard — Dynamic API + PyOrchestrator для AI-агентов (v1.1.12)
- Stdio MCP `services/crm-mcp` для Cursor (v1.1.9+)
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

- [Быстрый старт](ru-Getting-Started)
- [Мастер настройки](ru-Setup-Wizard)
- [Dashboard](ru-Dashboard)
- [Архитектура](ru-Architecture)
- [MQTT и управление постами](ru-MQTT)
- [Telegram-боты](ru-Telegram)
- [MCP для AI-агентов](ru-MCP)
- [Встроенные сервисы](ru-Embedded-Services)
- [Схема данных](ru-Database-Schema)

## Changelog v1.1.14

- **Локализация уведомлений** — заготовленные фразы по типу события; старые записи на русском отображаются на выбранном языке
- **Шапка** — переключатели языка и Live/Static одной иконкой на всех экранах
- **Wiki** — исправлены двуязычные ссылки; виджет Product Hunt в README

Полный список: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.13

- **Локализация Dashboard (EN/RU)** — полный перевод интерфейса; English по умолчанию; флаги 🇺🇸/🇷🇺 в шапке
- **Документация и wiki** — каталоги `en/` и `ru/`; README EN + README.ru.md
- **Мобильная шапка** — компактные иконки языка и Live/Static
- **Информация** — зелёный бейдж «Опубликовано» для прошедшего расписания

Полный список: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.12

- Раздел **MCP сервер** в Dashboard (Dynamic API + PyOrchestrator)
- Меню: группа **Автоматизация**; **Состояние** в **Главное**
- **Информация**: «По расписанию» → «Опубликовано» после наступления времени
- Информационный бот v1.9; исправлен серый экран при навигации

Полный список: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Репозиторий

https://github.com/WASH-PRO/WASH-PRO-CRM
