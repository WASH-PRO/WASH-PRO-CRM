---
layout: default
title: Қауіпсіздік
description: RBAC, желі және ұсыныстар
---

## Принциптер

1. **Шабуыл бетінің минимумы** — сыртқа: Dashboard, Dynamic API, платформа панельдері
2. **MongoDB-ге тікелей қолжетімділік жоқ** — тек JWT бар API арқылы
3. **Оқшауланған желі** `wash-internal` БД және кезектер үшін
4. **RBAC** — Dynamic API топтары + Dashboard Admin бөлімдері

## CRM рөлдері (init-seed)

| Топ | Permissions | Dashboard |
|-----|-------------|-----------|
| **Administrator** | view, create, update, delete, manage_users, manage_api, view_logs | Толық қолжетімділік + Жүйе (admin) |
| **Operator** | view, create, update | admin-сыз CRM |
| **Viewer** | view | Тек көру |
| **Service** | view (+ automation API) | Ішкі сервистер |

Dashboard admin бөлімдері (пайдаланушылар, топтар, бэкаптар, Telegram, логтар…) JWT-де `manage_users` **немесе** `view_logs` талап етеді.

Басқару: **Dashboard → Пайдаланушылар / Топтар мен құқықтар** немесе **Dynamic API Panel → Users / Groups**.

## Секреттер (міндетті түрде өзгертіңіз)

- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CSRF_SECRET`
- `ADMIN_PASSWORD`, `SERVICE_PASSWORD`, `MQTT_PASSWORD`
- `PYORCH_JWT_SECRET`, `PYORCH_SECRET_MASTER_KEY`, `PYORCH_INTERNAL_API_KEY` *(PyOrch болса)*

`.env` `.gitignore` ішінде.

## CORS

```env
CORS_ORIGIN=http://localhost,http://localhost:3001,http://localhost:8080,https://crm.example.com
```

## pyorch-bridge және Telegram-боттар

- Тек Dashboard nginx `/api/telegram-bots/` арқылы қолжетімді
- CRM JWT + admin құқықтарын тексереді
- PyOrchestrator тіркелгі деректерін env-де сақтайды (`PYORCH_DASHBOARD_*`)
- **Ботта авторизация** — CRM пайдаланушысының `telegramUserId` бойынша (`GET /api/users/telegram/{id}/auth`); құқықтар RBAC топтарынан
- Бөгде Telegram ID тек «Жеке бот» хабарламасын алады, CRM деректері жоқ
- Бот үлгісі v2.7: токен бойынша lock, дедупликация, legacy PyOrchestrator скрипттерін тоқтату

Қараңыз [Telegram-боттар](telegram.md).

## Пост басқару (post-device API)

- `/api/crm/post-device/` жолы `message-processor:3022`-ге проксиленеді (бөлек порт сыртқа жарияланбайды)
- Жарамды пайдаланушы JWT қажет (`/api/profile` арқылы тексеру)
- Командалар мен бағаларды жіберу **create** / **update** құқығы бар рөлдерге қолжетімді (Operator, Administrator)
- MQTT `set/command` кез келген қосымша растаусыз жарияланады — желіні және CRM есептерін шектеңіз

## MQTT

Порт **1883** хосттың барлық интерфейстерінде ашық — посттар жергілікті желіден пост карточкасынан логин/парольмен `<сервер-IP>:1883`-ке қосылады. Mosquitto passwd ішінде тек **system** (CRM) және пост есептері; анонимдік қолжетімділік тыйым салынған.

`system` паролін **Баптаулар → MQTT (CRM)** ішінде өзгертіңіз. Бірінші орналастыруда `.env` ішінде `MQTT_PASSWORD` орнатыңыз. Посттарға `system`, `superadmin` немесе `wash` логиндерін тағайындамаңыз.

**Пост оқшаулауы:** MQTT синхрондау кезінде ACL генерацияланады — әр пост тек `washpro/{serial}/#` топиктерінде. JSON-дағы serial ауыстыру бөгде статистикаға әсер етпейді.

## Аудит

Dashboard → **Логтар** (Admin) және Dynamic API Panel → Audit Logs.

## Dynamic API Platform

Rate limiting, login lockout, Helmet, network access rules — қараңыз [upstream security](https://dynamic-api-platform.github.io/Dynamic-API-Platform/security/) және `dynamic-api/docs/`.

## PyOrchestrator

JWT, RBAC (Administrator/Developer/Operator/Viewer), encrypted script secrets — қараңыз [PyOrchestrator security](https://pyorchestrator.github.io/PyOrchestrator/security/).

## Резервтік көшіру

Файлдар `DATA_DIR/backups` ішінде (bind mount). Стендте `./scripts/restore.sh` тестілеңіз.
