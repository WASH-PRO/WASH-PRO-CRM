# WASH PRO CRM Wiki

**Language:** **[English](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/en-README)** · [Русский](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/ru-README)

Sources for [GitHub Wiki](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki).

**Full documentation (GitHub Pages):** https://wash-pro.github.io/WASH-PRO-CRM/en/  
**Current version:** v1.1.30

Default language: **English**

## English

| File | Topic |
|------|-------|
| [Home](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/en-Home) | Overview |
| [Getting-Started](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/en-Getting-Started) | Quick start |
| [Setup-Wizard](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/en-Setup-Wizard) | Setup wizard |
| [Architecture](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/en-Architecture) | Architecture |
| [Dashboard](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/en-Dashboard) | Dashboard |
| [Embedded-Services](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/en-Embedded-Services) | Embedded services |
| [MQTT](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/en-MQTT) | MQTT |
| [Telegram](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/en-Telegram) | Telegram bots |
| [Modules](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/en-Modules) | CRM modules |
| [MCP](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/en-MCP) | MCP for AI agents |
| [Database-Schema](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/en-Database-Schema) | Database schema |

## Русский

| Файл | Раздел |
|------|--------|
| [Home](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/ru-Home) | Обзор |
| [Getting-Started](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/ru-Getting-Started) | Быстрый старт |
| [Setup-Wizard](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/ru-Setup-Wizard) | Мастер настройки |
| [Architecture](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/ru-Architecture) | Архитектура |
| [Dashboard](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/ru-Dashboard) | Dashboard |
| [Embedded-Services](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/ru-Embedded-Services) | Встроенные сервисы |
| [MQTT](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/ru-MQTT) | MQTT |
| [Telegram](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/ru-Telegram) | Telegram-боты |
| [Modules](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/ru-Modules) | Модули CRM |
| [MCP](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/ru-MCP) | MCP |
| [Database-Schema](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/ru-Database-Schema) | Схема данных |

Sync with [`docs/`](https://github.com/WASH-PRO/WASH-PRO-CRM/tree/main/docs) when updating. To publish GitHub Wiki:

```bash
./scripts/sync-github-wiki.sh
./scripts/validate-wiki-links.sh   # optional check before publish
./scripts/validate-docs-links.sh   # README + GitHub Pages link patterns
```

This flattens `wiki/en/` and `wiki/ru/` to `en-Page.md` / `ru-Page.md` on [WASH-PRO-CRM.wiki](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki) (GitHub Wiki does not support nested paths).

Manual alternative:

```bash
git clone https://github.com/WASH-PRO/WASH-PRO-CRM.wiki.git
for f in wiki/en/*.md; do cp "$f" "WASH-PRO-CRM.wiki/en-$(basename "$f")"; done
for f in wiki/ru/*.md; do cp "$f" "WASH-PRO-CRM.wiki/ru-$(basename "$f")"; done
# update Home.md — see scripts/sync-github-wiki.sh
cd WASH-PRO-CRM.wiki && git add -A && git commit -m "Sync wiki" && git push
```
