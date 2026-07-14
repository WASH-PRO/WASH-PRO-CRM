# Changelog

Все значимые изменения WASH PRO CRM документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/).

## [Unreleased]

## [1.1.49] — 2026-07-14

### Исправлено

- **Страница поста** — одна кнопка «Загрузить ещё» для серверной догрузки истории (без дубля из DataTable)
- **Архивирование** — столбец «Результат», понятное отображение «0 записей», ручной запуск очистки телеметрии, счётчик проверенных записей в журнале

### Документация

- **releases/v1.1.49.md, docs, wiki** — v1.1.49

## [1.1.48] — 2026-07-14

### Исправлено

- **MongoDB** — синхронизация индексов Mongoose при старте Dynamic API (фоново, не блокирует healthcheck при автообновлении)
- **Телеметрия** — составной индекс `postSerial + messageType + receivedAt` для быстрых фильтрованных запросов и count

### Документация

- **releases/v1.1.48.md, docs, wiki** — v1.1.48

## [1.1.47] — 2026-07-12

### Изменено

- **Dashboard (mobile)** — drawer с подписями, scroll lock, safe-area, `100dvh`; сворачиваемая навигация в справке; адаптивные сетки на «Информация» и баннере обновлений

### Документация

- **releases/v1.1.47.md, docs, wiki** — v1.1.47

## [1.1.46] — 2026-07-12

### Изменено

- **Настройки → MQTT (CRM)** — блок на всю ширину страницы; поля в сетке 3+4 колонки вместо узкой карточки в общем grid

### Документация

- **releases/v1.1.46.md, docs, wiki** — v1.1.46

## [1.1.45] — 2026-07-12

### Изменено

- **Встроенная справка** — убраны динамические разделы по каждому модулю из HelpModal; справка модуля только на странице модуля (`ModuleHelpFrame` в `/modules/:id`)
- **help (EN/RU)** — раздел «Модули» уточняет, что help модуля не дублируется в справке CRM

### Документация

- **releases/v1.1.45.md, docs, wiki** — v1.1.45

## [1.1.44] — 2026-07-12

### Добавлено

- **White-label брендинг** — `branding` в CRM settings: название, слоган, logo URL, support/docs URL; login, welcome, sidebar, System
- **Toast + Confirm modal** — `ToastProvider`, `ConfirmProvider`; замена `alert`/`confirm` на ключевых страницах
- **Диагностика** — скачивание JSON-отчёта на странице **Информация** (`diagnosticReport.ts`)
- **Полный бэкап** — `backup.fullBundle`: MongoDB archive + `*-extras.tar.gz` (settings + `modules/installed/*/data/`)
- **Справка** — разделы setup, welcome, profile; ссылка на GitHub Pages docs в HelpModal
- **CI** — `.github/workflows/ci.yml`; `scripts/validate-i18n-keys.sh`

### Изменено

- **Settings i18n** — заголовки PyOrchestrator, Dynamic API, MQTT; ключи branding, fullBundle, diagnostics
- **init-seed** — дефолты `branding`, `backup.fullBundle: true`
- **wash-backup** — volume `modules:/modules:ro`, `bundle.ts`, очистка extras-архивов
- **Tailwind** — `panel-surface`, `panel-bg` токены
- **docker-compose.override.yml.example** — комментарий про mongo:7 на современных CPU

### Документация

- **CHANGELOG, releases/v1.1.44.md, README, docs, wiki** — v1.1.44

## [1.1.43] — 2026-07-12

### Исправлено

- **PyOrchestrator** — commit в БД перед постановкой job в Redis (гонка `/internal/runs/start` → 500); очистка очереди `runtime:jobs` при stop скрипта
- **modules-bridge** — таймауты PyOrch/CRM (8 с); параллельный опрос статусов в каталоге; кэш статуса 10 с; recover: stop перед start; retry при `Max concurrent runs reached`
- **dashboard /modules** — параллельная загрузка health + catalog

### Изменено

- **crm-update-build** — при `PYORCHESTRATOR_ENABLED=true` пересборка `pyorch-backend` при автообновлении CRM
- **MongoDB** — `mongo:4.4` + healthcheck `mongo` для CPU без AVX (Intel G4650 и аналоги)
- **Каталог dynamic-pricing v1.1.6** — интервал опроса от 5 сек, шаг 5 сек

## [1.1.42] — 2026-07-12

### Изменено

- **VK публикатор (каталог v1.2.0)** — во VK публикуется **только текст**; `imageUrl` и картинки игнорируются (остаются для CRM и Telegram-бота); обновлены UI, справка и описание модуля
- **modules-bridge** — bootstrap `SECRET_*` → env для wash-модулей; исправление сборки TS; endpoint `POST /installed/:id/reregister`

