> **[English](en-Home)** · **Русский** · [← Wiki](Home)

# WASH PRO CRM / SCADA

Локальная CRM/SCADA для автомоек на базе [Dynamic API Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform) **v1.5.13** и опционально [PyOrchestrator](https://github.com/PyOrchestrator/PyOrchestrator) **v0.1.13**.

**WASH PRO version:** **1.1.58** · **Documentation:** https://wash-pro.github.io/WASH-PRO-CRM/ru/  
Языки: [EN](https://wash-pro.github.io/WASH-PRO-CRM/en/) · [RU](https://wash-pro.github.io/WASH-PRO-CRM/ru/)

## Возможности

- **Мастер настройки** — первичная настройка после установки (`/setup`)
- **Состояние** — все посты, онлайн/оффлайн, интерактивный график *(Главное)*
- **Целостность и исправление** — мастер в Настройках: пути, `.env`, сбойные обновления; внешний `DATA_DIR` не помечается как подозрительный (v1.1.19)
- **Обновления ПО** — стабильное автообновление из Dashboard, ошибка видна на карточке (v1.1.20)
- **Информация** — ресурсы сервера, версия CRM, встроенные компоненты *(Система → Информация)* (v1.1.22)
- **Публикации** — новости и акции для **информационного Telegram-бота** *(Автоматизация)* (v1.1.22)
- **Встроенная справка** — полноэкранная справка; пункт **Справка** внизу sidebar (v1.1.22, v1.1.28); **Мастер / Приветствие / Профиль** *(v1.1.44)*
- **White-label брендинг** — Настройки → название, слоган, логотип *(v1.1.44)*
- **Toast и подтверждения** — модальные диалоги вместо `alert`/`confirm` *(v1.1.44)*
- **Полный пакет бэкапа** — MongoDB + настройки + data модулей *(v1.1.44)*
- **Диагностика** — JSON-отчёт на странице «Информация» *(v1.1.44)*
- SCADA: MQTT, телеметрия, команды и цены постов
- Автомойки, посты, **учётные записи MQTT**, настройки устройства; сохранение названия поста не затирает MQTT-пароль *(v1.1.54)*
- Карты (regular/service/VIP), журнал применений NFC
- Аналитика до/после инкассации, архив, бэкапы MongoDB
- Уведомления web + Telegram, настраиваемые типы событий
- Пользователи и группы RBAC, **Telegram user_id**, профиль
- **Telegram-боты:** Управление / Сервисный / **Информационный (v2.2)**; QR-ссылка; только **личные чаты**; демо-боты при установке (v1.1.15)
- **График загруженности** на Обзоре — по дням под выручкой (v1.1.15)
- **Локализация Dashboard** — English / Русский; по умолчанию English; переключатель в шапке и Настройках (v1.1.13+)
- **Локализованные уведомления** — сообщения в списке по типу события следуют языку интерфейса, в т.ч. старые записи (v1.1.14)
- **MCP сервер** в Dashboard — Dynamic API + PyOrchestrator для AI-агентов (v1.1.12)
- **Модули** — каталог расширений GitHub, install/start/stop, UI настроек в iframe *(Автоматизация)* (v1.1.30); **VK публикатор — только текст во VK** *(v1.1.42)*
- **Уведомления об обновлениях и модулях** — задачи обновления CRM и события модулей в web + Telegram (v1.1.34)
- **Разделы на странице «Модули»** — блоки «Установленные» и «Доступные» *(Автоматизация → Модули)* (v1.1.38)
- **Показ пароля для администраторов** — кнопка в настройках, пользователях, профиле (v1.1.33)
- Stdio MCP `services/crm-mcp` для Cursor (v1.1.9+)
- MQTT (Mosquitto): изоляция постов по serial
- Live-обновление 3–15 с; глобальный переключатель Live/Static (v1.1.8)
- **Серверная «Загрузить ещё» (100 записей)** — MQTT, карты, история поста *(v1.1.51)*, страница уведомлений *(v1.1.52)*
- **Архив** — колонка «Результат», ручная очистка телеметрии, счётчик проверенных *(v1.1.49)*
- **Синхронизация индексов MongoDB** при старте Dynamic API *(v1.1.48)*

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

## Changelog v1.1.58

- **PyOrchestrator** — недостающие импорты `create_script` / `storage_service` в `main.py` (серверный sed-патч больше не нужен)

Заметки релиза: [v1.1.58](https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.58)

## Changelog v1.1.57

- **Пароль MQTT `system`** — passwd больше не перезаписывается из `.env` на каждый рестарт; processor лечит seed `washpro` → `MQTT_PASSWORD` до подключения (ETH MQTT OK + CRM Офлайн)

Заметки релиза: [v1.1.57](https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.57)

## Changelog v1.1.55

- **Сборка Dashboard в Docker** — builder `node:20-bookworm-slim`, чтобы Vite 8 / rolldown native bindings ставились на Linux-серверах

Заметки релиза: [v1.1.55](https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.55)

## Changelog v1.1.54

- **Страница поста** — сохранение названия/описания больше не затирает MQTT логин/пароль в `posts.settings`
- **Список постов** — при edit не генерируется новый MQTT-пароль молча; пустой пароль недопустим
- **Настройки** — пустые секреты сохраняют прежние значения; sync Mosquitto только при изменении `mqtt-broker`
- **message-processor** — входящие `settings` мержатся, а не заменяются целиком

Заметки релиза: [v1.1.54](https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.54)

## Changelog v1.1.53

- **Команды поста** — поле суммы очищается после успешной команды «Зачисление баланса»

Заметки релиза: [v1.1.53](https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.53)

## Changelog v1.1.52

- **Страница уведомлений** — серверная пагинация как в MQTT: 100 записей, одна кнопка «Загрузить ещё» над таблицей, опрос 3 с
- **Документация** — обновлены GitHub Pages, wiki, release notes (v1.1.48–52, troubleshooting, PyOrchestrator v0.1.13)

Заметки релиза: [v1.1.52](https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.52)

## Changelog v1.1.51

- **Карточка поста** — история состояний как раздел MQTT (100 строк, «Загрузить ещё» над таблицей, `count=false`)

Заметки релиза: [v1.1.51](https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.51)

## Changelog v1.1.50

- **Обновления ПО** — исправлен зависший спиннер на stale `queued`; очередь задач update-bridge

Заметки релиза: [v1.1.50](https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.50)

## Changelog v1.1.49

- **Архив** — колонка «Результат», отображение «0 записей», ручная очистка телеметрии, scanned в журнале
- **История поста** — одна серверная «Загрузить ещё» (без дубля в DataTable)

Заметки релиза: [v1.1.49](https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.49)

## Changelog v1.1.48

- **MongoDB** — фоновая синхронизация индексов при старте Dynamic API; составные индексы телеметрии

Заметки релиза: [v1.1.48](https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.48)

## Changelog v1.1.47

- **Мобильная адаптивность** — drawer, справка, safe-area, адаптивные сетки

Заметки релиза: [v1.1.47](https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.47)

## Changelog v1.1.46

- **Настройки** — блок MQTT (CRM) на всю ширину; поля в адаптивной сетке

Заметки релиза: [v1.1.46](https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.46)

## Changelog v1.1.45

- **Справка** — убраны разделы по каждому модулю из справки CRM; help модуля — на `/modules/:id`

Заметки релиза: [v1.1.45](https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.45)

## Changelog v1.1.44

- **Брендинг** — white-label: название, слоган, URL логотипа (вход, сайдбар, приветствие)
- **UX** — toast и модальное подтверждение вместо диалогов браузера
- **Бэкапы** — опциональный полный пакет: настройки CRM + `modules/installed/*/data/`
- **Диагностика** — JSON-отчёт для поддержки на странице «Информация»
- **Справка** — разделы Мастер, Приветствие, Профиль; ссылка на docs в сайдбаре справки
- **CI** — паритет i18n, ссылки docs, сборка dashboard

Заметки релиза: [v1.1.44](https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.44)

## Changelog v1.1.43

- **PyOrchestrator** — commit run до Redis; очистка runtime jobs при stop
- **modules-bridge** — быстрее каталог/статусы; recover stop-before-start
- **Страница «Модули»** — параллельная загрузка health + catalog

Заметки релиза: [v1.1.43](https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.43)

## Changelog v1.1.42

- **VK публикатор (v1.2.0)** — только текст во VK; картинки и `imageUrl` для Telegram/CRM
- **modules-bridge** — bootstrap секретов PyOrch для wash-модулей; endpoint reregister

Заметки релиза: [v1.1.42](https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.42)

## Changelog v1.1.41

- **Проверка автообновления** — косметический релиз для теста «Настройки → Обновления ПО»

Заметки релиза: [v1.1.41](https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.41)

## Changelog v1.1.40

- **Кросс-платформенные обновления** — исправление compose env при source; repair с полным `$COMPOSE_FILES`; macOS `sed -i`

Заметки релиза: [v1.1.40](https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.40)

## Changelog v1.1.38

- **Страница «Модули»** — разделы «Установленные» и «Доступные»; пагинация в каждом блоке
- **Docs/wiki** — версия v1.1.38; скрипты синхронизации версии и бейдж GitHub Pages из CI

Заметки релиза: [v1.1.38](https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.38) · Полный список: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.37

- **Локализация** — feature-модули: `features/modules`, `features/updates`, `features/notifications-features`; справка в `help/`
- **Политика релизов** — GitHub Releases только для актуальных версий (`releases/README.md`)

Заметки релиза: [v1.1.37](https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.37) · Полный список: [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md)

## Changelog v1.1.36

- **Автообновление** — больше не падает без `modules-bridge`; dashboard всегда пересобирается; авто-синхронизация `WASH_HOST_PROJECT_ROOT`

## Changelog v1.1.34

- **Уведомления** — задачи обновления ПО (CRM, Dynamic API, PyOrchestrator) и события модулей

## Changelog v1.1.33

- **Модули** — исправление Safari JWT; пересборка modules-bridge в **Настройки → Целостность и исправление** без SSH
- **PasswordInput** — показ пароля для администраторов

## Changelog v1.1.30

- **Модули** — `modules-bridge`, страница каталога с поиском/фильтрами/пагинацией, модуль VK публикатор (только текст во VK с v1.1.42)
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

- **Версия после обновления** — `APP_VERSION` в `.env` только после **успешного** job; при ошибке — откат git, `.env` и dashboard

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
