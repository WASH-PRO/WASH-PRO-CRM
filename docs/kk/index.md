---
layout: default
---

{% assign ui = site.data.ui[page.lang] %}

<div class="hero">
  <img class="banner" src="{{ '/assets/banner.png' | relative_url }}" alt="WASH PRO CRM / SCADA">
  {% include hero-badges.html %}
  <p class="hero-lead">
    {{ ui.hero_lead }}
    <a href="https://github.com/Dynamic-API-Platform/Dynamic-API-Platform">Dynamic API Platform</a>
    {{ ui.hero_optional }} <a href="https://github.com/PyOrchestrator/PyOrchestrator">PyOrchestrator</a>
  </p>
</div>

**{{ ui.hero_summary }}**

<p class="quick-links">
  {% assign nav_items = site.data.nav[page.lang] %}
  {% for item in nav_items offset:1 limit:8 %}
    <a href="{% include lhref.html slug=item.slug %}">{{ item.title }}</a>{% unless forloop.last %} · {% endunless %}
  {% endfor %}
</p>

## WASH PRO CRM мүмкіндіктері

| Модуль | Сипаттама |
|--------|----------|
| **Шолу** | KPI, пайдалану және төлем дөңгелек диаграммалары, live-хабарландырулар |
| **Күй** | Барлық посттар, онлайн/оффлайн, live-таймер, **интерактивті график** *(Негізгі)* |
| **Ақпарат** | **Ақпараттық Telegram-бот** үшін жаңалықтар мен акциялар *(Автоматтандыру)* |
| **SCADA / MQTT** | Телеметрия, командалар және пост бағалары |
| **Баптау шебері** | Орнатудан кейінгі бастапқы баптау (`/setup`) |
| **Объектілер** | Автомойкалар, посттар, **MQTT-есептер**, **құрылғы баптаулары** (бағалар, командалар) |
| **Карталар** | Жеңілдік / сервистік / VIP; NFC қолдану журналы |
| **Аналитика** | Инкассациядан бұрын/кейін пайдалану және қаржы |
| **Жүйе** | Хабарландырулар (web + Telegram), пайдаланушылар (Telegram ID), RBAC топтары, баптаулар, логтар |
| **Автоматтандыру** | **Ақпарат**, **Telegram-боттар** (басқару / сервис / **ақпараттық v1.9**), **MCP сервер**, бэкаптар |
| **Resources** | Dynamic API және PyOrchestrator панельдерінің күйі мен сілтемелері |
| **Live-деректер** | 3–15 с автожаңарту; 20–100 беттеу және «Тағы жүктеу» |

## Кіріктірілген платформалар

| Платформа | Нұсқа | Панель | WASH-та |
|-----------|--------|--------|--------|
| [Dynamic API Platform](https://dynamic-api-platform.github.io/Dynamic-API-Platform/) | **v1.5.13** | `:8080` | Backend CRM, endpoints, RBAC, automation |
| [PyOrchestrator](https://pyorchestrator.github.io/PyOrchestrator/) | **v0.1.13** *(опц.)* | `:8090` | Telegram-боттар, Python scripts |

Толығырақ: [Кіріктірілген сервистер](embedded-services.md).

## Стек

| Компонент | Технология |
|-----------|------------|
| API | Dynamic API Platform v1.5.13 (Node.js + MongoDB) |
| Dashboard | React 18 + TypeScript + Vite + Tailwind + Recharts |
| Кезек | MQTT (Mosquitto) |
| Телеметрия | message-processor (Node.js) |
| Python automation | PyOrchestrator v0.1.13 *(опц.)* |
| Инфрақұрылым | Docker Compose |

## Жылдам бастау

```bash
git clone https://github.com/WASH-PRO/WASH-PRO-CRM.git
cd WASH-PRO-CRM
cp .env.example .env
chmod +x scripts/*.sh
./scripts/start.sh
```

| Сервис | URL |
|--------|-----|
| Dashboard | http://localhost |
| Dynamic API Panel | http://localhost:8080 |
| Dynamic API health | http://localhost:3001/api/health |
| PyOrchestrator Panel *(қосылған болса)* | http://localhost:8090 |

**Dashboard кіруі:** `admin` / `Admin123!`  
Бірінші кіруде **баптау шебері** ашылады — қараңыз [Баптау шебері](setup-wizard.md).

### PyOrchestrator (опционалды)

```bash
# .env ішінде: PYORCHESTRATOR_ENABLED=true
./scripts/start.sh
```

### Демо-деректер

```bash
./scripts/generate-demo-data.sh
./scripts/generate-demo-cards.sh
```

## Репозиторий құрылымы

```
WASH-PRO-CRM/
├── dashboard/                 # React CRM
├── dynamic-api/               # Dynamic API Platform (vendored)
├── pyorchestrator/            # PyOrchestrator (vendored, опц.)
├── services/
│   ├── init-seed/             # CRM endpoints + RBAC
│   ├── message-processor/
│   ├── backup/
│   ├── pyorch-bridge/         # Telegram ↔ PyOrchestrator
│   ├── dynamic-api-panel/
│   └── pyorchestrator-panel/
├── scripts/                   # start, update, demo, backup
├── docs/                      # GitHub Pages
└── wiki/                      # GitHub Wiki
```

## Лицензия

WASH PRO CRM — меншік жоба.  
Dynamic API Platform — Apache 2.0 · PyOrchestrator — MIT.

## Өзгерістер тарихы

Репозиторийдегі [CHANGELOG.md](https://github.com/WASH-PRO/WASH-PRO-CRM/blob/main/CHANGELOG.md) қараңыз.
