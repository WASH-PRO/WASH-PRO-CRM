---
layout: default
title: AI-агенттер үшін MCP
description: Dynamic API және PyOrchestrator HTTP MCP, Dashboard бөлімі және stdio crm-mcp
---

WASH PRO CRM AI-агенттерді (Cursor, Claude Desktop және т.б.) CRM, SCADA және автоматтандыруға қосу үшін **Model Context Protocol (MCP)** ұсынады.

## Қосылудың үш тәсілі

| Тәсіл | Қайда баптау | Транспорт | Қашан қолдану |
|-------|--------------|-----------|---------------|
| **Dashboard → MCP сервер** | `/mcp` | nginx арқылы HTTP | Cursor-да құрастырусыз жылдам бастау |
| **Dynamic API Panel** | `:8080` → Automation → MCP | HTTP `POST /api/mcp` | Платформаның барлық CRM endpoints |
| **crm-mcp** | `services/crm-mcp` | stdio | Composite tools бар жергілікті агент |

**Dashboard → Автоматтандыру → MCP сервер** бөлімі (v1.1.12+) — әкімшілер үшін ұсынылатын кіру нүктесі.

## Dashboard → MCP сервер (`/mcp`)

Бет **Administrator** үшін **Автоматтандыру** тобында қолжетімді.

| Блок | Сипаттама |
|------|----------|
| **Сервис ауыстырғышы** | **Dynamic API** — CRM, карталар, статистика, барлық auto-generated endpoints; **PyOrchestrator** — скрипттер, боттар, кестелер *(қосылған болса)* |
| **HTTP URL** | Dashboard арқылы дайын MCP мекенжайы: `/api/mcp` немесе `/api/pyorch-mcp/mcp` |
| **Cursor конфиг** | MCP баптауларына қоюға дайын JSON (Streamable HTTP, `npm run build` жоқ) |
| **Құралдар кестесі** | Іздеу, сұрыптау, категория бойынша сүзгі, HTTP-әдіс бейдждері |

### nginx прокси (Dashboard)

| Жол | Upstream |
|-----|----------|
| `/api/mcp` | Dynamic API `POST /api/mcp` (JWT) |
| `/api/pyorch-mcp/mcp` | PyOrchestrator MCP `:8010` *(overlay)* |

Dynamic API MCP үшін Cursor-ға Dashboard сессиясынан JWT беріңіз (беттегі «Көшіру» батырмасы) немесе `:8080` панелінен `dap_...` API key қолданыңыз.

Dashboard арқылы PyOrchestrator MCP Cursor конфигінде **бөлек** авторизация талап етпейді — прокси Docker ішкі желісіне өтеді.

## Stdio: `services/crm-mcp`

Composite tools (`crm_get_wash_overview`, Dynamic API MCP прокси, Telegram/post-device bridge) бар жергілікті агент үшін бөлек MCP-сервер.

```bash
cd services/crm-mcp
npm install && npm run build
```

Конфиг мысалы: `services/crm-mcp/cursor-mcp.example.json`. Толығырақ: [services/crm-mcp/README.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/services/crm-mcp/README.md).

## Dynamic API MCP (платформа)

**Dynamic API Platform v1.5.13** ішіне кіріктірілген:

- панель `:8080` → Automation бөлімі;
- endpoint `POST http://localhost:3001/api/mcp` (немесе Dashboard `/api/mcp` арқылы);
- құралдар CRM endpoints және automation-нан генерацияланады.

## PyOrchestrator MCP (опционалды)

`PYORCHESTRATOR_ENABLED=true` болса:

- `pyorch-mcp` сервисі **8010** портында;
- ~24 құрал: scripts, runs, schedules, secrets, webhooks;
- Dashboard сыртқы агенттер үшін `/api/pyorch-mcp/mcp` проксилейді.

Тексеру:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8010/mcp
docker logs wash-pyorch-mcp --tail 20
```

## Ақаулықтарды жою

| Белгі | Әрекет |
|-------|--------|
| Dynamic API MCP: 401 | Cursor конфигінде JWT / API key жаңартыңыз |
| PyOrchestrator: `/mcp` «unreachable» | `docker compose -f docker-compose.yml -f docker-compose.pyorchestrator.yml up -d pyorch-mcp pyorch-backend` |
| Мәзірде MCP бөлімі жоқ | **Administrator** рөлі; `dashboard` қайта құрастырыңыз |
| Құралдар жаңармайды | `/mcp` бетін жаңартыңыз (tools тізімінің live-polling) |

Толығырақ: [Ақаулықтарды жою — PyOrchestrator MCP](troubleshooting.md#pyorchestrator-mcp-unreachable--не-стартует).

## Сондай-ақ қараңыз

- [Dashboard — навигация](dashboard.md)
- [Кіріктірілген сервистер](embedded-services.md)
- [Конфигурация — PyOrchestrator](configuration.md)
