> **English** · **[Русский](ru-Telegram)** · [← Wiki](Home)

# Telegram Bots

Full documentation: [GitHub Pages — Telegram](https://wash-pro.github.io/WASH-PRO-CRM/en/telegram/)

## v1.1.12 — summary

| Topic | Details |
|-------|---------|
| **CRM menu** | **Automation →** Telegram, Publications |
| **Information v2.2** | Photo + caption in one message; occupancy: free only in `program_9` |
| **Publications** | "Scheduled" → "Published" after publish time passes |

## v1.1.11 — summary

| Topic | Details |
|-------|---------|
| **Types** | Management · Service · **Information** (public) |
| **Isolation** | **Private chats only** — groups not supported |
| **QR / link** | Button in bots table → `t.me/...` |
| **Bulk actions** | Start, stop, delete, CSV |
| **Management v3.1** | CRM RBAC by Telegram ID in **Users** |

## Information bot

1. **Dashboard → Automation → Publications** — create news, status **Published** or **Scheduled**
2. **Dashboard → Automation → Telegram** — information bot, ▶ start
3. Client: QR → private chat → `/start` → **📰 News**

**Important:** leave "Hide after" empty if the news item should not disappear.

## Management bot

- **Dashboard → Telegram** + @BotFather token
- **Users → Telegram user_id** + RBAC group
- Viewer — view; Operator — commands; Administrator — all

## Template update

```bash
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build pyorch-bridge
# Dashboard → Telegram → restart bots
```

See [Embedded-Services](en-Embedded-Services), [MCP](en-MCP), [Troubleshooting](https://wash-pro.github.io/WASH-PRO-CRM/en/troubleshooting/).