### Добавлено

- **`scripts/reset-info-messages-vk-demo.mjs`** — сброс публикаций и 10 демо-записей (HTML, эмодзи, картинки)
- **`scripts/fix-info-message-images.mjs`** — замена недоступных URL изображений в публикациях

### Документация

- **docs / wiki / dashboard help** — VK публикатор text-only; версия v1.1.42

## [1.1.41] — 2026-07-12

### Изменено

- **Косметический релиз** — проверка цепочки автообновления CRM (Settings → Software updates) после исправлений v1.1.39–v1.1.40
- **Docs** — версия v1.1.41

## [1.1.40] — 2026-07-12

### Исправлено

- **crm-update-compose-env.sh** — корректный `CRM_UPDATE_ROOT` при `source` (BASH_SOURCE / DEPLOY_ROOT); repair и diagnose используют полный `$COMPOSE_FILES`
- **Integrity repair** — mosquitto/modules-bridge/init-seed через `withComposeEnv` (override, Redis, PyOrch)
- **PyOrchestrator auto-update** — build через `$COMPOSE_FILES`, не hardcoded `-f`
- **crm-update-sync-host-env.sh** — `sed -i` на macOS
- **run-init-seed.sh** — единый `compose-files.sh`
- **sync-version-docs.sh** — синхронизация README badge и configuration.md

## [1.1.39] — 2026-07-12

### Исправлено

- **Автообновление CRM (failed на «Сборка»)** — `compose-files.sh` использовал bash-синтаксис `${BASH_SOURCE…}` при запуске через `sh`; update-bridge теперь выполняет команды через `bash`, `SCRIPT_DIR` берётся из `DEPLOY_ROOT`

## [1.1.38] — 2026-07-12

### Изменено

- **Страница «Модули»** — разделы «Установленные» и «Доступные»; отдельная пагинация; убран фильтр «Установка»
- **Версия в документации** — единый источник `dashboard/package.json`; скрипты `app-version.sh`, `sync-version-docs.sh`; бейдж GitHub Pages обновляется в CI
- **Wiki/docs** — версия v1.1.38, описания v1.1.33–v1.1.37 синхронизированы (EN/RU)

## [1.1.37] — 2026-07-12

### Изменено

- **Локализация dashboard** — feature-модули: `features/modules`, `features/updates`, `features/notifications-features`; справка в `help/`; документ `dashboard/src/i18n/README.md`
- **releases/README.md** — политика: создавать GitHub Releases только для актуальных версий, не backfill старых тегов
- **Wiki/docs** — версия v1.1.37, раздел о структуре i18n

## [1.1.36] — 2026-07-12

### Исправлено

- **Автообновление CRM (failed)** — health больше не валит обновление из‑за modules-bridge; dashboard собирается даже если modules-bridge упал
- **WASH_HOST_PROJECT_ROOT** — автоопределение и запись в `.env` на шаге pull (`crm-update-sync-host-env.sh`); улучшен detect через `wash-update-bridge` / `wash-dashboard`
- **Сборка** — modules-bridge best-effort; seed не блокируется при сбое ensure

## [1.1.35] — 2026-07-12

### Исправлено

- **Автообновление CRM (failed на health)** — шаг health получает `composeCommandEnv()`; новый `crm-update-compose-env.sh` сохраняет пути Docker при `source .env` (`.env` больше не затирает `WASH_HOST_PROJECT_ROOT`)
- **compose-files hook** — health/ensure не запускают повторную полную сборку из update-bridge

## [1.1.34] — 2026-07-12

### Добавлено

- **Уведомления — обновления ПО** — типы: запуск, успех, ошибка (CRM, Dynamic API, PyOrchestrator)
- **Уведомления — модули** — установка, удаление, запуск, остановка, обновление, ошибки

### Исправлено

- **Автообновление CRM** — надёжный запуск `modules-bridge`: hook без проверки `-x`, `crm-update-ensure-modules-bridge.sh`, повтор на шаге seed/health, `--force-recreate`

## [1.1.33] — 2026-07-12

### Исправлено

- **Страница «Модули»** — Safari/WebKit: декодирование JWT без `atob`, нормализация ошибки «The string did not match the expected pattern» в понятное сообщение
- **modules-bridge** — починка из браузера: **Настройки → Диагностика и исправления → пересборка modules-bridge + dashboard** (без SSH)
- **Автообновление** — повторная проверка health `modules-bridge` (5 попыток); dashboard больше не блокируется при падении modules-bridge

### Изменено

