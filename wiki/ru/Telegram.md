> **[English](en-Telegram)** · **Русский** · [← Wiki](Home)

# Telegram-боты

Полная документация: [GitHub Pages — Telegram](https://wash-pro.github.io/WASH-PRO-CRM/ru/telegram/)

## v1.1.12 — кратко

| Тема | Содержание |
|------|------------|
| **Меню CRM** | **Автоматизация →** Telegram, Информация |
| **Информационный v2.2** | Фото + подпись одним сообщением; занятость: свободен только `program_9` |
| **Информация** | «По расписанию» → «Опубликовано» после наступления времени |

## v1.1.11 — кратко

| Тема | Содержание |
|------|------------|
| **Типы** | Управление · Сервисный · **Информационный** (публичный) |
| **Изоляция** | Только **личные чаты** — группы не поддерживаются |
| **QR / ссылка** | Кнопка в таблице ботов → `t.me/...` |
| **Массовые действия** | Запуск, стоп, удаление, CSV |
| **Управляющий v3.1** | CRM RBAC по Telegram ID в **Пользователи** |

## Информационный бот

1. **Dashboard → Автоматизация → Информация** — создайте новость, статус **Опубликовано** или **По расписанию**
2. **Dashboard → Автоматизация → Telegram** — информационный бот, ▶ запуск
3. Клиент: QR → личный чат → `/start` → **📰 Новости**

**Важно:** поле «Скрыть после» оставляйте пустым, если новость не должна исчезать.

## Управляющий бот

- **Dashboard → Telegram** + токен @BotFather
- **Пользователи → Telegram user_id** + группа RBAC
- Viewer — просмотр; Operator — команды; Administrator — всё

## Обновление шаблона

```bash
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build pyorch-bridge
# Dashboard → Telegram → перезапуск ботов
```

См. [Embedded-Services](ru-Embedded-Services), [MCP](ru-MCP), [Troubleshooting](https://wash-pro.github.io/WASH-PRO-CRM/ru/troubleshooting/).
