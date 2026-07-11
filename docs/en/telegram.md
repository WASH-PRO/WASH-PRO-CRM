---
layout: default
title: Telegram bots
description: Bot types, information feed, QR links, RBAC, and private chat isolation
---

WASH PRO CRM Telegram bots run through **PyOrchestrator** and the **`pyorch-bridge`** service. Management — **Dashboard → Automation → Telegram** (Administrator role required).

## Architecture

```
Telegram user (private chat)
        ↓
   Telegram API (long polling)
        ↓
PyOrchestrator runtime (main.py from botTemplate / infoBotTemplate)
        ↓
Dynamic API  —  CRM endpoints (JWT service or public)
```

| Component | Purpose |
|-----------|---------|
| `pyorch-bridge` | Bot creation, secrets, template sync, restart, QR/link |
| `botTemplate.ts` | Management and service bot (template **v3.1**) |
| `infoBotTemplate.ts` | Information bot (template **v1.9**) |
| Dynamic API | RBAC, feed `/api/crm/info-messages`, auth `/api/users/telegram/{id}/auth` |

## Bot types

| Type | Purpose | Access |
|------|---------|--------|
| **Management** | Full operator bot: monitoring, reference data, post commands | CRM RBAC by Telegram ID |
| **Service** | Monitoring and post commands without create/delete sites | CRM RBAC |
| **Information** | Public menu: news, prices, occupancy, promotions | **No Telegram ID** — any user in private chat |

On bot creation, select type — command preset is applied automatically.

## Private chats and isolation (v1.1.11)

All bots work **only in private messages**:

- each user sees **only their own** dialog with the bot;
- replies, menus, and broadcasts do not appear in group chats;
- if the bot is added to a group — it does not respond there and sends a hint in private: open the bot via QR/link and press `/start`.

**QR code and link** (`t.me/...`) in the bots table lead the user to a **private chat**.

## Information bot

### Menu

| Button | Content |
|--------|---------|
| 📰 News | Latest 10 published news items |
| 💰 Prices | Modes and prices for selected wash |
| 🅿️ Occupancy | Free/busy posts (v2.2: **free** only in `program_9` — payment entry) |
| 🎁 Promotions | Latest 10 promotions |

### Content — Information section

**Dashboard → Automation → Publications** (`/info-messages`):

| Field | Recommendation |
|-------|----------------|
| **Status** | "Published" — otherwise bot won't show the entry. "Scheduled" with past date displays as **Published** in table (v1.1.12) |
| **Publication date** | Optional — set automatically on publish |
| **Hide after** | Leave **empty** if news should not disappear. Do not set date ≤ publication date |
| **Image URL** | Direct jpg/png/webp link up to 10 MB; bot downloads file and sends to Telegram |

### Auto-broadcast

1. User sends `/start` to bot in **private chat** (subscriber registration).
2. On news publish in CRM, bot broadcasts to subscribers (~30 s).
3. News published **before** user's first `/start` are not in auto-broadcast — open via **📰 News** button.

### Images (v1.9)

Bot **downloads** image from `imageUrl` and sends **one message** (photo + caption, no duplicate text). If photo unavailable — text news is sent. URL requirements:

- accessible from internet (`pyorch-runtime` container);
- direct file link;
- size up to 10 MB.

## Management and service bot

### Creation

1. `PYORCHESTRATOR_ENABLED=true` in `.env`, then `./scripts/start.sh`
2. **Dashboard → Telegram → Create bot**
3. Token from [@BotFather](https://t.me/BotFather), type, commands
4. Start (▶)

```bash
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build pyorch-bridge
```

Force template update for all bots: `POST /api/telegram-bots/bots/refresh`.

### Staff authorization

1. Telegram ID — [@userinfobot](https://t.me/userinfobot)
2. **Dashboard → Users** → **Telegram user_id** field
3. RBAC group (Viewer / Operator / Administrator)

Bot calls `GET /api/users/telegram/{telegramUserId}/auth`. Others get only "Private bot" with their ID.

| Permission | In bot |
|------------|--------|
| `view` | Monitoring, reports |
| `create` | Create washes and posts |
| `update` | Post commands |
| `delete` | Delete sites |

### Bulk actions (v1.1.10)

On **Telegram** page — row checkboxes: CSV export, start, stop, delete selected bots.

## Reliability

| Mechanism | Description |
|-----------|-------------|
| Token lock | One polling process per token |
| Offset / state | No duplicates after restart |
| Private only | Ignore groups and channels |
| Template | `syncBotCode` on bridge start and before restart |
| Username | Register `@username` on bot start + read token from PyOrchestrator for QR |

## Troubleshooting

| Symptom | Action |
|---------|--------|
| "PyOrchestrator unavailable" | `PYORCHESTRATOR_ENABLED=true`, health `curl localhost/api/telegram-bots/health` |
| "No news" / empty feed | Status **Published**; clear "Hide after"; restart bot |
| "News (2)" without text/photo | Update `pyorch-bridge`, restart bot (v1.9+); check image URL |
| No auto-broadcast | User must press `/start` in private **before** or **after** publish; wait ~30 s |
| Bot link unavailable | Restart bot; if needed save token in bot settings |
| Bot responds in group | Expected disabled — use private chat via QR |
| "Private bot" for staff | **Users** → Telegram user_id, status active |
| Bot silent | `./scripts/fix-pyorch.sh`, logs `docker logs wash-pyorch-runtime` |

Details: [Troubleshooting](troubleshooting.md).

## Bridge API (admin JWT)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/telegram-bots/health` | PyOrchestrator availability |
| GET | `/api/telegram-bots/bots` | Bot list |
| POST | `/api/telegram-bots/bots` | Create |
| PUT | `/api/telegram-bots/bots/:id` | Update |
| DELETE | `/api/telegram-bots/bots/:id` | Delete |
| POST | `/api/telegram-bots/bots/:id/start` | Start |
| POST | `/api/telegram-bots/bots/:id/stop` | Stop |
| POST | `/api/telegram-bots/bots/stop-all` | Stop all bots (v1.1.15) |
| GET | `/api/telegram-bots/bots/:id/link` | QR and `t.me/...` link |
| POST | `/api/telegram-bots/bots/refresh` | Template sync + restart |

See also: [Embedded services](embedded-services.md), [Dashboard](dashboard.md), [MCP](mcp.md), [Security](security.md).
