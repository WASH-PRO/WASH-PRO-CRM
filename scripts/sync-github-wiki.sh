#!/usr/bin/env bash
# Publish wiki/en/ and wiki/ru/ to GitHub Wiki (https://github.com/WASH-PRO/WASH-PRO-CRM/wiki)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WIKI_REPO="${WIKI_REPO:-https://github.com/WASH-PRO/WASH-PRO-CRM.wiki.git}"
CLONE_DIR="$(mktemp -d)"
trap 'rm -rf "$CLONE_DIR"' EXIT

git clone --depth 1 "$WIKI_REPO" "$CLONE_DIR"
cd "$CLONE_DIR"

# Root landing — language hub (GitHub Wiki opens Home.md by default)
cat > Home.md <<'EOF'
# WASH PRO CRM Wiki

**Language:** **[English](en/Home)** · [Русский](ru/Home)

Sources synced from the main repository. **Default language: English.**

**Full documentation (GitHub Pages):** https://wash-pro.github.io/WASH-PRO-CRM/en/  
**Current version:** v1.1.14

## English

| Page | Topic |
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

| Страница | Раздел |
|----------|--------|
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
EOF

mkdir -p en ru
cp "$ROOT/wiki/en/"*.md en/
cp "$ROOT/wiki/ru/"*.md ru/

git add -A
if git diff --staged --quiet; then
  echo "Wiki already up to date."
  exit 0
fi

git commit -m "docs: sync bilingual wiki (en/ru) from main repo"
git push origin HEAD

echo "Published: https://github.com/WASH-PRO/WASH-PRO-CRM/wiki"
