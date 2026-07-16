---
layout: default
title: Модули
description: Каталог расширений WASH PRO CRM — установка, PyOrchestrator, UI настроек
---

Модули — расширения CRM из **отдельных GitHub-репозиториев**. Управление: **Dashboard → Автоматизация → Модули** (роль Administrator).

## Архитектура

```
Dashboard  →  /api/crm/modules/*  →  modules-bridge  →  git clone / lifecycle
                                              ↓
                                    PyOrchestrator (daemon script)
                                              ↓
                              Dynamic API  http://dynamic-api:3001
```

| Компонент | Назначение |
|-----------|------------|
| `modules/registry.json` | Каталог доступных модулей в репозитории CRM |
| `modules-bridge` | Установка, start/stop/update/uninstall, раздача UI модуля |
| `modules/installed/` | Файлы установленных модулей + `data/` каждого модуля |
| PyOrchestrator | Отдельный процесс (daemon) для `src/main.py` модуля |

## Каталог

Файл [`modules/registry.json`](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/modules/registry.json) содержит список репозиториев. Обновляется из GitHub **без релиза CRM** — кнопка **«Обновить каталог»** на странице модулей.

Каждый репозиторий модуля обязан содержать **`wash-module.json`**:

| Поле | Описание |
|------|----------|
| `id` | Уникальный идентификатор |
| `name`, `description` | Локализованные `{ ru, en }` |
| `version`, `author`, `license`, `category` | Метаданные |
| `dependencies` | ID других модулей (устанавливаются первыми) |
| `entrypoint` | Путь к Python-скрипту, напр. `src/main.py` |
| `settingsSchema` | Поля настроек → secrets в PyOrchestrator |
| `icon` | SVG/PNG в репозитории |

## Установка и жизненный цикл

1. **Установить** — `git clone` в `modules/installed/{id}/`, регистрация скрипта в PyOrch
2. **Запустить / Остановить** — run/stop в оркестраторе
3. **Настройки** — iframe с `ui/index.html` из каталога модуля
4. **Обновить** — повторный clone (сохраняет `data/settings.json`)
5. **Удалить** — stop + delete script + полное удаление папки

Для запуска нужен PyOrchestrator: `PYORCHESTRATOR_ENABLED=true ./scripts/start.sh`

## Тестовые модули