- **PasswordInput** — кнопка показа пароля для администраторов (настройки, пользователи, профиль)

## [1.1.32] — 2026-07-12

### Исправлено

- **Страница «Модули»** — ошибка Safari `The string did not match the expected pattern` (base64url JWT, разбор JSON от modules-bridge)
- **Автообновление CRM** — шаг «Сборка» теперь включает `modules-bridge` (`scripts/crm-update-build.sh`); работает и на старых образах update-bridge через hook в `compose-files.sh`

### Изменено

- **`scripts/crm-update-health.sh`** — проверка `modules-bridge:3024` после обновления
- **Страница «Модули»** — компактные фильтры, icon-only кнопки на карточках, «Обновить каталог» с текстом
- **modules-bridge** — auth-ошибки в JSON вместо plain text

## [1.1.31] — 2026-07-12

### Изменено

- **Страница «Модули»** — компактная панель фильтров (как DataTable); поле поиска без растягивания на всю ширину
- **Карточки модулей** — icon-only кнопки с подсказками; кликабельные заголовок и иконка
- **Пагинация** — по умолчанию 4 на странице; исправлена логика «загрузить ещё»
- **Обновить каталог** — текстовая кнопка в шапке (иконка + подпись)

## [1.1.30] — 2026-07-12

### Добавлено

- **Система модулей** — сервис `modules-bridge` (Docker Compose, порт `3024` на localhost); каталог `modules/registry.json`
- **Dashboard → Автоматизация → Модули** — поиск, фильтры, пагинация, «загрузить ещё»; карточки с кликабельным заголовком и icon-only кнопками
- **Жизненный цикл модулей** — install/start/stop/update/uninstall из GitHub; UI настроек в iframe (auto-resize, синхронизация темы CRM)
- **Модуль VK публикатор** — публикация **Публикаций** CRM во ВКонтакте с загрузкой фото
- **Общий UI kit модулей** — `wash-module-ui.css`, `wash-module-sdk.js` (Обзор / Настройки / Логи)
- **API modules-bridge** — иконки модулей, логи PyOrchestrator, обогащённый status
- **Документация** — `docs/en|ru/modules.md`, wiki Modules, обновления architecture/dashboard/embedded-services/README

### Изменено

- **Хлебные крошки** — маршрут `/modules/:moduleId` с именем модуля
- **nginx dashboard** — прокси `/api/crm/modules/` → `modules-bridge`

## [1.1.29] — 2026-07-11

### Исправлено

- **Сборка dashboard** — удалён неиспользуемый импорт `BookOpen` в `HelpModal.tsx` (TS6133 ломал `docker compose build` после v1.1.28)

## [1.1.28] — 2026-07-11

### Изменено

- **Справка** — только в sidebar: между «Мастер настроек» и «Ресурсы», над «Документация»; обычный стиль пункта меню (без выделения)
- **Шапка** — кнопка «Справка» убрана из topbar

## [1.1.27] — 2026-07-11

### Исправлено

- **Справка** — заметная кнопка «Справка» в шапке (бирюзовая) и пункт внизу бокового меню
- **Кэш после пересборки dashboard** — nginx не отдаёт `index.html` вместо отсутствующих `/assets/*.js`; понятное сообщение вместо `'text/html' is not a valid JavaScript MIME type`

### Изменено

- `index.html` — заголовки `no-cache`; `/assets/` — 404 и long-term cache

## [1.1.26] — 2026-07-11

### Исправлено

- **Версия после обновления CRM** — `APP_VERSION` в `.env` выставляется **до** шага «Сборка», чтобы `version.json` и Vite получали целевую версию
- **Dashboard** — при старте контейнера `version.json` синхронизируется из `APP_VERSION` (если job прошёл, но образ был из кэша)

## [1.1.25] — 2026-07-11

### Изменено

- **Таймаут Docker Hub** — понятное сообщение в `update-bridge` вместо сырого `DeadlineExceeded` / «Команда завершилась с кодом 1»
- **Документация** — раздел устранения неполадок для Mac/localhost (docker pull, VPN, DNS Docker Desktop)
- **UI** — подсказка при failed job и раздел «Настройки» во встроенной справке про Docker Hub

## [1.1.24] — 2026-07-11

### Исправлено

- **Устаревший failed job** — автоматически скрывается, если текущая версия ≥ цели failed job (localhost после ручного git pull / более нового релиза)

## [1.1.23] — 2026-07-11

### Исправлено

- **Ложная версия после failed update** — `APP_VERSION` в `.env` только после успешного job; откат при ошибке
- **Текущая версия CRM** — из `/version.json` работающего dashboard, не из `.env`
- **Зависшая ошибка на карточке обновления** — кнопки «Повторить» и «Скрыть ошибку»; `dismissedFailedJobIds`

