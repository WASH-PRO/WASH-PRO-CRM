> **[English](en-Modules)** · **Русский** · [← Wiki](Home)

# Модули

Полная документация: [GitHub Pages — Модули](https://wash-pro.github.io/WASH-PRO-CRM/ru/modules/)

## Кратко

| Тема | Содержание |
|------|------------|
| **Меню CRM** | **Автоматизация → Модули** (`/modules`) |
| **Каталог** | `modules/registry.json` в репозитории CRM |
| **Bridge** | `modules-bridge:3024` → `/api/crm/modules/` |
| **Runtime** | PyOrchestrator daemon + `http://dynamic-api:3001` |

## Быстрый старт

1. **Dashboard → Автоматизация → Модули**
2. **Установить** модуль из раздела «Доступные»
3. Включите PyOrch: `PYORCHESTRATOR_ENABLED=true ./scripts/start.sh`
4. **Запустить** → **Настройки** (UI модуля в iframe)

## Репозитории

| Модуль | GitHub |
|--------|--------|
| Монитор занятости | [wash-module-post-occupancy](https://github.com/WASH-PRO/wash-module-post-occupancy) |
| Загруженность | [wash-module-usage-stats](https://github.com/WASH-PRO/wash-module-usage-stats) |
| VK публикатор | [wash-module-vk-publisher](https://github.com/WASH-PRO/wash-module-vk-publisher) |

## Свой модуль

```bash
git clone https://github.com/WASH-PRO/wash-module-starter my-module
```

Обязательные файлы: `wash-module.json`, `src/main.py`, `ui/index.html`.

Добавьте запись в `modules/registry.json` CRM и выполните push.

## Safari и починка *(v1.1.33)*

Исправление JWT в v1.1.33+. Если страница всё ещё падает — **Настройки → Целостность и исправление**, пересборка `modules-bridge` без SSH.

## Уведомления *(v1.1.34)*

События install/start/stop/update модулей — в **Система → Уведомления**.

См. [Embedded-Services](ru-Embedded-Services), [Telegram](ru-Telegram), [Dashboard](ru-Dashboard).
