# Telegram-боты

Полная документация: [docs/telegram.md](../docs/telegram.md) · [GitHub Pages — Telegram](https://wash-pro.github.io/WASH-PRO-CRM/telegram/)

## v1.1.11 — кратко

| Тема | Содержание |
|------|------------|
| **Типы** | Управление · Сервисный · **Информационный** (публичный) |
| **Изоляция** | Только **личные чаты** — группы не поддерживаются |
| **Информационный бот v1.8** | Новости/акции из **Информация**; рассылка; фото **файлом** |
| **QR / ссылка** | Кнопка в таблице ботов → `t.me/...` |
| **Массовые действия** | Запуск, стоп, удаление, CSV |
| **Управляющий v3.1** | CRM RBAC по Telegram ID в **Пользователи** |

## Информационный бот

1. **Dashboard → Информация** — создайте новость, статус **Опубликовано**
2. **Dashboard → Telegram** — информационный бот, ▶ запуск
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

См. [Embedded-Services](Embedded-Services), [Troubleshooting](https://wash-pro.github.io/WASH-PRO-CRM/troubleshooting/).