### Изменено

- Dashboard: `version.json` в nginx-образе
- Подсказка при ошибке обновления (Docker Hub timeout)

## [1.1.22] — 2026-07-11

### Добавлено

- **Встроенная справка** — полноэкранное модальное окно из шапки: 26 разделов, поиск, схемы экранов, примеры, EN/RU

### Изменено

- **Меню** — `/system` в группе **Система**, пункт **Информация** (ранее «Система» в «Главное»)
- **Автоматизация** — раздел `/info-messages` переименован в **Публикации**
- **Хлебные крошки** — цепочка «группа меню → раздел»; исправлены пути и подписи
- **i18n (RU)** — `nav.short.usage` для свёрнутого меню
- **Документация и wiki** — актуализированы навигация, справка, крошки

## [1.1.21] — 2026-07-11

### Исправлено

- **Ложное «/deploy не git-репозиторий»** — проверка целостности и старт `update-bridge` регистрируют `git safe.directory /deploy` (dubious ownership)
- **Старый failed job на карточке** — после успешного обновления не показывается устаревшая ошибка
- **Ошибки shell** — последние строки вывода команды вместо только «код 1»

### Изменено

- **i18n** — уточнён текст предупреждения `git_not_repo`

## [1.1.20] — 2026-07-11

### Исправлено

- **Автообновление «сбрасывается»** — шаг pull CRM: `git fetch` + `git reset --hard origin/main` вместо `git pull --ff-only`; сохраняются `.env`, `DATA_DIR`, override и `local/`
- **Ошибка обновления не видна в UI** — карточка компонента показывает failed job с логом шага
- **Сборка без compose override** — build/seed апдейтера используют `scripts/compose-files.sh` (как `start.sh`)
- **Дубли `APP_VERSION` в `.env`** — одна строка версии после pull

### Изменено

- **`scripts/compose-files.sh`** — общий список `-f` для `start.sh` и `update-bridge`

## [1.1.19] — 2026-07-11

### Исправлено

- **Ложное предупреждение «Подозрительный DATA_DIR»** — мастер целостности больше не помечает внешние пути на хосте (`/mnt/hdd/data`, `/var/lib/wash-pro-crm`); предупреждение только при `DATA_DIR` внутри mount контейнера `/deploy`
- **Локализация** — уточнённые тексты EN/RU для `data_dir_suspicious`

## [1.1.18] — 2026-07-11

### Исправлено

- **Проверка обновлений без GitHub-токена** — `update-bridge`: fallback на `git ls-remote` при лимите GitHub REST API (60/ч без токена)
- **Сброс уведомления об обновлении при загрузке страницы** — Dashboard не вызывает GitHub при F5 и при опросе прогресса job; только кнопка «Проверить сейчас»
- **Потеря `latestVersion` при ошибке API** — сохранение последних известных версий в кэше `update-bridge`
- **Документация** — паттерн `docker-compose.override.yml` + `local/apply-server-patches.sh` для серверных правок без блокировки `git pull`

### Изменено

- **`useSoftwareUpdates`** — разделены `refresh` (кэш) и `checkGithub` (принудительная проверка релизов)
- **Примеры** — `docker-compose.override.yml.example`, `local/apply-server-patches.sh.example`

## [1.1.17] — 2026-07-11

### Добавлено

- **Мастер «Целостность и исправление»** в **Настройках** — диагностика путей, `.env`, ключевых файлов, Docker socket и готовности автообновления
- **Repair API** (`update-bridge`) — `GET/POST /api/crm/updates/repair` для администраторов
- **Диагностика** — `WASH_HOST_PROJECT_ROOT`, `DATA_DIR`, bind-mount, критичные файлы/каталоги, `docker compose config`, зависшие задачи обновления
- **Исправления** — синхронизация корня в `.env`, нормализация `DATA_DIR`, `git safe.directory`, сброс зависшего job, Mosquitto repair, `init-seed`
- **Локализация** — полные подписи EN/RU для мастера исправления

### Изменено

- **`scripts/start.sh`** — учитывает `docker-compose.override.yml`
- **Обновление CRM (pull)** — опциональный `local/apply-server-patches.sh` после `git pull`

## [1.1.16] — 2026-07-11

### Добавлено

