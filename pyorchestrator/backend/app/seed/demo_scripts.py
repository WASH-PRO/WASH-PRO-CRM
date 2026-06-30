"""Demo script and template definitions for fresh installs."""

from __future__ import annotations

from typing import TypedDict


class DemoScriptDef(TypedDict):
    name: str
    description: str
    group: str
    script_type: str
    files: dict[str, str]
    max_runtime_seconds: int
    max_concurrent_runs: int


class TemplateDef(TypedDict):
    name: str
    description: str
    category: str
    files: dict[str, str]


_HTTP_JSON = """import json
import urllib.error
import urllib.request


def get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "PyOrchestrator/1.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode())
"""

DEMO_TEMPLATES: list[TemplateDef] = [
    {
        "name": "Hello World",
        "description": "Basic print script",
        "category": "system",
        "files": {"main.py": 'print("Hello from PyOrchestrator")\n', "requirements.txt": ""},
    },
    {
        "name": "HTTP Poller",
        "description": "Poll a REST API endpoint",
        "category": "system",
        "files": {
            "main.py": (
                "import os, urllib.request\n"
                "url = os.environ.get('SECRET_API_URL', 'https://httpbin.org/get')\n"
                "print(urllib.request.urlopen(url).read().decode()[:200])\n"
            ),
            "requirements.txt": "",
        },
    },
    {
        "name": "Interval Bot",
        "description": "Long-running bot skeleton",
        "category": "system",
        "files": {
            "main.py": (
                "import time\n"
                "for i in range(5):\n"
                "    print(f'tick {i}')\n"
                "    time.sleep(1)\n"
            ),
            "requirements.txt": "",
        },
    },
    {
        "name": "Weather API",
        "description": "Current weather via Open-Meteo (no API key)",
        "category": "integrations",
        "files": {
            "main.py": _HTTP_JSON
            + """
CITIES = {
    "Moscow": (55.7558, 37.6173),
    "London": (51.5074, -0.1278),
    "New York": (40.7128, -74.0060),
}

for city, (lat, lon) in CITIES.items():
    url = (
        "https://api.open-meteo.com/v1/forecast?"
        f"latitude={lat}&longitude={lon}"
        "&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code"
    )
    try:
        data = get_json(url)
        cur = data["current"]
        print(
            f"{city}: {cur['temperature_2m']}°C, "
            f"humidity {cur['relative_humidity_2m']}%, "
            f"wind {cur['wind_speed_10m']} m/s"
        )
    except (urllib.error.URLError, KeyError) as exc:
        print(f"{city}: error — {exc}")
""",
            "requirements.txt": "",
        },
    },
    {
        "name": "Currency Rates",
        "description": "FX rates via Frankfurter API (ECB data, no key)",
        "category": "integrations",
        "files": {
            "main.py": _HTTP_JSON
            + """
pairs = [
    ("USD", "EUR,RUB,GBP,JPY"),
    ("EUR", "USD,GBP,CHF"),
]

for base, targets in pairs:
    url = f"https://api.frankfurter.app/latest?from={base}&to={targets}"
    try:
        data = get_json(url)
        rates = ", ".join(f"{k}={v}" for k, v in sorted(data["rates"].items()))
        print(f"{base} ({data['date']}): {rates}")
    except (urllib.error.URLError, KeyError) as exc:
        print(f"{base}: error — {exc}")
""",
            "requirements.txt": "",
        },
    },
    {
        "name": "Crypto Prices",
        "description": "BTC/ETH/SOL prices via CoinGecko public API",
        "category": "integrations",
        "files": {
            "main.py": _HTTP_JSON
            + """
url = (
    "https://api.coingecko.com/api/v3/simple/price"
    "?ids=bitcoin,ethereum,solana,tether"
    "&vs_currencies=usd,rub,eur"
    "&include_24hr_change=true"
)
try:
    data = get_json(url)
    for coin, prices in data.items():
        usd = prices.get("usd", "—")
        rub = prices.get("rub", "—")
        chg = prices.get("usd_24h_change")
        chg_str = f", 24h {chg:+.2f}%" if chg is not None else ""
        print(f"{coin}: ${usd} / ₽{rub}{chg_str}")
except (urllib.error.URLError, KeyError) as exc:
    print(f"Crypto API error — {exc}")
""",
            "requirements.txt": "",
        },
    },
    {
        "name": "WebSocket Server",
        "description": "Long-running WebSocket echo server on port 8765",
        "category": "integrations",
        "files": {
            "main.py": """import asyncio
import os

import websockets

HOST = os.environ.get("WS_HOST", "0.0.0.0")
PORT = int(os.environ.get("WS_PORT", "8765"))


async def handler(websocket):
    addr = websocket.remote_address
    print(f"Client connected: {addr}")
    await websocket.send("welcome to PyOrchestrator demo WS server")
    try:
        async for message in websocket:
            print(f"  << {message}")
            await websocket.send(f"echo: {message}")
    except websockets.ConnectionClosed:
        print(f"Client disconnected: {addr}")


async def main():
    print(f"Starting WebSocket server on ws://{HOST}:{PORT}")
    async with websockets.serve(handler, HOST, PORT):
        print("Server ready — send messages with any WS client")
        await asyncio.Future()


asyncio.run(main())
""",
            "requirements.txt": "websockets>=12.0\n",
        },
    },
    {
        "name": "Live Clock",
        "description": "Print UTC time every second (infinite bot)",
        "category": "monitoring",
        "files": {
            "main.py": """import time
from datetime import datetime, timezone

print("Live clock started — press Stop to cancel")
while True:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"{now} UTC")
    time.sleep(1)
""",
            "requirements.txt": "",
        },
    },
    {
        "name": "Market Snapshot",
        "description": "Weather + FX + crypto in one run",
        "category": "analytics",
        "files": {
            "main.py": _HTTP_JSON
            + """
print("=== Weather (Moscow) ===")
try:
    w = get_json(
        "https://api.open-meteo.com/v1/forecast?latitude=55.76&longitude=37.62"
        "&current=temperature_2m,relative_humidity_2m"
    )
    c = w["current"]
    print(f"  {c['temperature_2m']}°C, humidity {c['relative_humidity_2m']}%")
except (urllib.error.URLError, KeyError) as exc:
    print(f"  error — {exc}")

print("=== FX (USD) ===")
try:
    fx = get_json("https://api.frankfurter.app/latest?from=USD&to=EUR,RUB,GBP")
    for code, rate in sorted(fx["rates"].items()):
        print(f"  1 USD = {rate} {code}")
except (urllib.error.URLError, KeyError) as exc:
    print(f"  error — {exc}")

print("=== Crypto ===")
try:
    cr = get_json(
        "https://api.coingecko.com/api/v3/simple/price"
        "?ids=bitcoin,ethereum&vs_currencies=usd"
    )
    print(f"  BTC ${cr['bitcoin']['usd']}, ETH ${cr['ethereum']['usd']}")
except (urllib.error.URLError, KeyError) as exc:
    print(f"  error — {exc}")

print("Done.")
""",
            "requirements.txt": "",
        },
    },
    {
        "name": "Public IP Info",
        "description": "Geo lookup via ip-api.com (free, no key)",
        "category": "parsers",
        "files": {
            "main.py": _HTTP_JSON
            + """
try:
    info = get_json("http://ip-api.com/json/?fields=status,query,country,city,isp,timezone")
    if info.get("status") != "success":
        print(f"Lookup failed: {info}")
    else:
        print(f"IP:      {info['query']}")
        print(f"City:    {info['city']}, {info['country']}")
        print(f"ISP:     {info['isp']}")
        print(f"Timezone:{info['timezone']}")
except (urllib.error.URLError, KeyError) as exc:
    print(f"Error — {exc}")
""",
            "requirements.txt": "",
        },
    },
    {
        "name": "DAP API Poster",
        "description": "JWT or API-key auth, POST /api/data every second",
        "category": "integrations",
        "files": {
            "main.py": '''import json
import os
import time
import urllib.error
import urllib.request

API_BASE = os.environ.get("SECRET_API_BASE_URL", "http://host.docker.internal:3001").rstrip("/")
API_LOGIN = os.environ.get("SECRET_API_LOGIN", "")
API_PASSWORD = os.environ.get("SECRET_API_PASSWORD", "")
API_TOKEN = os.environ.get("SECRET_API_TOKEN", "")
INTERVAL_SEC = float(os.environ.get("SECRET_POLL_INTERVAL", "1"))

_access_token: str | None = None
_refresh_token: str | None = None
_use_api_key = False


def request_json(
    method: str,
    path: str,
    body: dict | None = None,
    headers: dict | None = None,
) -> tuple[int, dict]:
    url = f"{API_BASE}{path}"
    payload = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url,
        data=payload,
        method=method,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "PyOrchestrator/1.0",
            **(headers or {}),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode()
        try:
            return exc.code, json.loads(raw)
        except json.JSONDecodeError:
            return exc.code, {"success": False, "error": raw}


def login_jwt() -> None:
    global _access_token, _refresh_token
    status, data = request_json(
        "POST",
        "/api/auth/login",
        {"login": API_LOGIN, "password": API_PASSWORD},
    )
    if status != 200 or not data.get("success"):
        raise RuntimeError(f"JWT login failed ({status}): {data.get('error', data)}")
    tokens = data["data"]
    _access_token = tokens["accessToken"]
    _refresh_token = tokens.get("refreshToken")
    user = tokens.get("user", {}).get("login", "?")
    print(f"JWT obtained for {user}")


def refresh_jwt() -> bool:
    global _access_token
    if not _refresh_token:
        return False
    status, data = request_json("POST", "/api/auth/refresh", {"refreshToken": _refresh_token})
    if status != 200 or not data.get("success"):
        return False
    _access_token = data["data"]["accessToken"]
    return True


def auth_headers() -> dict[str, str]:
    if _access_token:
        return {"Authorization": f"Bearer {_access_token}"}
    if _use_api_key and API_TOKEN:
        return {"X-Api-Key": API_TOKEN}
    raise RuntimeError("Auth is not configured")


def post_data(tick: int) -> None:
    global _access_token
    headers = auth_headers()
    status, data = request_json("POST", "/api/data", {}, headers)

    if status == 401 and _access_token:
        if refresh_jwt():
            status, data = request_json("POST", "/api/data", {}, auth_headers())
        elif API_LOGIN and API_PASSWORD:
            login_jwt()
            status, data = request_json("POST", "/api/data", {}, auth_headers())

    if status == 200 and data.get("success"):
        record_id = data.get("data", {}).get("id", "—")
        print(f"#{tick} POST ok → id={record_id}")
    else:
        print(f"#{tick} POST failed ({status}): {data.get('error', data)}")


def main() -> None:
    global _use_api_key
    print(f"DAP client → {API_BASE}/api/data every {INTERVAL_SEC}s")

    if API_LOGIN and API_PASSWORD:
        login_jwt()
    elif API_TOKEN:
        _use_api_key = True
        print("Using API key auth (X-Api-Key)")
    else:
        raise RuntimeError("Set SECRET_API_TOKEN or SECRET_API_LOGIN + SECRET_API_PASSWORD")

    tick = 0
    while True:
        tick += 1
        post_data(tick)
        time.sleep(INTERVAL_SEC)


if __name__ == "__main__":
    main()
''',
            "requirements.txt": "",
        },
    },
]

