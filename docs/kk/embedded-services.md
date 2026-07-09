---
layout: default
title: Кіріктірілген сервистер
description: WASH PRO CRM құрамындағы Dynamic API Platform және PyOrchestrator
---

WASH PRO CRM екі платформаны **vendored-көшірмелер** ретінде бөлек басқару панельдерімен қамтиды. Операторлар үшін негізгі интерфейс — **Dashboard** (`:80`). Платформалар әкімшілерге Dashboard сайдбарындағы **Resources** блогы және тікелей URL арқылы қолжетімді.

| Сервис | Vendored-нұсқа | Панель | API |
|--------|----------------|--------|-----|
| **Dynamic API Platform** | v1.5.13 (`dynamic-api/backend/package.json`) | http://localhost:8080 | http://localhost:3001 |
| **PyOrchestrator** *(опц.)* | v0.1.10 (`pyorchestrator/CHANGELOG.md`) | http://localhost:8090 | http://localhost:8000 |

> Толық upstream-құжаттама: [Dynamic API Platform](https://dynamic-api-platform.github.io/Dynamic-API-Platform/) · [PyOrchestrator](https://pyorchestrator.github.io/PyOrchestrator/)

---

## Кім не қолданады

| Мүмкіндік | Operator / Viewer | Administrator (Dashboard) | Панель `:8080` | Панель `:8090` |
|-----------|-------------------|---------------------------|----------------|----------------|
| CRM/SCADA деректері | ✅ Dashboard | ✅ Dashboard | — | — |
| Пайдаланушылар және RBAC топтары | ❌ | ✅ Dashboard → Жүйе | ✅ Users / Groups | ✅ Users / Groups |
| Endpoints, схемалар, cron, webhooks | ❌ | 🔗 Resources сілтемесі | ✅ | — |
| Telegram-боттар (бірнеше) | ❌ | ✅ Dashboard → Telegram *(PyOrch)* | — | ✅ Scripts (толық редактор) |
| Python-скрипттер, кестелер | ❌ | 🔗 Resources сілтемесі | — | ✅ |
| CRM MongoDB backups | ❌ | ✅ Dashboard → Резервтік көшірмелер | — | — |
| Аудит-логтар | ❌ | ✅ Dashboard → Логтар | ✅ Audit Logs | — |

---

## Dynamic API Platform

### WASH PRO CRM-дегі рөлі

- CRM үшін **бірегей backend**: барлық `/api/crm/*` деректері runtime engine арқылы MongoDB-де сақталады.
- Dashboard және ішкі service-есептер (`message-processor`, `backup`, `pyorch-bridge`) үшін **JWT + RBAC**.
- **`init-seed`** бірінші іске қосуда 11 endpoint тобы мен 52 CRM маршрутын жасайды.

Dashboard `/api/` → `dynamic-api:3001` проксилейді (`dashboard` контейнеріндегі nginx).

### Расталған платформа мүмкіндіктері (v1.5.13)

**Dynamic API** панелінде (`:8080`) қолжетімді, басқаша көрсетілмесе:

| Категория | Мүмкіндіктер |
|-----------|-------------|
| **Dynamic API Engine** | REST endpoints GET/POST/PUT/PATCH/DELETE UI арқылы; **маршруттар сақталғаннан кейін бірден белсенді**; JSON-схема; path params; `reference` + `?populate=`; опционалды TTL; path өзгерту деректер миграциясымен; кіріктірілген API tester |
| **Автоматтандыру** | Cron (javascript / http / endpoint); шығыс webhooks (HMAC); API keys; MCP server (`POST /api/mcp`); JavaScript handlers `async function handler(req, db)`; версиялау `/api/v1/...` |
| **Қауіпсіздік** | JWT + refresh; RBAC (5 жүйелік топ + custom); network access (domains/IP); rate limiting; login lockout; audit logs; Helmet, CORS, CSRF |
| **Admin Panel** | Dashboard KPI; endpoints & groups; **API Schema** (ER-диаграмма); **Database Explorer**; users/groups; audit logs; 4 UI тақырыбы; OpenAPI/Swagger; жоба export/import |
| **DevOps (upstream)** | Standalone Docker, MongoDB replica set, Kubernetes — **стандартты WASH compose-та қолданылмайды**, бірақ `dynamic-api/` ішінде манифесттер бар |

### WASH-та өшірілген немесе шектелген

| Функция | WASH-тағы күй |
|---------|---------------|
| **In-app Software Updates** (GitHub Releases) | ❌ `UPDATE_EXECUTOR_ENABLED=false` — `./scripts/update-dynamic-api.sh` арқылы жаңарту |
| Dynamic API **Standalone MongoDB stack** | ❌ ортақ `wash-mongodb` қолданылады |
| **Операторлардың endpoint-builder-ге тікелей қолжетімділігі** | ❌ тек `:8080` арқылы (admin) |

### WASH-та Dynamic API жаңарту

```bash
./scripts/update-dynamic-api.sh
docker compose up -d --build dynamic-api dynamic-api-panel
./scripts/run-init-seed.sh   # CRM-схема өзгергенде
```

WASH патчтары: `patches/dynamic-api-wash.patch`. Embedded UI: `patches/wash-embedded/`.

---

## PyOrchestrator

### WASH PRO CRM-дегі рөлі

PyOrchestrator **опционалды**. `.env` ішінде қосылады:

```env
PYORCHESTRATOR_ENABLED=true
```

`./scripts/start.sh` скрипті `docker-compose.pyorchestrator.yml` қосады.

| WASH компоненті | Мақсаты |
|-----------------|---------|
| `pyorch-backend` | FastAPI REST + WebSocket |
| `pyorchestrator-panel` | React Control Plane (`:8090`) |
| `pyorch-runtime` | Оқшауланған Python subprocess (скриптке контейнер жоқ) |
| `pyorch-scheduler` | Cron / interval / webhook triggers |
| `pyorch-bridge` | Telegram-боттар үшін CRM ↔ PyOrchestrator HTTP-көпірі |
| `pyorch-postgres`, `pyorch-redis`, `pyorch-minio` | Метадеректер, кезек, workspace |
| `pyorch-mcp` | AI-агенттер үшін MCP (`:8010`, опционалды) |
| `pyorch-prometheus`, `pyorch-grafana`, `pyorch-loki`, `pyorch-promtail` | Observability (profile `pyorch-observability`, әдепкі өшірулі) |

### Расталған PyOrchestrator мүмкіндіктері (v0.1.10)

**PyOrchestrator** панелінде (`:8090`) қолжетімді:

| Категория | Мүмкіндіктер |
|-----------|-------------|
| **Scripts** | CRUD; multi-file workspace (Monaco); топтар; `bot` түрі; secrets (AES-GCM); Redis арқылы hot reload |
| **Runs** | Іске қосу/тоқтату; кезек; тарих; WebSocket `ws://.../ws/runs/{run_id}` арқылы live logs |
| **Schedules** | Cron және interval |
| **Webhooks** | Inbound HTTP `POST /hooks/{token}` |
| **Backups** | UI-да create/restore |
| **Dashboard** | Control Plane-де KPI және timeseries |
| **Security** | JWT; Administrator / Developer / Operator / Viewer рөлдері |
| **MCP** | `:8010/mcp` ішінде 24 tools (scripts, runs, schedules, secrets…) |
| **Observability** | Prometheus + Grafana + Loki *(profile `pyorch-observability`)* |

### **Іске асырылмаған** (дайын деп жарияламаңыз)

| Функция | Күй |
|---------|-----|
| Панель `:8090` ішіндегі in-app OTA updates | ❌ WASH-та өшірілген (`UPDATE_EXECUTOR_ENABLED=false`) — `./scripts/update-pyorchestrator.sh` |
| OTA updates (`GitHubUpdateProvider`) upstream | Stub / backlog |
| Audit logs UI | Кесте бар; UI roadmap-та |
| Production multi-runtime scaling | Тек upstream `docker-compose.prod.yml`-де, WASH overlay-де жоқ |

### Dashboard интеграциясы: Telegram-боттар

PyOrchestrator қосылғанда әкімші боттарды **Dashboard → Жүйе → Telegram** ішінде `:8090` панеліне міндетті кірмей басқарады. Толық құжаттама: [Telegram-боттар](telegram.md).

```
Dashboard  →  /api/telegram-bots/*  →  pyorch-bridge  →  PyOrchestrator API
                                                      ↓
                              Dynamic API  GET /api/users/telegram/{id}/auth
```

| Bridge endpoint | Әрекет |
|-----------------|--------|
| `GET /health` | PyOrchestrator қолжетімділігін тексеру |
| `GET /bots` | WASH Telegram-боттары тізімі |
| `POST /bots` | Бот жасау (`bot` script_type + secrets) |
| `PUT/DELETE /bots/:id` | Өзгерту / жою |
| `POST /bots/:id/start\|stop` | Іске қосу / тоқтату |
| `GET /bots/:id/link` | QR-код және `t.me/...` сілтемесі |
| `POST /bots/refresh` | Үлгілерді синхрондау + барлық боттарды restart |

**Бот түрлері:** Басқару (толық RBAC), Сервистік (мониторинг + пост командалары), **Ақпараттық** (жария: жаңалықтар, бағалар, бос/бос емес, CRM акциялары).

**Ақпараттық бот (v1.9):** мазмұн **Dashboard → Автоматтандыру → Ақпарат**-тан; жазылушыларға **жеке чаттарда** тарату; суреттер бір хабарламамен (фото + жазба); посттардың дұрыс бос/бос емес күйі.

**Оқшаулау (v1.1.11+):** боттар тек жеке хабарламаларда жауап береді — әр пайдаланушы бөгде диалогтарды көрмейді.

### Dashboard-тағы MCP (v1.1.12)

**Dashboard → Автоматтандыру → MCP сервер** (`/mcp`):

- **Dynamic API** / **PyOrchestrator** ауыстырғышы;
- HTTP URL және **Cursor** үшін дайын конфиг (құрастырусыз);
- тіркелген құралдар кестесі;
- nginx прокси: `/api/mcp`, `/api/pyorch-mcp/mcp`.

Агенттер үшін бөлек stdio-сервер: `services/crm-mcp` (қараңыз [docs/mcp.md](mcp.md)).

**Қызметкерлердің қолжетімділігі:** **Dashboard → Пайдаланушылар** ішіндегі **Telegram user_id** өрісі + RBAC тобы. Viewer — тек есептер; Operator — объектілер жасау және пост командалары; Administrator — толық қолжетімділік. Бот формасындағы admin Telegram ID тізімі **жойылды** (v1.1.0-дан).

Bridge → PyOrchestrator тіркелгі деректері: `PYORCH_DASHBOARD_EMAIL` / `PYORCH_DASHBOARD_PASSWORD` (әдепкі `admin@pyorchestrator.local` / `admin`).

### WASH-та PyOrchestrator жаңарту

```bash
./scripts/update-pyorchestrator.sh
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build pyorch-backend pyorchestrator-panel pyorch-bridge
```

WASH патчтары: `patches/pyorchestrator-wash/`. Embedded panel: `services/pyorchestrator-panel/Dockerfile`, `VITE_WASH_EMBEDDED=true`.

---

## Dashboard-тағы Resources блогы

Dashboard сайдбарының төменгі жағында:

| Элемент | Сипаттама |
|---------|----------|
| **Dynamic API** | `:8080` сілтемесі + online/offline индикаторы (`GET /api/health`) |
| **PyOrchestrator** | `:8090` сілтемесі + индикатор (`GET /api/telegram-bots/health` → bridge → PyOrch) |
| **Құжаттама** | GitHub Pages |
| **GitHub** | Жоба репозиторийі |

---

## Әдепкі тіркелгі деректері

| Интерфейс | Логин | Пароль | `.env` айнымалылары |
|-----------|-------|--------|---------------------|
| Dashboard + Dynamic API Panel | `admin` | `Admin123!` | `ADMIN_LOGIN`, `ADMIN_PASSWORD` |
| PyOrchestrator Panel | `admin@pyorchestrator.local` | `admin` | PyOrch seed кезінде жасалады |
| Service account (internal) | `service` | `ServiceInternal123!` | `SERVICE_LOGIN`, `SERVICE_PASSWORD` |

Production алдында барлық парольдер мен секреттерді өзгертіңіз.