- **Страница «Система»** (`/system`) в группе **«Главное»** (после «Состояние») — ресурсы сервера и информация о стеке WASH PRO CRM
- **Блок «Приложение»** — WASH PRO CRM: версия, окружение, платформа Docker, API runtime
- **Блок «Компоненты»** — версии CRM, Dynamic API, PyOrchestrator (через `update-bridge`)
- **Метрики** — ОС, CPU, hostname, uptime, память, диск, сетевые интерфейсы; live-обновление 30 с
- **Модель CPU в Docker** — fallback на `/proc/cpuinfo`, если `os.cpus()` не возвращает название процессора
- **Локализация** — полные подписи EN/RU для страницы «Система»

### Изменено

- **Меню «Главное»** — Обзор, Состояние, **Система** (статус платформы; группа «Система» с уведомлениями без изменений)

## [1.1.15] — 2026-07-09

### Добавлено

- **График загруженности** на Обзоре — по дням, под графиком «Выручка» (сумма времени использования из `usage-stats`)
- **Удалить все** на странице «Уведомления» (`DELETE /api/crm/notifications`)
- **Демо Telegram-боты** при первой установке — Управление / Сервисный / Информационный, без токенов, остановлены
- **`POST /api/telegram-bots/bots/stop-all`** — остановка всех ботов с очисткой зависших sandbox-процессов
- **`scripts/seed-info-messages.mjs`** — расширенные шаблоны новостей и акций, микс 50/50 (`COUNT`, `INTERVAL_MIN`)

### Исправлено

- **Создание второго Telegram-бота** — поле `metadata` в `ScriptCreate` PyOrchestrator (500 Internal Server Error)
- **Список ботов на странице Telegram** — исчезновение записей после start/stop до перезагрузки
- **«Фантомный» бот** — процесс sandbox продолжал polling после stop в CRM; kill process group + orphan cleanup в runtime
- **Гонка двух ботов** — общий poll lock по токену, stagger restart, grace period, `deleteWebhook` при stop
- **Занятость в информационном боте v2.2** — пост **свободен** только в режиме `program_9`; любой другой онлайн-режим = занят

### Изменено

- **Остановка ботов** — `stopWashBot()`: ожидание полной остановки, снятие webhook, disable скрипта
- **pyorch-bridge** — при старте синхронизация шаблонов без массового restart running-ботов

## [1.1.14] — 2026-07-09

### Исправлено

- **Список уведомлений** — сообщения формируются из заготовленных i18n-шаблонов по типу события; старые записи на русском корректно отображаются после переключения на English; переводятся severity и экспорт CSV
- **GitHub Wiki** — исправлены ссылки на двуязычные страницы (`en/`, `ru/`)

### Изменено

- **Шапка Dashboard** — переключатели языка (флаг) и Live/Static (радио/пауза) — одна иконка на всех размерах экрана

### Документация

- Виджет Product Hunt в `README.md` и `README.ru.md`
- Скрипты `sync-github-wiki.sh`, `sync-github-releases.sh`, `validate-wiki-links.sh`

## [1.1.13] — 2026-07-09

### Добавлено

- **Локализация Dashboard (EN/RU)** — полный перевод интерфейса (меню, статусы, сообщения, логи UI); по умолчанию **English**; переключатель в шапке (флаги 🇺🇸/🇷🇺) и в **Настройках**; выбор сохраняется в `localStorage` (`wash_locale`)
- **Многоязычная документация GitHub Pages** — каталоги `docs/en/` и `docs/ru/`; корень `/` → редирект по сохранённому языку; English по умолчанию
- **Wiki EN/RU** — `wiki/en/` и `wiki/ru/` с переключателем языка
- **README** — English `README.md` + `README.ru.md` с переключателем

### Изменено

- **Мобильная шапка Dashboard** — переключатель языка (один флаг текущей локали) и Live/Static (одна иконка); на `sm+` — полные контролы с подписями

### Исправлено

- **Раздел «Информация»** — зелёный бейдж **«Опубликовано»** для статуса «По расписанию» с прошедшей датой публикации

## [1.1.12] — 2026-07-09

### Добавлено

- **Раздел «MCP сервер»** (`/mcp`) — переключатель Dynamic API / PyOrchestrator; таблица инструментов; готовый HTTP-конфиг для Cursor без сборки; прокси nginx `/api/mcp` и `/api/pyorch-mcp/mcp`
- **Скрипт `scripts/seed-info-messages.mjs`** — массовое создание новостей/акций со статусом «По расписанию» (интервал и задержка через env)
- **Документация MCP** — страница [docs/mcp.md](docs/mcp.md), обновлены Dashboard, wiki, README

### Изменено

- **Меню Dashboard** — группа **«Автоматизация»**: Информация, Telegram, MCP, Бэкапы; **«Состояние»** перенесено в **«Главное»**; справочники вынесены в отдельную группу
- **Раздел «Информация»** — фактический статус: «По расписанию» с прошедшей датой отображается как **«Опубликовано»** (фильтр, сортировка, CSV)
- **Информационный бот v1.9** — одно сообщение (фото + подпись) без дубля текста; корректная занятость постов (`post_online` / `post_busy`)

