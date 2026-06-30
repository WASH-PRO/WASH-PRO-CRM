#!/usr/bin/env bash
# WASH-PRO-CRM patches for vendored pyorchestrator/
set -euo pipefail

PO="${1:?usage: apply-wash-patches.sh <pyorchestrator-dir>}"
SCHEMAS="$PO/backend/app/schemas/__init__.py"
SCRIPTS_API="$PO/backend/app/api/v1/scripts.py"
SCRIPT_SVC="$PO/backend/app/services/script_service.py"
DEMO="$PO/backend/app/seed/demo_scripts.py"

echo "==> PyOrchestrator WASH patches"

PATCH_DIR="$(cd "$(dirname "$0")" && pwd)"
OBS_PATCH="$PATCH_DIR/observability-storage.patch"
CONFIG_PY="$PO/backend/app/core/config.py"

if [[ -f "$OBS_PATCH" ]] && ! grep -q 'minio_console_enabled' "$CONFIG_PY" 2>/dev/null; then
  echo "    Applying observability-storage.patch"
  (cd "$PO" && patch -p1 --forward < "$OBS_PATCH") || {
    echo "    ERROR: observability-storage.patch failed — fix conflicts manually" >&2
    exit 1
  }
elif [[ -f "$OBS_PATCH" ]]; then
  echo "    Observability patch already present (minio_console_enabled in config)"
fi

if ! grep -q 'metadata: dict = Field(default_factory=dict)' "$SCHEMAS" 2>/dev/null; then
  perl -i -0777 -pe 's/(class ScriptCreate\(BaseModel\):\n(?:.*\n)*?    code: str \| None = None\n)/$1    metadata: dict = Field(default_factory=dict)\n/s' "$SCHEMAS"
  echo "    Extended ScriptCreate with metadata"
fi
# ScriptUpdate — metadata (если upstream ещё без поля)
if ! grep -A 12 'class ScriptUpdate' "$SCHEMAS" | grep -q 'metadata: dict'; then
  perl -i -pe 's/(max_memory_bytes: int \| None = None)/$1\n    metadata: dict | None = None/' "$SCHEMAS"
  echo "    Extended ScriptUpdate with metadata"
fi

if ! grep -q 'meta = body.metadata' "$SCRIPTS_API" 2>/dev/null; then
  perl -i -pe 's/files = None/files = None\n    meta = body.metadata or {}/' "$SCRIPTS_API"
  perl -i -pe 's/body\.entrypoint, files/body.entrypoint, files, metadata=meta/' "$SCRIPTS_API"
  perl -i -0pe 's/for field, value in body\.model_dump\(exclude_unset=True\)\.items\(\):\n        setattr\(script, field, value\)/for field, value in body.model_dump(exclude_unset=True).items():\n        if field == "metadata" and value is not None:\n            script.metadata_ = value\n        elif field != "metadata":\n            setattr(script, field, value)/s' "$SCRIPTS_API"
  echo "    Patched scripts API for metadata"
fi

if ! grep -q 'metadata_=metadata or' "$SCRIPT_SVC" 2>/dev/null; then
  perl -i -pe 's/files: dict\[str, str\] \| None = None,/files: dict[str, str] | None = None,\n    metadata: dict | None = None,/' "$SCRIPT_SVC"
  perl -i -0777 -pe 's/(entrypoint=entrypoint,\n)(    \)\n    db\.add\(script\))/$1        metadata_=metadata or {},\n$2/s' "$SCRIPT_SVC"
  echo "    Patched create_script for metadata"
fi

if ! grep -q 'WASH PRO CRM Telegram' "$DEMO" 2>/dev/null; then
  cat >> "$DEMO" <<'PYEOF'

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
PYEOF
  echo "    Added WASH Telegram bot template to demo_scripts.py"
fi

# ─── Embedded UI (Settings → Updates, hide OTA banner) ───────────────────────
PATCH_DIR="$(cd "$(dirname "$0")" && pwd)"
cp "$PATCH_DIR/WashSoftwareUpdatesSection.tsx" "$PO/frontend/src/components/"

SETTINGS="$PO/frontend/src/pages/Settings.tsx"
if ! grep -q 'WashSoftwareUpdatesSection' "$SETTINGS" 2>/dev/null; then
  perl -i -pe 's|import UpdatesSettingsPanel from "@/components/UpdatesSettingsPanel";|import UpdatesSettingsPanel from "@/components/UpdatesSettingsPanel";\nimport WashSoftwareUpdatesSection from "@/components/WashSoftwareUpdatesSection";|' "$SETTINGS"
  perl -i -pe 's|import \{ useTheme \} from "@/context/ThemeContext";|import { useTheme } from "@/context/ThemeContext";\n\nconst washEmbedded = import.meta.env.VITE_WASH_EMBEDDED === '\''true'\'';|' "$SETTINGS"
  perl -i -pe 's/\{user\?\.role === "Administrator" && <UpdatesSettingsPanel \/>\}/\{user?.role === "Administrator" \&\& (washEmbedded ? <WashSoftwareUpdatesSection \/> : <UpdatesSettingsPanel \/>)\}/' "$SETTINGS"
  echo "    Patched Settings.tsx for WASH embedded updates UI"
fi

BANNER="$PO/frontend/src/components/UpdateBanner.tsx"
if ! grep -q 'VITE_WASH_EMBEDDED' "$BANNER" 2>/dev/null; then
  perl -i -pe 's/^export default function UpdateBanner\(\) \{/export default function UpdateBanner() {\n  if (import.meta.env.VITE_WASH_EMBEDDED === '\''true'\'') return null;\n/' "$BANNER"
  echo "    Patched UpdateBanner.tsx — hidden in WASH embedded mode"
fi

echo "==> PyOrchestrator WASH patches applied"
