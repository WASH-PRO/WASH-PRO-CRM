**Язык:** [English](README.md) · **Русский**

# Модули WASH PRO CRM

Расширения системы: отдельные репозитории, устанавливаются в `modules/installed/`.

| Путь | Назначение |
|------|------------|
| `registry.json` | Каталог доступных модулей (обновляется из основного репозитория) |
| `installed/` | Установленные модули (не коммитятся в git) |

Каждый модуль содержит `wash-module.json`, исходники, UI (`ui/`) и при установке получает каталог `data/`.

Документация: [GitHub Pages — Модули](https://wash-pro.github.io/WASH-PRO-CRM/ru/modules/).

Каталог: `registry.json`. Иконки модулей без GitHub-репозитория — в `modules/icons/{id}.svg`, отдаются через `/api/crm/modules/icon/{id}`.

Репозитории: [post-occupancy](https://github.com/WASH-PRO/wash-module-post-occupancy), [usage-stats](https://github.com/WASH-PRO/wash-module-usage-stats), [starter](https://github.com/WASH-PRO/wash-module-starter), [vk-publisher](https://github.com/WASH-PRO/wash-module-vk-publisher) (v1.2.0 — **только текст** во VK; картинки для CRM/Telegram), [washesnearby](https://github.com/WASH-PRO/wash-module-washesnearby).

## Локализация

Как в основном репозитории CRM:

| Файл | Язык |
|------|------|
| `README.md` | English (по умолчанию) |
| `README.ru.md` | Русский |
| `ui/help.html` | Справка, English |
| `ui/help.ru.html` | Справка, русский |

Dashboard подставляет `help.html` или `help.ru.html` по выбранному языку интерфейса.