### Исправлено

- **Серый экран при навигации** — retry загрузки JS-чанков, `RouteErrorBoundary`, таймаут polling 60 с, ошибка вместо вечного Loading на Обзоре

## [1.1.11] — 2026-07-09

### Добавлено

- **Информационный бот v1.8** — лента новостей/акций по кнопкам; автоматическая рассылка подписчикам; загрузка изображений и отправка **файлом** (не по URL)
- **Изоляция личных чатов** — все типы ботов работают только в личных сообщениях; в группах бот не отвечает и подсказывает открыть личный чат

### Исправлено

- **«Новости (N)» без текста** — надёжная отправка текста и фото с fallback; сервисный JWT если public API недоступен
- **«Нет новостей»** — фильтр просроченного `expiresAt`; статус «Опубликовано» по умолчанию; авто-`publishedAt`
- **Авторассылка** — baseline по timestamp; новости без ручной даты публикации
- **Управляющий бот v3.1** — только личные чаты; подсказка «Частный бот» с пояснением изоляции

### Изменено

- **Раздел «Информация»** — подсказка по полю «Скрыть после»; игнорирование даты окончания ≤ даты публикации

## [1.1.10] — 2026-07-09

### Добавлено

- **QR-код и ссылка на бота** — кнопка в таблице Telegram-ботов; модальное окно с `t.me`-ссылкой и QR
- **Массовые действия** на странице Telegram-ботов — экспорт CSV, запуск, остановка, удаление выбранных
- **Информационный бот v1.3** — фоновая рассылка новостей/акций подписчикам; по кнопке — последние 10 записей; регистрация `@username` при старте

### Изменено

- **Публичный доступ информационного бота** — без проверки Telegram ID; CRM endpoints `info-messages`, `washes`, `posts`, `post-states`, `work-modes`, `currencies` — `accessType: public`

### Исправлено

- **Ссылка на бота недоступна / fetch failed** — `pyorch-bridge` получил доступ в интернет; чтение `TELEGRAM_TOKEN` из PyOrchestrator; username регистрируется ботом при запуске; понятные сообщения об ошибках

## [1.1.9] — 2026-07-09

### Добавлено

- **MCP-сервер** (`services/crm-mcp`) — stdio MCP для AI-агентов (Cursor): CRM-сущности, composite tools, прокси Dynamic API MCP, Telegram-боты и команды постам через bridge

## [1.1.8] — 2026-07-09

### Изменено

- **Меню «Информация»** — перенесён в раздел «Главное» сразу после «Обзор»
- **Live / Статика** — в шапке глобальный переключатель автообновления данных вместо индикатора с разным интервалом на каждой странице; выбор сохраняется между сессиями

## [1.1.7] — 2026-07-09

### Исправлено

- **Автообновление из настроек** — при запуске из контейнера `update-bridge` bind mount'ы Mosquitto и build context используют реальный путь хоста (`WASH_HOST_PROJECT_ROOT`); шаг сборки больше не перезапускает Mosquitto; пересобираются `dynamic-api`, `dynamic-api-panel`, `init-seed`; после `git pull` в `.env` записывается `APP_VERSION`

## [1.1.6] — 2026-07-09

### Добавлено

- **Типы Telegram-ботов** — при создании/редактировании: **Управление**, **Сервисный**, **Информационный**; чекбоксы команд подставляются автоматически по пресету
- **Информационный бот** (шаблон v1.0) — публичное меню: новости, цены режимов, занятость постов, акции; лента публикаций из CRM
- **Раздел «Информация»** (`/info-messages`) — новости и акции с HTML-текстом, URL изображения, датой публикации, очередью и привязкой к мойке
- **MQTT outbox** — журнал исходящих команд с `message_id`, подтверждение доставки `set/ack`, повторная отправка при отсутствии ack
- **Уведомления** — настройка бота оповещений в CRM; красный индикатор непрочитанных на иконке колокольчика; чекбоксы `mqttCredit` / `mqttCollection`

### Изменено

- **Telegram-бот v2.9** — уникальное меню по чекбоксам CRM, RBAC в клавиатуре, валюта из справочника CRM, пересборка шаблона при сохранении и перезапуске
- **Уведомления** — все типы событий учитывают настройки; каналы web/Telegram; без дублей от сервисного аккаунта MQTT

### Исправлено