| Модуль | API | Репозиторий |
|--------|-----|-------------|
| Монитор занятости постов | `GET /api/crm/post-states` | [wash-module-post-occupancy](https://github.com/WASH-PRO/wash-module-post-occupancy) |
| Сборщик загруженности | `GET /api/crm/usage-stats` | [wash-module-usage-stats](https://github.com/WASH-PRO/wash-module-usage-stats) |
| Стартер (шаблон) | heartbeat | [wash-module-starter](https://github.com/WASH-PRO/wash-module-starter) |
| VK публикатор | Публикации CRM → **текст** на стене VK (без картинок) | [wash-module-vk-publisher](https://github.com/WASH-PRO/wash-module-vk-publisher) |
| Автомойки рядом | CRM мойки → сайт «Автомойки рядом» (цены, посты, новости); связка через `mapsExternalId` (UUID) | [wash-module-washesnearby](https://github.com/WASH-PRO/wash-module-washesnearby) |

## Автомойки рядом и UUID мойки

У каждой автомойки в CRM есть поле **`mapsExternalId`** (UUID v4):

1. CRM генерирует UUID при создании мойки (Dashboard) или при `init-seed` (бэкфилл старых записей).
2. Модуль **Автомойки рядом** читает `mapsExternalId` и передаёт его на сайт как Owner API **`external_id`**.
3. Дальнейшие patch/telemetry идут как `ext:{uuid}` — CRM не зависит от числового id мойки на сайте.

После обновления CRM: дождитесь `init-seed` (или **Целостность → init-seed**), затем **Модули → Автомойки рядом → Обновить → Запустить**.

## VK публикатор *(v1.1.42, модуль v1.2.0)*

Модуль **VK публикатор** синхронизирует раздел **Публикации** с лентой сообщества ВКонтакте:

| Что | CRM / Telegram | VK |
|-----|----------------|-----|
| Заголовок и текст | ✅ | ✅ (HTML очищается) |
| `imageUrl`, HTML-разметка, эмодзи в разметке | ✅ | ❌ не передаётся |
| Ключ доступа | — | Ключ **сообщества** (`wall`, `groups`) — **photos не нужен** |

После обновления CRM: **Автоматизация → Модули → VK публикатор → Обновить → Перезапустить**.

Демо-публикации: `node scripts/reset-info-messages-vk-demo.mjs`

## Страница «Модули» *(v1.1.30)*

- Поиск по названию/описанию, фильтры: установлен / запущен / категория
- Пагинация и **Загрузить ещё**
- Заголовок и иконка карточки ведут в настройки; кнопки действий — только иконки с подсказками
- **Обновить каталог** подтягивает `registry.json` из GitHub без релиза CRM

### Разделы «Установленные» / «Доступные» *(v1.1.38)*

Каталог разделён на два блока: **Установленные** (запущенные модули с действиями lifecycle) и **Доступные** (ещё не установлены). В каждом блоке — своя пагинация. Фильтры статуса и категории применяются к обоим разделам.

## Safari и починка из браузера *(v1.1.33)*

Если **Автоматизация → Модули** в Safari падает с *«The string did not match the expected pattern»*, обновитесь до **v1.1.33+** или используйте **Настройки → Целостность и исправление** для пересборки `modules-bridge` и dashboard без SSH.

## Уведомления о модулях *(v1.1.34)*

События установки, удаления, запуска, остановки, обновления и ошибок модулей попадают в **Система → Уведомления** (web + Telegram при настройке). См. [Dashboard](dashboard.md).

## Создание своего модуля

```bash
git clone https://github.com/WASH-PRO/wash-module-starter my-module
cd my-module
# измените wash-module.json и src/main.py
```

Структура:

```
my-module/
├── wash-module.json
├── src/main.py
├── ui/index.html
├── ui/wash-module-sdk.js
├── assets/icon.svg
├── README.md          # English (по умолчанию)
├── README.ru.md       # Русский
├── ui/help.html       # Справка (English)
└── ui/help.ru.html    # Справка (русский)
```

Секреты окружения в runtime: `API_BASE_URL`, `MODULE_DATA_DIR`, настройки из schema (напр. `POLL_INTERVAL`).

UI вызывает API через `WashModule.api()` — токен берётся из `localStorage` (`wash_crm_token`).

## API modules-bridge

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/crm/modules/health` | Health (+ доступность PyOrch) |
| GET | `/api/crm/modules/catalog` | Каталог |
| POST | `/api/crm/modules/install/:id` | Установка |
| POST | `/api/crm/modules/installed/:id/start` | Запуск |
| POST | `/api/crm/modules/installed/:id/stop` | Остановка |
| POST | `/api/crm/modules/installed/:id/update` | Обновление |
| DELETE | `/api/crm/modules/installed/:id` | Удаление |
| GET | `/api/crm/modules/icon/:id` | Иконка модуля (SVG/PNG) |
| GET | `/api/crm/modules/installed/:id/logs` | Логи запуска PyOrchestrator |
| GET | `/api/crm/modules/ui/:id/` | UI модуля |

Все mutating endpoints требуют JWT с правами administrator (`manage_users` / `manage_api`).

## Публикация в каталог

1. Создайте публичный репозиторий с `wash-module.json`
2. Добавьте запись в `modules/registry.json` основного CRM
3. Push в `main` — каталог подхватит модуль после refresh

См. также [Встроенные сервисы](embedded-services.md), [Telegram-боты](telegram.md), [Устранение неполадок](troubleshooting.md).
