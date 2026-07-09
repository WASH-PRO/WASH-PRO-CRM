#!/usr/bin/env python3
"""Normalize wiki markdown links for GitHub Wiki (flat en-Page / ru-Page slugs)."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WIKI = ROOT / 'wiki'
PAGES = [
    'Architecture',
    'Dashboard',
    'Database-Schema',
    'Embedded-Services',
    'Getting-Started',
    'Home',
    'MCP',
    'MQTT',
    'README',
    'Setup-Wizard',
    'Telegram',
]
WIKI_HUB_PLACEHOLDER = '__WIKI_HUB__'


def fix_page_content(text: str, lang: str) -> str:
    text = re.sub(r'\]\((en|ru)/([^)]+)\)', r'](\1-\2)', text)
    text = text.replace('](../Home)', '](Home)')
    text = text.replace('[← Wiki](Home)', f'[← Wiki]({WIKI_HUB_PLACEHOLDER})')

    for page in PAGES:
        slug = f'{lang}-{page}'
        text = re.sub(rf'\]\({re.escape(page)}\)', f']({slug})', text)

    text = text.replace(f'[← Wiki]({WIKI_HUB_PLACEHOLDER})', '[← Wiki](Home)')
    return text


def fix_readme_hub(text: str) -> str:
    text = re.sub(
        r'\]\((en|ru)/([^)]+)\)',
        r'](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/\1-\2)',
        text,
    )
    for page in PAGES:
        for lang in ('en', 'ru'):
            text = text.replace(
                f']({lang}-{page})',
                f'](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki/{lang}-{page})',
            )
    return text


def main() -> int:
    changed = 0
    for lang in ('en', 'ru'):
        for path in sorted((WIKI / lang).glob('*.md')):
            original = path.read_text(encoding='utf-8')
            updated = fix_page_content(original, lang)
            if updated != original:
                path.write_text(updated, encoding='utf-8')
                changed += 1
                print(f'fixed: {path.relative_to(ROOT)}')

    readme = WIKI / 'README.md'
    if readme.exists():
        original = readme.read_text(encoding='utf-8')
        updated = fix_readme_hub(original)
        if updated != original:
            readme.write_text(updated, encoding='utf-8')
            changed += 1
            print(f'fixed: {readme.relative_to(ROOT)}')

    print(f'Done ({changed} file(s) updated).')
    return 0


if __name__ == '__main__':
    sys.exit(main())
