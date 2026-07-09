---
layout: default
title: Сұлба
description: WASH PRO CRM компоненттері және деректер ағыны
---

## Жалпы схема

```
Пост контроллерлері
       │
       ▼
   Mosquitto  (wash/telemetry/#  және  +/+/#)
       │
       ▼
 Message Processor ◄── HTTP :3022 (Dashboard-тан командалар/бағалар)
       │
       ▼
 Dynamic API ──► MongoDB
       ▲
Dashboard (React) ──────────┤ nginx /api proxy
                            │  /api/crm/post-device/ → processor
                            │
         pyorch-bridge ─────┤ (Telegram, Admin)
              ▲             │
              │             │
       PyOrchestrator ──────┘ (опц.)
              │
    backup / service account
```

## Docker Compose сервистері

### Негізгі стек (`docker-compose.yml`)

| Сервис | Контейнер | Мақсаты | Сыртқы қолжетімділік |
|--------|-----------|---------|----------------------|
| `mongodb` | wash-mongodb | CRM дерекқоры (Dynamic API) | ❌ |
| `dynamic-api` | wash-dynamic-api | REST API | ✅ `:3001` |
| `dynamic-api-panel` | wash-dynamic-api-panel | Dynamic API панелі | ✅ `:8080` |
| `dashboard` | wash-dashboard | CRM Dashboard | ✅ `:80` |
| `init-seed` | wash-init-seed | CRM бір реттік инициализациясы | ❌ |
| `mosquitto` | wash-mosquitto | Телеметрия MQTT-брокері | ✅ `:1883` (LAN) |
| `mosquitto-init` | wash-mosquitto-init | `system` + ACL үлгісі | ❌ |
| `message-processor` | wash-message-processor | MQTT ↔ API, passwd/ACL sync, HTTP `:3022` | ❌ |
| `backup` | wash-backup | mongodump + HTTP файлдар | ❌ |

### Опционалды сервистер

| Сервис | Шарты | Мақсаты |
|--------|-------|---------|
| `redis` | `REDIS_ENABLED=true` + `docker-compose.redis.yml` | Кеш (profile `redis`) |
| **PyOrchestrator stack** | `PYORCHESTRATOR_ENABLED=true` | Төмендегі кестеге қараңыз |

### PyOrchestrator (`docker-compose.pyorchestrator.yml`)

| Сервис | Сыртқы қолжетімділік | Мақсаты |
|--------|----------------------|---------|
| `pyorch-backend` | ✅ `:8000` | FastAPI |
| `pyorchestrator-panel` | ✅ `:8090` | Control Plane UI |
| `pyorch-mcp` | ✅ `:8010` | AI-агенттер үшін MCP |
| `pyorch-bridge` | ❌ (Dashboard арқылы) | CRM Telegram-боттары |
| `pyorch-runtime` | ❌ | Python sandbox |
| `pyorch-scheduler` | ❌ | Кестелер |
| `pyorch-postgres` | ❌ | Метадеректер |
| `pyorch-redis` | ❌ | Jobs кезегі |
| `pyorch-minio` | ❌ | Workspace |
| `pyorch-prometheus/grafana/loki/promtail` | profile `pyorch-observability` | Метрикалар және логтар |

Толығырақ: [Кіріктірілген сервистер](embedded-services.md).

## Docker желілері

| Желі | Түрі | Мақсаты |
|------|------|---------|
| `wash-internal` | internal | MongoDB, message-processor, backup (интернетке қолжетімсіз) |
| `wash-external` | bridge | Dashboard, API, **Mosquitto** (порт 1883 LAN үшін) |

MongoDB **сыртқа жарияланбайды**. MQTT (`:1883`) пост контроллерлері үшін жергілікті желіде қолжетімді.

## Телеметрия ағыны

### Кіріс (пост → CRM)

