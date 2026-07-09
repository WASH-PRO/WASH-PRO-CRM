#!/usr/bin/env bash
# Publish wiki/en/ and wiki/ru/ to GitHub Wiki (https://github.com/WASH-PRO/WASH-PRO-CRM/wiki)
# GitHub Wiki does not support nested paths — pages are flattened to en-Page.md / ru-Page.md.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WIKI_REPO="${WIKI_REPO:-https://github.com/WASH-PRO/WASH-PRO-CRM.wiki.git}"
CLONE_DIR="$(mktemp -d)"
trap 'rm -rf "$CLONE_DIR"' EXIT

python3 "$ROOT/scripts/fix-wiki-links.py"

git clone --depth 1 "$WIKI_REPO" "$CLONE_DIR"
cd "$CLONE_DIR"

# Remove legacy nested layout from earlier syncs.
rm -rf en ru

# Root landing — language hub (GitHub Wiki opens Home.md by default)
cat > Home.md <<'EOF'
# WASH PRO CRM Wiki

**Language:** **[English](en-Home)** · [Русский](ru-Home)

Sources synced from the main repository. **Default language: English.**

**Full documentation (GitHub Pages):** https://wash-pro.github.io/WASH-PRO-CRM/en/  
**Current version:** v1.1.15

## English

| Page | Topic |
|------|-------|
| [Home](en-Home) | Overview |
| [Getting-Started](en-Getting-Started) | Quick start |
| [Setup-Wizard](en-Setup-Wizard) | Setup wizard |
| [Architecture](en-Architecture) | Architecture |
| [Dashboard](en-Dashboard) | Dashboard |
| [Embedded-Services](en-Embedded-Services) | Embedded services |
| [MQTT](en-MQTT) | MQTT |
| [Telegram](en-Telegram) | Telegram bots |
| [MCP](en-MCP) | MCP for AI agents |
| [Database-Schema](en-Database-Schema) | Database schema |

## Русский

| Страница | Раздел |
|----------|--------|
| [Home](ru-Home) | Обзор |
| [Getting-Started](ru-Getting-Started) | Быстрый старт |
| [Setup-Wizard](ru-Setup-Wizard) | Мастер настройки |
| [Architecture](ru-Architecture) | Архитектура |
| [Dashboard](ru-Dashboard) | Dashboard |
| [Embedded-Services](ru-Embedded-Services) | Встроенные сервисы |
| [MQTT](ru-MQTT) | MQTT |
| [Telegram](ru-Telegram) | Telegram-боты |
| [MCP](ru-MCP) | MCP |
| [Database-Schema](ru-Database-Schema) | Схема данных |
EOF

for f in "$ROOT/wiki/en/"*.md; do
  base="$(basename "$f" .md)"
  cp "$f" "en-${base}.md"
done

for f in "$ROOT/wiki/ru/"*.md; do
  base="$(basename "$f" .md)"
  cp "$f" "ru-${base}.md"
done

git add -A
if git diff --staged --quiet; then
  echo "Wiki already up to date."
  exit 0
fi

git commit -m "docs: flatten wiki pages to en-/ru- slugs (fix 404 links)"
git push origin HEAD

echo "Published: https://github.com/WASH-PRO/WASH-PRO-CRM/wiki"
