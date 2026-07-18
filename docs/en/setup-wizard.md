---
layout: default
title: Setup wizard
description: First-run setup wizard for WASH PRO CRM — company profile, washes, posts, users, and integrations after installation.
---

After the first Dashboard login, you are redirected to the **setup wizard** (`/setup`) until the CRM flag `settings.setup.complete = true` is set.

## Wizard steps

| Step | Content |
|------|---------|
| **Start** | Brief overview of the process |
| **Infrastructure** | API availability check (`/api/health`) |
| **Site** | Create a car wash or remove the demo site |
| **Posts** | Serial numbers, **MQTT login/password** for each post |
| **Currency** | Currency reference, default currency |
| **MQTT** | Sync Mosquitto accounts with CRM |
| **Reference data** | Work modes, discount types |
| **Done** | Complete the wizard |

After completion — welcome page (`/welcome`), then the regular Dashboard.

## RBAC

| Role | Wizard |
|------|--------|
| **Administrator** | Full access, can complete the wizard |
| **Operator** | Create/edit sites, posts, reference data; can complete the wizard |
| **Viewer** | View steps only; must acknowledge to enter CRM |

Users with **update** permission (Administrator, Operator) can complete the wizard (`complete: true`).

## Demo data

`init-seed` creates a demo car wash "Central" and posts `WP-POST-001` / `WP-POST-002`. In the wizard you can delete them with one button or replace them with your own sites.

## Restarting the wizard

- **System → Setup wizard** (Administrator / Operator)
- Direct link: `/setup?restart=1`

## MQTT on the "MQTT" step

The **"Sync MQTT"** button calls `POST /api/crm/post-device/mqtt/sync-users`:

- recreates Mosquitto `passwd` (`system` + post logins);
- generates **ACL** — each post only in topics of its `serialNumber`;
- Mosquitto picks up changes automatically (passwd/ACL reload).

Sync also runs when saving a post in the **Posts** section.

## State storage

The `setup` setting in `/api/crm/settings` (key `setup`):

```json
{
  "complete": true,
  "completedAt": "2026-07-07T12:00:00.000Z",
  "completedBy": { "userId": "…", "login": "admin" },
  "skippedSteps": []
}
```

See also: [Quick start](getting-started.md), [MQTT](mqtt.md), [Dashboard — Posts](dashboard.md#posts).
