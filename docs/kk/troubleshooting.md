---
layout: default
title: Ақаулықтарды жою
description: Жиі кездесетін мәселелер және шешімдер
---

## Dynamic API Platform жаңарту

WASH-та `:8080` панеліндегі in-app updater **өшірілген**. Қолданыңыз:

```bash
./scripts/update-dynamic-api.sh
docker compose up -d --build dynamic-api dynamic-api-panel
```

Ағымдағы vendored-нұсқа: **v1.5.13**.

## init-seed: Exited күйі

`Exited (0)` — қалыпты (бір реттік контейнер).

Қате болса:

```bash
docker logs wash-init-seed
./scripts/run-init-seed.sh
```

## RabbitMQ-дан MQTT-ге көшіру

Бұрын RabbitMQ (AMQP, порт 5672) қолданылған болса:

```bash
./scripts/migrate-to-mqtt.sh
docker compose up -d --build message-processor
```

`.env` ішінде `RABBITMQ_*` орнына `MQTT_*` қойыңыз. Контроллерлер AMQP exchange емес, `wash/telemetry/{тип}` топигіне (QoS 1) жариялауы керек.

Толығырақ: [MQTT](mqtt.md).

## MQTT

### Пайдаланушы / пароль мәселелері

```bash
./scripts/fix-mqtt.sh
docker compose up -d message-processor
```

Скрипт passwd ішіндегі `system` қайта жасайды. **Пост** есептері — шеберде «MQTT синхрондау» немесе пост сақтау арқылы.

### Пост қосыла алмайды / «not authorised»

1. Панельдегі логин/пароль = CRM-ден `settings.mqttLogin` / `settings.mqttPassword` (`system` емес).
2. Жариялау топигі: `washpro/{serial}/state/...`, мұнда `{serial}` = `posts.serialNumber`.
3. CRM-де MQTT деректері өзгергеннен кейін — MQTT синхрондау.
4. CRM үшін `system` бұзылса — `./scripts/fix-mqtt.sh`.

### ACL / топиктегі бөгде serial

Пост бөгде serial топигіне жариялай алмайды — Mosquitto қабылдамайды. CRM payload-тағы сәйкессіз serial болса — тек топиктен serial ескеріледі.

MQTT толық қалпына келтіру (`DATA_DIR` ішіндегі деректер, Docker volume емес):

```bash
docker compose stop mosquitto mosquitto-init
rm -rf "${DATA_DIR:-./data}/mosquitto/data"/* "${DATA_DIR:-./data}/mosquitto/config"/*
./scripts/start.sh
```

Қосылу тексеруі:

```bash
docker exec wash-mosquitto mosquitto_sub -h 127.0.0.1 -p 1884 -t '$SYS/broker/version' -C 1 -W 3
```

## «Пайдаланушылар» беті бос

1. Сіз **Administrator** екеніңізді тексеріңіз (`manage_users` немесе `view_logs`)
2. API тексеру: `curl -H "Authorization: Bearer TOKEN" http://localhost:3001/api/users?page=1&limit=5`
3. Dashboard жаңарту: `docker compose up -d --build dashboard`
4. Қайта кіріңіз (JWT мерзімі аяқталған)

## Telegram: «Жаңалық жоқ» / «Жаңалықтар (N)» мәтінсіз

1. **Dashboard → Ақпарат** — күй **Жарияланды** («Жоба» емес)
2. **Кейін жасыру** — бос қалдырыңыз немесе жариялаудан **кейінгі** күн
3. Ақпараттық ботты қайта құрастыру және restart:

```bash
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build pyorch-bridge
# Dashboard → Telegram → ▶ ақпараттық ботта
```

4. Telegram-да: **жеке чатта** `/start` (топта емес), содан кейін **📰 Жаңалықтар**
5. Сурет URL — jpg/png тікелей сілтеме, 10 МБ-қа дейін, интернеттен қолжетімді

## Telegram: жаңалықтар автотаратылмайды

- Пайдаланушы ботқа жеке чатта `/start` жазуы керек (жазылушы тіркелуі)
- Жаңалық — күй **Жарияланды**; жариялау күні автоматты қойылады
- Жариялаудан кейін 30 с-қа дейін күтіңіз
- Пайдаланушының алғашқы `/start`-інен бұрын жасалған жаңалықтар тек **📰 Жаңалықтар** батырмасымен келеді, push таратпайды

## Dashboard: бөлімдер арасында сұр экран

v1.1.12-ден JS-чанк retry және `RouteErrorBoundary` қосылды. Экран бос болса:

1. Бетті жаңартыңыз (F5)
2. dashboard қайта құрастырыңыз: `docker compose up -d --build dashboard`
3. `localhost` үшін браузер кэшін тазалаңыз

## Telegram: бот топта жауап береді / бөгде хабарламалар көрінеді

v1.1.11-ден боттар **тек жеке чаттарда** жұмыс істейді. **QR** немесе `t.me/...` сілтемесі → `/start`. Топтарда бот жауап бермейді.

## Telegram: бот жасау кезінде «Unauthorized»

1. `.env` ішінде `PYORCHESTRATOR_ENABLED=true` және `./scripts/start.sh`
2. Health: `curl http://localhost/api/telegram-bots/health`
3. Қайта құрастыру: `docker compose … up -d --build dashboard pyorch-bridge`
4. Бетті жаңартыңыз / қайта кіріңіз
5. Логтар: `docker logs wash-pyorch-bridge --tail 50`

## Telegram: «PyOrchestrator қолжетімсіз»

```bash
docker compose ps | grep pyorch
docker logs wash-pyorch-backend
curl -s http://localhost:8000/health
```

Bridge тіркелгі деректері: `PYORCH_DASHBOARD_EMAIL` / `PYORCH_DASHBOARD_PASSWORD`.

