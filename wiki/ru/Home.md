> **[English](en-Home)** · **Русский** · [← Wiki](Home)

# WASH PRO CRM / SCADA

Локальная CRM/SCADA для автомоек на базе [Dynamic API Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform) **v1.5.13** и опционально [PyOrchestrator](https://github.com/PyOrchestrator/PyOrchestrator) **v0.1.13**.

**WASH PRO version:** **v1.1.31** · **Documentation:** https://wash-pro.github.io/WASH-PRO-CRM/ru/  
Языки: [EN](https://wash-pro.github.io/WASH-PRO-CRM/en/) · [RU](https://wash-pro.github.io/WASH-PRO-CRM/ru/)

## Возможности

- **Мастер настройки** — первичная настройка после установки (`/setup`)
- **Состояние** — все посты, онлайн/оффлайн, интерактивный график *(Главное)*
- **Целостность и исправление** — мастер в Настройках: пути, `.env`, сбойные обновления; внешний `DATA_DIR` не помечается как подозрительный (v1.1.19)
- **Обновления ПО** — стабильное автообновление из Dashboard, ошибка видна на карточке (v1.1.20)
- **Информация** — ресурсы сервера, версия CRM, встроенные компоненты *(Система → Информация)* (v1.1.22)
- **Публикации** — новости и акции для **информационного Telegram-бота** *(Автоматизация)* (v1.1.22)
- **Встроенная справка** — полноэкранная справка; пункт **Справка** внизу sidebar (v1.1.22, v1.1.28)
- SCADA: MQTT, телеметрия, команды и цены постов
- Автомойки, посты, **учётные записи MQTT**, настройки устройства
- Карты (regular/service/VIP), журнал применений NFC
- Аналитика до/после инкассации, архив, бэкапы MongoDB
- Уведомления web + Telegram, настраиваемые типы событий
- Пользователи и группы RBAC, **Telegram user_id**, профиль
- **Telegram-боты:** Управление / Сервисный / **Информационный (v2.2)**; QR-ссылка; только **личные чаты**; демо-боты при установке (v1.1.15)
- **График загруженности** на Обзоре — по дням под выручкой (v1.1.15)
- **Локализация Dashboard** — English / Русский; по умолчанию English; переключатель в шапке и Настройках (v1.1.13+)
- **Локализованные уведомления** — сообщения в списке по типу события следуют языку интерфейса, в т.ч. старые записи (v1.1.14)
- **MCP сервер** в Dashboard — Dynamic API + PyOrchestrator для AI-агентов (v1.1.12)
- **Модули** — каталог расширений GitHub, install/start/stop, UI настроек в iframe *(Автоматизация)* (v1.1.30)
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
- [Модули](ru-Modules)
- [MCP для AI-агентов](ru-MCP)
- [Встроенные сервисы](ru-Embedded-Services)
- [Схема данных](ru-Database-Schema)

## Changelog v1.1.31

- **Страница «Модули»** — компактные фильтры (как DataTable); icon-only на карточках; кнопка «Обновить каталог» с текстом

Полный список: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.30

- **Модули** — `modules-bridge`, страница каталога с поиском/фильтрами/пагинацией, модуль VK публикатор
- **UI модулей** — iframe auto-resize, синхронизация темы, общий UI kit, icon-only кнопки на карточках

Полный список: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.29

- **Сборка dashboard** — исправлен TS6133 (неиспользуемый `BookOpen` в HelpModal)

Полный список: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.28

- **Справка** — только sidebar (над «Документация»), обычный стиль; убрана из шапки

Полный список: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.27

- **Справка** — кнопка «Справка» в шапке (бирюзовая) и пункт в sidebar
- **Кэш dashboard** — исправлена ошибка `text/html is not a valid JavaScript MIME type` после пересборки

Полный список: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.26

- **Версия после обновления** — `APP_VERSION` до шага «Сборка»; `version.json` при старте dashboard из env

Полный список: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.25

- **Docker Hub** — понятная ошибка при таймауте на Mac/localhost; раздел в troubleshooting
- **UI** — подсказка failed job и справка «Настройки» про `docker pull`

Полный список: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.24

- **Устаревший failed job** — автоматически скрывается, если текущая версия ≥ цели ошибки

Полный список: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.23

- **Автообновление** — `APP_VERSION` только после успеха; откат при ошибке; версия из `version.json` dashboard
- **UI** — «Повторить» и «Скрыть ошибку» на failed job

Полный список: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.22

- **Справка** — полноэкранное окно из шапки, 26 разделов, схемы экранов, EN/RU
- **Меню** — `/system` → **Система → Информация**; контент бота → **Публикации**
- **Хлебные крошки** — группа меню → раздел; исправлены пути

Полный список: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.21

- **Git /deploy** — `safe.directory` при старте и в проверке целостности (dubious ownership)
- **UI обновлений** — не показывает старый failed job после успешного обновления

Полный список: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.20

- **Автообновление** — `git reset --hard origin/main` вместо `git pull`; сохраняются `.env`, override, `local/`
- **UI** — failed job остаётся на карточке компонента с логом
- **`scripts/compose-files.sh`** — build/seed апдейтера с override и PyOrchestrator

Полный список: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.19

- **Целостность** — внешние пути `DATA_DIR` (`/mnt/hdd/data`, `/var/lib/wash-pro-crm`) больше не помечаются как подозрительные
- **Локализация** — уточнён текст предупреждения, когда `DATA_DIR` действительно указывает в `/deploy`

Полный список: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.18

- **Система обновлений** — `git ls-remote` без GitHub-токена; кэш при загрузке страницы; «Проверить сейчас» для API
- **Примеры** — `docker-compose.override.yml.example`, `local/apply-server-patches.sh.example`

Полный список: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.17

- **Мастер «Целостность и исправление»** в Настройках — диагностика путей/`.env` и исправления через `update-bridge`
- **`scripts/start.sh`** — опциональный `docker-compose.override.yml`

Полный список: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.16

- **Страница «Система»** (`/system`) в «Главное» — метрики сервера, WASH PRO CRM, версии компонентов
- **Модель CPU** — улучшенное определение в Docker через `/proc/cpuinfo`

Полный список: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.15

- **График загруженности** на Обзоре (по дням, под выручкой)
- **Telegram** — надёжная остановка ботов, `stop-all`, демо-боты при установке; занятость v2.2 (`program_9` = свободен)
- **Уведомления** — кнопка «Удалить все»

Полный список: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

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