1. Контроллер `{dt_pref}/{serial}/state/{suffix}` топигіне JSON жариялайды (native протокол) немесе `wash/telemetry/{тип}` (legacy), QoS 1, CRM-ден **пост логинімен**.
2. Mosquitto ACL тексереді: пост тек **өз** `serialNumber` топиктеріне жаза алады.
3. `message-processor` (`system` ретінде) `wash/telemetry/#` және `+/+/#` топиктеріне жазылған.
4. CRM үшін сериялық нөмір **топиктен** алынады (басқа serial payload-ы еленбейді).
5. Serial бойынша `/api/crm/posts` ішінде пост табылады.
6. Деректер CRM endpoints-ке жазылады (`post-states`, `cards`, статистика…).
7. Әр хабарлама `/api/crm/telemetry` журналына дублиленеді.
8. Өңдеу қателері → DLQ `wash/dlq`.

**MQTT синхрондауы:** пост сақталғанда немесе `POST /api/crm/post-device/mqtt/sync-users` шақырылғанда message-processor `DATA_DIR/mosquitto/config/` ішіндегі `passwd` және `acl` қайта жасайды. Mosquitto файлдарды рестартсыз қайта жүктейді.

Түрлері: `mode`/`state`, `card`, `statistics`, `finance`, `equipment`, `event`, `settings`, `prices`, `command`.

### Шығыс (CRM → пост)

1. Dashboard → nginx `/api/crm/post-device/…` → HTTP `message-processor:3022`.
2. `/api/profile` арқылы пайдаланушы JWT тексеруі.
3. `{dt_pref}/{serial}/set/prices` немесе `set/command` топиктеріне жариялау.
4. Бағалар мен командалар метадеректері `posts.settings`-ке сақталады.
5. Шығыс хабарламалар телеметрияға логталады.

Толығырақ: [MQTT — постты басқару](mqtt.md#set-prices).

## Инициализация (init-seed)

- **11** CRM endpoint тобы, **52** endpoint
- RBAC: Administrator, Operator, Viewer, Service
- RUB валютасы, жеңілдік түрлері 1–5, backup/archive/telegram баптаулары
- Идемпотентті — қайта іске қосу қауіпсіз

```bash
./scripts/run-init-seed.sh
```

## Деректер каталогы (`DATA_DIR`)

Әдепкі `./data` хостта (bind mount). Қайта құрастыру және `docker compose down` бұл файлдарды жоймайды.

| Жол | Деректер |
|-----|----------|
| `mongodb/` | CRM MongoDB |
| `backups/` | Бэкап файлдары |
| `mosquitto/data/` | MQTT persistence |
| `mosquitto/config/` | MQTT passwd, ACL, mosquitto.conf |
| `pyorchestrator/` | PostgreSQL, Redis, MinIO, runtime *(опц.)* |

Толығырақ: [data/README.md](../data/README.md).

## Dynamic API Platform (vendored v1.5.13)

[Dynamic API Platform](https://github.com/Dynamic-API-Platform/Dynamic-API-Platform) vendored-көшірмесі WASH патчтарымен.

| WASH-та | Тек upstream |
|---------|--------------|
| `/api/crm/*` runtime engine | K8s / MongoDB replica set deploy |
| Панель `:8080` (embedded build) | Standalone in-app updater |
| Жаңарту: `./scripts/update-dynamic-api.sh` | `npm run k8s:deploy` |

In-app updater **өшірілген**: `UPDATE_EXECUTOR_ENABLED=false`.

## PyOrchestrator (vendored v0.1.10)

[PyOrchestrator](https://github.com/PyOrchestrator/PyOrchestrator) vendored-көшірмесі.

`.env.example` әдепкі: `PYORCHESTRATOR_ENABLED=true`, бірақ стек тек **сіздің** `.env` ішінде `true` болса және `./scripts/start.sh` overlay қосса іске қосылады.

Жаңарту:

```bash
./scripts/update-pyorchestrator.sh
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build
```