DEMO_SCRIPTS: list[DemoScriptDef] = [
    {
        "name": "Weather — Open-Meteo",
        "description": "Current weather for Moscow, London and New York",
        "group": "monitoring",
        "script_type": "script",
        "max_runtime_seconds": 120,
        "max_concurrent_runs": 3,
        "files": next(t["files"] for t in DEMO_TEMPLATES if t["name"] == "Weather API"),
    },
    {
        "name": "FX Rates — Frankfurter",
        "description": "USD and EUR exchange rates (ECB data)",
        "group": "analytics",
        "script_type": "script",
        "max_runtime_seconds": 120,
        "max_concurrent_runs": 3,
        "files": next(t["files"] for t in DEMO_TEMPLATES if t["name"] == "Currency Rates"),
    },
    {
        "name": "Crypto — CoinGecko",
        "description": "Bitcoin, Ethereum, Solana and USDT spot prices",
        "group": "analytics",
        "script_type": "script",
        "max_runtime_seconds": 120,
        "max_concurrent_runs": 3,
        "files": next(t["files"] for t in DEMO_TEMPLATES if t["name"] == "Crypto Prices"),
    },
    {
        "name": "Market Snapshot",
        "description": "Combined weather, FX and crypto dashboard",
        "group": "analytics",
        "script_type": "script",
        "max_runtime_seconds": 180,
        "max_concurrent_runs": 2,
        "files": next(t["files"] for t in DEMO_TEMPLATES if t["name"] == "Market Snapshot"),
    },
    {
        "name": "Public IP Lookup",
        "description": "Resolve public IP geolocation",
        "group": "parsers",
        "script_type": "script",
        "max_runtime_seconds": 60,
        "max_concurrent_runs": 3,
        "files": next(t["files"] for t in DEMO_TEMPLATES if t["name"] == "Public IP Info"),
    },
    {
        "name": "WebSocket Echo Server",
        "description": "Bot: WS echo server on port 8765 inside runtime sandbox",
        "group": "integrations",
        "script_type": "bot",
        "max_runtime_seconds": 86400,
        "max_concurrent_runs": 1,
        "files": next(t["files"] for t in DEMO_TEMPLATES if t["name"] == "WebSocket Server"),
    },
    {
        "name": "Live UTC Clock",
        "description": "Bot: prints UTC time every second until stopped",
        "group": "monitoring",
        "script_type": "bot",
        "max_runtime_seconds": 86400,
        "max_concurrent_runs": 1,
        "files": next(t["files"] for t in DEMO_TEMPLATES if t["name"] == "Live Clock"),
    },
    {
        "name": "HTTP Bin Probe",
        "description": "Quick GET request to httpbin.org with headers dump",
        "group": "integrations",
        "script_type": "script",
        "max_runtime_seconds": 60,
        "max_concurrent_runs": 5,
        "files": {
            "main.py": _HTTP_JSON
            + """
url = "https://httpbin.org/get?demo=pyorchestrator"
try:
    data = get_json(url)
    print(f"Origin: {data.get('origin')}")
    print(f"User-Agent: {data.get('headers', {}).get('User-Agent')}")
    print(f"URL: {data.get('url')}")
except urllib.error.URLError as exc:
    print(f"Request failed — {exc}")
""",
            "requirements.txt": "",
        },
    },
    {
        "name": "Random Quote",
        "description": "Fetch a random programming quote",
        "group": "bots",
        "script_type": "script",
        "max_runtime_seconds": 60,
        "max_concurrent_runs": 3,
        "files": {
            "main.py": _HTTP_JSON
            + """
try:
    data = get_json("https://api.quotable.io/random")
    print(f'"{data["content"]}"')
    print(f"— {data['author']}")
except (urllib.error.URLError, KeyError) as exc:
    print(f"Quote API error — {exc}")
""",
            "requirements.txt": "",
        },
    },
    {
        "name": "DAP API Poster",
        "description": "Bot: JWT or API-key auth, POST to DAP /api/data every second",
        "group": "integrations",
        "script_type": "bot",
        "max_runtime_seconds": 86400,
        "max_concurrent_runs": 1,
        "files": next(t["files"] for t in DEMO_TEMPLATES if t["name"] == "DAP API Poster"),
    },
]

