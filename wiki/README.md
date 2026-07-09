# WASH PRO CRM Wiki

**Language:** **[English](en/README)** · [Русский](ru/README)

Sources for [GitHub Wiki](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki).

**Full documentation (GitHub Pages):** https://wash-pro.github.io/WASH-PRO-CRM/en/  
**Current version:** v1.1.13

Default language: **English**

## English

| File | Topic |
|------|-------|
| [Home](en/Home) | Overview |
| [Getting-Started](en/Getting-Started) | Quick start |
| [Setup-Wizard](en/Setup-Wizard) | Setup wizard |
| [Architecture](en/Architecture) | Architecture |
| [Dashboard](en/Dashboard) | Dashboard |
| [Embedded-Services](en/Embedded-Services) | Embedded services |
| [MQTT](en/MQTT) | MQTT |
| [Telegram](en/Telegram) | Telegram bots |
| [MCP](en/MCP) | MCP for AI agents |
| [Database-Schema](en/Database-Schema) | Database schema |

## Русский

| Файл | Раздел |
|------|--------|
| [Home](ru/Home) | Обзор |
| [Getting-Started](ru/Getting-Started) | Быстрый старт |
| [Setup-Wizard](ru/Setup-Wizard) | Мастер настройки |
| [Architecture](ru/Architecture) | Архитектура |
| [Dashboard](ru/Dashboard) | Dashboard |
| [Embedded-Services](ru/Embedded-Services) | Встроенные сервисы |
| [MQTT](ru/MQTT) | MQTT |
| [Telegram](ru/Telegram) | Telegram-боты |
| [MCP](ru/MCP) | MCP |
| [Database-Schema](ru/Database-Schema) | Схема данных |

Sync with [`docs/`](../docs/) when updating. To publish GitHub Wiki:

```bash
./scripts/sync-github-wiki.sh
./scripts/validate-wiki-links.sh   # optional check before publish
```

This pushes `wiki/en/` and `wiki/ru/` to [WASH-PRO-CRM.wiki](https://github.com/WASH-PRO/WASH-PRO-CRM.wiki) with a bilingual `Home.md` hub.

Manual alternative:

```bash
git clone https://github.com/WASH-PRO/WASH-PRO-CRM.wiki.git
cp wiki/en/*.md WASH-PRO-CRM.wiki/en/
cp wiki/ru/*.md WASH-PRO-CRM.wiki/ru/
# update Home.md — see scripts/sync-github-wiki.sh
cd WASH-PRO-CRM.wiki && git add -A && git commit -m "Sync wiki" && git push
```
