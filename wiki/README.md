# Wiki WASH PRO CRM

Исходники для [GitHub Wiki](https://github.com/WASH-PRO/WASH-PRO-CRM/wiki).

**Полная документация (GitHub Pages):** https://wash-pro.github.io/WASH-PRO-CRM/  
**Текущая версия:** v1.1.12

| Файл | Wiki |
|------|------|
| [Home.md](Home.md) | Home |
| [Getting-Started.md](Getting-Started.md) | Getting-Started |
| [Setup-Wizard.md](Setup-Wizard.md) | Setup-Wizard |
| [Architecture.md](Architecture.md) | Architecture |
| [MQTT.md](MQTT.md) | MQTT |
| [Telegram.md](Telegram.md) | Telegram |
| [MCP.md](MCP.md) | MCP |
| [Embedded-Services.md](Embedded-Services.md) | Embedded-Services |
| [Dashboard.md](Dashboard.md) | Dashboard |
| [Database-Schema.md](Database-Schema.md) | Database-Schema |

Синхронизируйте с [`docs/`](../docs/) при обновлениях. После релиза обновите wiki-клон:

```bash
git clone https://github.com/WASH-PRO/WASH-PRO-CRM.wiki.git
cp wiki/*.md WASH-PRO-CRM.wiki/
cd WASH-PRO-CRM.wiki && git add -A && git commit -m "Sync wiki v1.1.12" && git push
```
