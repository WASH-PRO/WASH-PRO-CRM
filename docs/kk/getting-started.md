---
layout: default
title: Жылдам бастау
description: WASH PRO CRM орнату және бірінші іске қосу
---

## Талаптар

- Docker 24+, Docker Compose v2
- 4 GB RAM (PyOrchestrator-мен 8 GB)
- Порттар: `80`, `3001`, `8080`; PyOrch болса — `8000`, `8090`, `8010`

## Орнату

```bash
git clone https://github.com/WASH-PRO/WASH-PRO-CRM.git
cd WASH-PRO-CRM
cp .env.example .env
# JWT_SECRET, парольдерді өзгертіңіз!
chmod +x scripts/*.sh
./scripts/start.sh
```

## Бірінші кіру

| Интерфейс | URL | Тіркелгі деректері |
|-----------|-----|----------------|
| **Dashboard** | http://localhost | `admin` / `Admin123!` |
| **Dynamic API Panel** | http://localhost:8080 | сол |
| **PyOrchestrator Panel** *(опц.)* | http://localhost:8090 | `admin@pyorchestrator.local` / `admin` |

Dashboard-қа кіргеннен кейін **баптау шебері** (`/setup`) ашылады, егер бастапқы баптау аяқталмаған болса. Толығырақ: [Баптау шебері](setup-wizard.md).

Health checks:

```bash
curl -s http://localhost:3001/api/health
curl -s http://localhost/api/telegram-bots/health   # Dashboard арқылы, PyOrch болса
```

## Бастапқы баптау

### Баптау шебері (ұсынылады)

Шебер объект жасау, посттарды (**сериялық нөмір** және **MQTT логин/пароль**), валютаны, Mosquitto синхрондауын және анықтамалықтарды жасауға жетелейді.

Қайта іске қосу: `/setup?restart=1` немесе **Жүйе → Баптау шебері**.

### Қолмен

1. **Автомойка** және **посттар** жасаңыз, контроллердің бірегей **сериялық нөмірімен** (MQTT-топиктердегі `{serial}`-мен сәйкес келуі керек).
2. Пост карточкасында **MQTT логин мен пароль** орнатыңыз (әдепкі бойынша логин = serial).
3. Шеберде **«MQTT синхрондау»** басыңыз немесе постты сақтаңыз.
4. Пост бетінде **режим бағаларын** баптаңыз және MQTT префиксін тексеріңіз (әдепкі `washpro`).
5. **Administrator:** **Пайдаланушылар** және **Топтар мен құқықтар** баптаңыз (Dashboard → Жүйе).
6. PyOrchestrator болса: **Telegram-боттар** жасаңыз (Dashboard → Telegram).
7. Анықтамалықтар: **Валюталар**, **Жеңілдік түрлері**.

`init-seed` CRM endpoints, RBAC, RUB, жеңілдік түрлерін 1–5 жасайды. `Exited (0)` — қалыпты.

### Демо-деректер

```bash
./scripts/generate-demo-data.sh
./scripts/generate-demo-cards.sh
```

## Іске қосу опциялары

### Redis

```bash
REDIS_ENABLED=true docker compose -f docker-compose.yml -f docker-compose.redis.yml up -d --build
```

### RabbitMQ-дан көшіру

Бұрын RabbitMQ (AMQP) қолданылған болса:

```bash
./scripts/migrate-to-mqtt.sh
docker compose up -d --build message-processor
```

### Контроллерлер үшін MQTT

Порт **1883** әдепкі бойынша жергілікті желіде ашық. **Пост** пост карточкасынан логин/парольмен қосылады:

`mqtt://<mqttLogin>:<mqttPassword>@<CRM-серверінің-IP>:1883`

CRM (`message-processor`) `system` қолданады; пароль — **Баптаулар → MQTT (CRM)** (бірінші іске қосуда — `.env` ішіндегі `MQTT_PASSWORD`). Қараңыз [MQTT](mqtt.md).

Панельдің native протоколы: `{dt_pref}/{serial}/state/*`. CRM-нен басқару: [MQTT](mqtt.md).

Тек localhost (LAN жоқ): `.env` ішінде `MQTT_BIND=127.0.0.1`.

### PyOrchestrator

```bash
# .env ішінде: PYORCHESTRATOR_ENABLED=true
./scripts/start.sh
```

### PyOrch Observability

```env
PYORCH_OBSERVABILITY_ENABLED=true
```

## Қайта seed

```bash
./scripts/run-init-seed.sh
```

## Тексеру

```bash
docker compose ps
docker logs wash-init-seed
docker logs wash-message-processor
```

Платформалар туралы толығырақ: [Кіріктірілген сервистер](embedded-services.md).