- Viewer в боте больше не видит кнопки создания и «полный доступ» при ограниченных правах
- Отчёты бота отображали ₽ при другой валюте в CRM

## [1.1.5] — 2026-07-08

### Изменено

- **Пагинация таблиц (DataTable)** — единый UX для всех таблиц CRM:
  - выпадающий список **«На странице»**: **20 / 40 / 60 / 80 / 100** (по умолчанию **20**);
  - кнопки **Назад** и **Далее** — постраничная навигация по загруженным строкам;
  - **Загрузить ещё (N записей)** — догрузка следующей порции из уже полученных данных (без перезагрузки всей таблицы).
- **История состояний поста** — больше не выводит тысячи строк сразу; старт с 20 записей, догрузка по кнопке.
- **Раздел MQTT** — над таблицей остаётся отдельная кнопка **«Загрузить ещё (100 записей)»** для подгрузки с API; в подвале таблицы — общая пагинация DataTable.
- **Карты** — аналогично: подгрузка с API пачками по 100 + пагинация в подвале таблицы.

## [1.1.4] — 2026-07-08

### Изменено

- **Пагинация таблиц** — вместо фиксированных 200 строк: выпадающий список **«На странице»** (50 / 100 / 200 / 500 / 1000, по умолчанию **100**) и кнопка **«Загрузить ещё (N записей)»** в стиле раздела MQTT
- Общий компонент `DataTable` — селектор размера страницы в подвале, догрузка следующей порции по выбранному размеру

## [1.1.3] — 2026-07-08

### Изменено

- **Пагинация таблиц** — «Назад/Далее» заменены на кнопку **«Загрузить ещё»**; таблицы показывают по **200 записей** с догрузкой следующих 200 (общий компонент `DataTable` → применяется ко всем таблицам)
- **История состояний поста** и другие крупные таблицы (Текущее состояние, MQTT, Логи, Уведомления, Финансы, Использование, справочники) — начальный вывод 200 строк вместо тысяч

## [1.1.2] — 2026-07-08

### Исправлено

- **Апдейтер не видел новую версию** — текущая версия читалась из `.env` (`APP_VERSION`), который при бампах не обновлялся; синхронизирован с релизом
- **Лимит GitHub API** — при исчерпании лимита (60 запросов/час без токена) проверка релизов молча возвращала «нет обновлений». Теперь выводится понятная причина и поддерживается `GITHUB_TOKEN` (лимит 5000/час)

### Добавлено

- `GITHUB_TOKEN` в `update-bridge` — авторизованные запросы к GitHub API для проверки обновлений
- Поле `error` в проверке компонента — UI показывает причину сбоя проверки (rate limit, сеть и т.д.)

## [1.1.1] — 2026-07-08

### Исправлено

- **Апдейтер зависал на «Сборка и перезапуск CRM»** — шаг `build` пересобирал сам `update-bridge`, из-за чего процесс обновления убивался (exit 137) и UI зависал навсегда; `update-bridge` исключён из этого шага (обновляется при полном `docker compose up -d --build`)
- **Незавершённые задачи обновления** после перезапуска сервиса больше не блокируют UI и новые запуски: при старте `update-bridge` помечает прерванные задачи как failed и очищает `activeJobId` (`recoverInterruptedJobs`)

## [1.1.0] — 2026-07-07

### Добавлено

- **Мастер настройки** (`/setup`, `/welcome`) — первичная настройка: объект, посты, MQTT, валюта, справочники; RBAC (Viewer — только просмотр)
- **Статус поста онлайн/оффлайн** — индикатор на страницах «Посты», «Текущее состояние» и карточке поста (порог 30 с по `lastMessageAt`)
- **Учётные записи MQTT постов** — `settings.mqttLogin` / `settings.mqttPassword` в карточке поста; синхронизация passwd и ACL через `POST /api/crm/post-device/mqtt/sync-users`
- **Изоляция постов в MQTT** — динамический ACL по `serialNumber`; подмена serial в payload игнорируется CRM
- Учётная запись **`system`** для CRM; пароль в **Настройки → MQTT (CRM)** (`mqtt-broker`); bootstrap — `MQTT_PASSWORD` в `.env`
- **Настройки устройства поста** в Dashboard: цены режимов (0–9), команды MQTT (перезагрузки, зачисление баланса, сервисные режимы), префикс `dt_pref`
- HTTP API `message-processor` (`:3022`) → nginx `/api/crm/post-device/` для публикации `set/prices` и `set/command`
- Нативный протокол WASH-PRO: топики `{dt_pref}/{serial}/state/*` (process, totals, usages, credit, card)
- Журнал применений карт: новая строка на каждое событие `state/card`; синхронизация баланса/скидки из `state/process`
- Уведомления в web и Telegram (настраиваемые типы событий на Обзоре); события `mqtt_credit`, `mqtt_collection`
- Страница профиля (`/profile`): имя, email, смена пароля
- Выбор видимых колонок в таблицах (DataTable)
- Автоматический редирект на `/login` при истечении сессии
- **Telegram-бот v2.7** — единый UI отчётов, детальные `/status`, `/washes`, `/posts`, `/revenue`, `/statistics`, `/cards`; режимы из справочника «Режимы работы»
- **Авторизация Telegram по CRM** — поле `telegramUserId` у пользователя; `GET /api/users/telegram/{id}/auth`; RBAC в боте (Viewer — только просмотр); посторонним — «Частный бот»
- **Обзор Dashboard** — круговые диаграммы «Использование» (клиенты/сервис/VIP) и доли оплаты (наличные/безнал/скидки)
- Документация: [Мастер настройки](docs/setup-wizard.md), [MQTT](docs/mqtt.md), [Telegram-боты](docs/telegram.md)

