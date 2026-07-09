# WASH PRO CRM Wiki

**Language:** **[English](en/README.md)** · [Русский](ru/README.md)

Sources for [GitHub Wiki](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki).

**Full documentation (GitHub Pages):** https://wash-pro.github.io/WASH-PRO-CRM/en/  
**Current version:** v1.1.13

Default language: **English**

## English

| File | Topic |
|------|-------|
| [Home](en/Home.md) | Overview |
| [Getting-Started](en/Getting-Started.md) | Quick start |
| [Setup-Wizard](en/Setup-Wizard.md) | Setup wizard |
| [Architecture](en/Architecture.md) | Architecture |
| [Dashboard](en/Dashboard.md) | Dashboard |
| [Embedded-Services](en/Embedded-Services.md) | Embedded services |
| [MQTT](en/MQTT.md) | MQTT |
| [Telegram](en/Telegram.md) | Telegram bots |
| [MCP](en/MCP.md) | MCP for AI agents |
| [Database-Schema](en/Database-Schema.md) | Database schema |

## Русский

| Файл | Раздел |
|------|--------|
| [Home](ru/Home.md) | Обзор |
| [Getting-Started](ru/Getting-Started.md) | Быстрый старт |
| [Setup-Wizard](ru/Setup-Wizard.md) | Мастер настройки |
| [Architecture](ru/Architecture.md) | Архитектура |
| [Dashboard](ru/Dashboard.md) | Dashboard |
| [Embedded-Services](ru/Embedded-Services.md) | Встроенные сервисы |
| [MQTT](ru/MQTT.md) | MQTT |
| [Telegram](ru/Telegram.md) | Telegram-боты |
| [MCP](ru/MCP.md) | MCP |
| [Database-Schema](ru/Database-Schema.md) | Схема данных |

Sync with [`docs/`](../docs/) when updating. To publish GitHub Wiki:

```bash
git clone https://github.com/WASH-PRO/WASH-PRO-CRM.wiki.git
# English pages (default):
cp wiki/en/*.md WASH-PRO-CRM.wiki/
# Or Russian:
# cp wiki/ru/*.md WASH-PRO-CRM.wiki/
cd WASH-PRO-CRM.wiki && git add -A && git commit -m "Sync wiki" && git push
```