WASH_TELEGRAM_BOT_MAIN = '''"""WASH PRO CRM Telegram bot — runs in PyOrchestrator runtime."""
import json
import os
import time
import urllib.error
import urllib.request

TELEGRAM_TOKEN = os.environ.get("SECRET_TELEGRAM_TOKEN", "")
API_BASE = os.environ.get("SECRET_API_BASE_URL", "http://dynamic-api:3001").rstrip("/")
API_LOGIN = os.environ.get("SECRET_API_LOGIN", "service")
API_PASSWORD = os.environ.get("SECRET_API_PASSWORD", "")
ADMIN_IDS = [
    int(x.strip())
    for x in os.environ.get("SECRET_ADMIN_IDS", "").split(",")
    if x.strip().isdigit()
]
ALLOWED = [
    c.strip().lower()
    for c in os.environ.get("SECRET_ALLOWED_COMMANDS", "").split(",")
    if c.strip()
]
DEFAULT_COMMANDS = ["/status", "/washes", "/posts", "/revenue", "/statistics", "/cards"]

_access_token: str | None = None


def allowed_commands() -> list[str]:
    return ALLOWED if ALLOWED else DEFAULT_COMMANDS


def request_json(method: str, path: str, body: dict | None = None, headers: dict | None = None) -> dict:
    url = f"{API_BASE}{path}"
    payload = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url,
        data=payload,
        method=method,
        headers={"Content-Type": "application/json", "User-Agent": "WASH-Telegram-Bot/1.0", **(headers or {})},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read().decode()
        return json.loads(raw) if raw else {}


def api_login() -> None:
    global _access_token
    data = request_json("POST", "/api/auth/login", {"login": API_LOGIN, "password": API_PASSWORD})
    if not data.get("success") or not data.get("data", {}).get("accessToken"):
        raise RuntimeError(f"Service login failed: {data.get('error', data)}")
    _access_token = data["data"]["accessToken"]


def api_get(path: str):
    global _access_token
    if not _access_token:
        api_login()
    try:
        data = request_json("GET", path, headers={"Authorization": f"Bearer {_access_token}"})
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            api_login()
            data = request_json("GET", path, headers={"Authorization": f"Bearer {_access_token}"})
        else:
            raise
    if not data.get("success"):
        raise RuntimeError(data.get("error", "API error"))
    return data.get("data")


def send_message(chat_id: int, text: str) -> None:
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = json.dumps({"chat_id": chat_id, "text": text, "parse_mode": "HTML"}).encode()
    req = urllib.request.Request(url, data=payload, method="POST", headers={"Content-Type": "application/json"})
    urllib.request.urlopen(req, timeout=15)


def handle_command(command: str) -> str:
    cmd = command.lower()
    if cmd == "/status":
        states = api_get("/api/crm/post-states?limit=100") or []
        online = sum(1 for s in states if s.get("connected"))
        return f"<b>Статус системы</b>\\nПостов онлайн: {online}/{len(states)}"
    if cmd == "/washes":
        washes = api_get("/api/crm/washes?limit=50") or []
        if not washes:
            return "Автомоек нет"
        return "<b>Автомойки</b>\\n" + "\\n".join(f"• {w.get('name', '?')} — {w.get('address', '')}" for w in washes)
    if cmd == "/posts":
        posts = api_get("/api/crm/posts?limit=100") or []
        if not posts:
            return "Постов нет"
        return "<b>Посты</b>\\n" + "\\n".join(f"• #{p.get('postNumber', '?')} {p.get('name', '')}" for p in posts)
    if cmd == "/revenue":
        stats = api_get("/api/crm/finance-stats?limit=50") or []
        total = sum(float(s.get("totalRevenue") or 0) for s in stats)
        return f"<b>Выручка</b>\\nОбщая: {total:.2f} ₽\\nЗаписей: {len(stats)}"
    if cmd == "/statistics":
        stats = api_get("/api/crm/usage-stats?limit=50") or []
        launches = sum(int(s.get("launchCount") or 0) for s in stats)
        usage = sum(float(s.get("usageTime") or 0) for s in stats)
        return f"<b>Статистика</b>\\nЗапусков: {launches}\\nВремя: {round(usage / 60)} мин"
    if cmd == "/cards":
        cards = api_get("/api/crm/cards?limit=20") or []
        if not cards:
            return "Карт нет"
        return "<b>Карты</b>\\n" + "\\n".join(
            f"• {c.get('cardNumber', '?')}: {c.get('balance', 0)}₽ [{c.get('status', '')}]" for c in cards
        )
    return "Неизвестная команда. Доступные: " + " ".join(DEFAULT_COMMANDS)


def main() -> None:
    if not TELEGRAM_TOKEN:
        print("SECRET_TELEGRAM_TOKEN not configured")
        return
    print("WASH PRO CRM Telegram bot started")
    offset = 0
    while True:
        try:
            url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/getUpdates?offset={offset}&timeout=25"
            with urllib.request.urlopen(url, timeout=35) as resp:
                payload = json.loads(resp.read().decode())
            if not payload.get("ok"):
                time.sleep(3)
                continue
            for update in payload.get("result", []):
                offset = update["update_id"] + 1
                msg = update.get("message") or {}
                text = msg.get("text") or ""
                user = msg.get("from") or {}
                chat = msg.get("chat") or {}
                if not text or not user or "id" not in chat:
                    continue
                user_id = user.get("id")
                if user_id not in ADMIN_IDS:
                    send_message(chat["id"], "Доступ запрещён")
                    continue
                cmd = text.split()[0].lower()
                if cmd not in allowed_commands():
                    send_message(chat["id"], "Команда не разрешена")
                    continue
                try:
                    reply = handle_command(cmd)
                    send_message(chat["id"], reply)
                except Exception as exc:
                    print(f"Command {cmd} failed: {exc}")
                    send_message(chat["id"], "Ошибка выполнения команды")
        except Exception as exc:
            print(f"Poll cycle error: {exc}")
            time.sleep(5)


if __name__ == "__main__":
    main()
'''

DEMO_TEMPLATES.append(
    {
        "name": "WASH PRO CRM Telegram Bot",
        "description": "Long-running Telegram bot for WASH PRO CRM (commands, admin ACL)",
        "category": "integrations",
        "files": {"main.py": WASH_TELEGRAM_BOT_MAIN, "requirements.txt": ""},
    }
)