### Изменено

- **RabbitMQ заменён на MQTT (Mosquitto)** — телеметрия и DLQ через MQTT; скрипт `./scripts/migrate-to-mqtt.sh`
- Mosquitto: `per_listener_settings true`, динамический ACL, автоперезагрузка passwd/ACL после синхронизации
- `message-processor`: upsert статистики finance/usage по post+period; обработка credit и collection; DLQ-журнал
- Каскадное удаление автомоек и постов — `deleteMany` в MongoDB (без зависаний на больших объёмах)
- Бэкапы: bind mount `./data/backups`; исправлен статус «В процессе» при ручном бэкапе; автоархив по cron для 4 групп данных
- Карты: тип `collection` для инкассации на устройстве (уведомление без строки в разделе карт)
- Пагинация «Загрузить ещё» на страницах MQTT и карт
- **Telegram Dashboard** — список ботов не пропадает при старт/стоп; убрано поле admin Telegram IDs (доступ через Пользователи CRM)
- **pyorch-bridge** — остановка legacy-ботов PyOrchestrator, `refreshAllWashBots`, lock по токену, дедупликация сообщений
- PyOrchestrator vendored **v0.1.13** (submodule)

### Исправлено

- Анонимный MQTT на порту 1883 при `allow_anonymous` на healthcheck-порту 1884 (без `per_listener_settings`)
- `mosquitto_passwd ENOENT` в message-processor (пакет `mosquitto` в образе)
- UI после массового удаления моек (`clearCatalogCache`)
- Белый экран на `/profile` (populate `groupIds`)
- Скидка `0.00` на картах при рассинхроне `state/card` и `state/process`
- PATCH бэкапов без обязательного `filename`
- Дублирование ответов Telegram-бота (два процесса polling + старый шаблон PyOrchestrator)
- Иконка «прочитано» в уведомлениях на Обзоре

## [1.0.0] — начальный релиз

- Dashboard CRM/SCADA на React 18 + Dynamic API Platform v1.5.13
- Объекты, посты, состояние, карты, аналитика, RBAC
- Опциональный PyOrchestrator v0.1.10 (Telegram-боты)
- Резервное копирование MongoDB, архивирование

[Unreleased]: https://github.com/WASH-PRO/WASH-PRO-CRM/compare/v1.1.41...HEAD
[1.1.41]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.41
[1.1.40]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.40
[1.1.39]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.39
[1.1.38]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.38
[1.1.37]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.37
[1.1.36]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.36
[1.1.35]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.35
[1.1.34]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.34
[1.1.33]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.33
[1.1.32]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.32
[1.1.31]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.31
[1.1.30]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.30
[1.1.29]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.29
[1.1.28]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.28
[1.1.27]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.27
[1.1.26]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.26
[1.1.25]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.25
[1.1.24]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.24
[1.1.23]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.23
[1.1.22]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.22
[1.1.21]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.21
[1.1.20]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.20
[1.1.19]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.19
[1.1.18]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.18
[1.1.17]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.17
[1.1.16]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.16
[1.1.15]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.15
[1.1.14]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.14
[1.1.13]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.13
[1.1.12]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.12
[1.1.11]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.11
[1.1.10]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.10
[1.1.9]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.9
[1.1.8]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.8
[1.1.7]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.7
[1.1.6]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.6
[1.1.5]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.5
[1.1.4]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.4
[1.1.3]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.3
[1.1.2]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.2
[1.1.1]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.1
[1.1.0]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.1.0
[1.0.0]: https://github.com/WASH-PRO/WASH-PRO-CRM/releases/tag/v1.0.0