## Telegram-бот үнсіз / runtime: `redis ConnectionError`

`pyorch-redis` немесе `pyorch-backend` қайта құрастырылғаннан кейін runtime Redis-ке ескі қосылымды сақтауы мүмкін.

```bash
chmod +x ./scripts/fix-pyorch.sh
./scripts/fix-pyorch.sh
```

Немесе қолмен:

```bash
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml restart pyorch-runtime pyorch-scheduler pyorch-bridge
```

Содан кейін Dashboard → **Telegram** — ботта **Тоқтату** → **Іске қосу**.

## Telegram: дубликат жауаптар (ескі + жаңа формат)

Себебі — бір токенге екі polling процесі (ескі PyOrchestrator demo-скрипті + bridge жаңа үлгісі).

```bash
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build pyorch-bridge
# API немесе Dashboard арқылы: POST /api/telegram-bots/bots/refresh
```

Bridge legacy-боттарды тоқтатады және токен бойынша lock қолданады. Бот жауабының төменгі жағында `Шаблон бота v2.7` болуы керек.

## Telegram: қызметкерге «Жеке бот»

1. **Dashboard → Пайдаланушылар** — **Telegram user_id** көрсетіңіз ([@userinfobot](https://t.me/userinfobot) нөмірі)
2. Пайдаланушы **active**, тағайындалған топпен (Viewer / Operator / Administrator)
3. Ботты restart немесе сессия кэші жаңарғанша күтіңіз (5 минутқа дейін)

## Telegram: Viewer объект жасай алмайды

RBAC күтілетін мінез-құлығы — **Viewer** тобы тек `view` ие. Автомойкалар мен пост командалары үшін **Operator** немесе **Administrator** тағайындаңыз.

**Бот үнсіз, логта run: `Temporary failure in name resolution`:** runtime sandbox тек `wash-internal` желісінде (интернетсіз) болған және `api.telegram.org`-ға жетпеген. `docker-compose.pyorchestrator.yml` жаңартылғаннан кейін runtime қайта жасаңыз:

```bash
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d --build pyorch-runtime pyorch-backend pyorch-bridge
```

**Бот жою 500 қатесімен құлауы:** PyOrchestrator-да run-ға сілтемелі хабарландырулар қалған. `delete_script_record` ішінде түзетілді — `pyorch-backend` қайта құрастырыңыз.

```bash
docker exec wash-pyorch-runtime python -c "import urllib.request; urllib.request.urlopen('https://api.telegram.org', timeout=10); print('telegram ok')"
docker logs wash-pyorch-runtime --tail 30
```

## PyOrchestrator MCP: «unreachable» / іске қосылмайды

WASH-та сервис атауы `pyorch-mcp`, backend әдепкі `http://mcp:8010` шақырады. Overlay-де `MCP_INTERNAL_URL` және `mcp` желілік alias бар.

```bash
docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d pyorch-mcp pyorch-backend
docker logs wash-pyorch-mcp --tail 30
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8010/mcp   # 200/405/406 — қалыпты
```

API тексеруі (admin JWT қажет):

```bash
curl -s http://localhost:8000/api/v1/mcp/info -H "Authorization: Bearer TOKEN" | jq .status
# күтіледі: "ok"
```

## Resources: PyOrchestrator «Тоқтатылған»

Индикатор `/api/telegram-bots/health` тексереді. PyOrch өшірілген болса — күтілетін. Dynamic API `/api/health` арқылы тексеріледі.

## Пост күйі «Офлайн» жұмыс істеп тұрған панельде

Пост **онлайн**, егер `/api/crm/post-states` ішіндегі `lastMessageAt` **30 секундтан** ескі емес болса. Тексеріңіз:

1. Телеметрия `washpro/{serial}/state/process` топигіне келеді (немесе басқа suffix).
2. `docker logs wash-message-processor` — өңдеу қателері.
3. Топиктегі сериялық нөмір = CRM `serialNumber`.

## Телеметрия жаңармайды

1. Топиктегі сериялық нөмір (`{dt_pref}/{serial}/state/...`) немесе legacy JSON `postSerial` = CRM `serialNumber`
2. `docker logs wash-message-processor`
3. DLQ `wash/dlq`
4. MQTT журналы: Dashboard → Логтар немесе `/api/crm/telemetry`

## Командалар мен бағалар постқа жетпейді

1. CRM MQTT префиксі (`dt_pref`) панель баптауымен сәйкес (`get_settings.remote`)
2. `docker logs wash-message-processor` — жариялау қателері
3. Серверден тексеру:
   ```bash
   mosquitto_pub -h localhost -p 1883 -u system -P 'PASSWORD' -q 1 \
     -t 'washpro/SERIAL/set/command' -m '{"cmd":1}'
   ```
4. HTTP API: JWT-мен `curl http://localhost/api/crm/post-device/posts/SERIAL/command` (қараңыз [MQTT](mqtt.md))
5. Жаңартудан кейін қайта құрастыру: `docker compose up -d --build message-processor dashboard`

## CORS

`CORS_ORIGIN`-ға origin қосыңыз, `dynamic-api` restart.

## Dashboard ашылмайды

```bash
docker compose ps
docker logs wash-dashboard
```

## Бэкап

```bash
docker logs wash-backup
```

Қолмен іске қосу — Dashboard → Резервтік көшірмелер.

## Толық қайта іске қосу

```bash
docker compose down
docker compose up -d --build
```

MongoDB және басқа сервис деректері `DATA_DIR` ішінде (әдепкі `./data`), қараңыз [data/README.md](../data/README.md).

## Көмек

1. `docker compose logs > logs.txt`
2. GitHub issue: `APP_VERSION`, `docker compose ps`, қайталау қадамдары
