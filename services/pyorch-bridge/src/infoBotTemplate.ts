/** Публичный информационный Telegram-бот: новости, цены, занятость, акции. */
export const WASH_TELEGRAM_INFO_BOT_MAIN = `"""WASH PRO CRM — информационный Telegram-бот."""
import fcntl
import html
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime

BOT_VERSION = "1.0"

TELEGRAM_TOKEN = os.environ.get("SECRET_TELEGRAM_TOKEN", "")
API_BASE = os.environ.get("SECRET_API_BASE_URL", "http://dynamic-api:3001").rstrip("/")
API_LOGIN = os.environ.get("SECRET_API_LOGIN", "service")
API_PASSWORD = os.environ.get("SECRET_API_PASSWORD", "")

_access_token: str | None = None
_CHAT_LAST_FEED_ID: dict[int, str] = {}
_CHAT_FLOW: dict[int, dict] = {}
_POST_ONLINE_SEC = 30

MENU_BUTTONS = {
    "📰 Новости": "news",
    "💰 Цены": "prices",
    "🅿️ Занятость": "occupancy",
    "🎁 Акции": "promotions",
    "🏠 Главное меню": "main",
}


def esc(text: object) -> str:
    return html.escape(str(text if text is not None else ""), quote=False)


def ref_id(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, dict):
        return str(value.get("id") or value.get("_id") or "")
    return str(value)


def parse_ts(raw: object) -> float:
    if not raw:
        return 0.0
    try:
        text = str(raw)
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        return datetime.fromisoformat(text).timestamp()
    except Exception:
        return 0.0


def request_json(method: str, path: str, body: dict | None = None, headers: dict | None = None) -> dict:
    url = f"{API_BASE}{path}"
    payload = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url,
        data=payload,
        method=method,
        headers={"Content-Type": "application/json", "User-Agent": "WASH-Info-Bot/1.0", **(headers or {})},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read().decode()
        return json.loads(raw) if raw else {}


def api_login() -> None:
    global _access_token
    data = request_json("POST", "/api/auth/login", {"login": API_LOGIN, "password": API_PASSWORD})
    if not data.get("success") or not data.get("data", {}).get("accessToken"):
        raise RuntimeError("Service login failed")
    _access_token = data["data"]["accessToken"]


def auth_headers() -> dict[str, str]:
    global _access_token
    if not _access_token:
        api_login()
    return {"Authorization": f"Bearer {_access_token}"}


def api_get(path: str):
    global _access_token
    try:
        data = request_json("GET", path, headers=auth_headers())
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            api_login()
            data = request_json("GET", path, headers=auth_headers())
        else:
            raise
    if data.get("success") is False:
        raise RuntimeError(data.get("error", "API error"))
    return data.get("data")


_DEFAULT_CURRENCY = {"code": "RUB", "symbol": "₽"}
_currency_cache: tuple[dict[str, str], float] | None = None


def resolve_currency() -> dict[str, str]:
    global _currency_cache
    now = time.time()
    if _currency_cache and now - _currency_cache[1] < 60:
        return _currency_cache[0]
    cur = dict(_DEFAULT_CURRENCY)
    try:
        rows = api_get("/api/crm/currencies?limit=100") or []
        if rows:
            default = next((c for c in rows if c.get("isDefault")), rows[0])
            code = str(default.get("code") or cur["code"])
            cur = {"code": code, "symbol": str(default.get("symbol") or code)}
    except Exception as exc:
        print(f"currency lookup failed: {exc}")
    _currency_cache = (cur, now)
    return cur


def format_money(amount: float) -> str:
    symbol = resolve_currency().get("symbol") or "₽"
    return f"{amount:,.2f} {symbol}".replace(",", " ")


def telegram_api(method: str, body: dict) -> dict:
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/{method}"
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=35) as resp:
        return json.loads(resp.read().decode())


def send_text(chat_id: int, text: str, reply_markup: dict | None = None) -> None:
    body: dict[str, object] = {
        "chat_id": chat_id,
        "text": text[:4096],
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    if reply_markup:
        body["reply_markup"] = reply_markup
    parsed = telegram_api("sendMessage", body)
    if not parsed.get("ok"):
        raise RuntimeError("sendMessage failed")


def send_item(chat_id: int, title: str, body: str, image_url: str | None = None, reply_markup: dict | None = None) -> None:
    caption = f"<b>{esc(title)}</b>\\n\\n{body}"[:1024]
    if image_url and image_url.strip():
        payload: dict[str, object] = {
            "chat_id": chat_id,
            "photo": image_url.strip(),
            "caption": caption,
            "parse_mode": "HTML",
        }
        if reply_markup:
            payload["reply_markup"] = reply_markup
        parsed = telegram_api("sendPhoto", payload)
        if not parsed.get("ok"):
            send_text(chat_id, caption, reply_markup)
    else:
        send_text(chat_id, caption, reply_markup)


def main_keyboard() -> dict:
    return {
        "keyboard": [
            [{"text": "📰 Новости"}, {"text": "💰 Цены"}],
            [{"text": "🅿️ Занятость"}, {"text": "🎁 Акции"}],
            [{"text": "🏠 Главное меню"}],
        ],
        "resize_keyboard": True,
        "is_persistent": True,
    }


def inline_back() -> dict:
    return {"inline_keyboard": [[{"text": "« Назад", "callback_data": "m:main"}]]}


def clear_flow(chat_id: int) -> None:
    _CHAT_FLOW.pop(chat_id, None)


def set_flow(chat_id: int, name: str, step: str, data: dict) -> None:
    _CHAT_FLOW[chat_id] = {"name": name, "step": step, "data": data}


def message_visible(row: dict, wash_id: str | None = None) -> bool:
    status = str(row.get("status") or "draft")
    if status not in ("published", "scheduled"):
        return False
    now = time.time()
    pub = parse_ts(row.get("publishedAt"))
    if pub > now:
        return False
    exp = parse_ts(row.get("expiresAt"))
    if exp and exp < now:
        return False
    if wash_id:
        msg_wash = ref_id(row.get("washId"))
        if msg_wash and msg_wash != wash_id:
            return False
    return True


def fetch_messages(category: str | None = None, wash_id: str | None = None) -> list[dict]:
    rows = api_get("/api/crm/info-messages?limit=200") or []
    items = [r for r in rows if message_visible(r, wash_id)]
    if category:
        items = [r for r in items if str(r.get("category") or "news") == category]
    items.sort(
        key=lambda r: (-parse_ts(r.get("publishedAt")), int(r.get("sortOrder") or 0), str(r.get("id", ""))),
    )
    return items


def render_message_body(row: dict) -> str:
    return esc(row.get("body") or "")


def welcome_text() -> str:
    return (
        "<b>WASH PRO</b>\\n"
        "Информационный бот автомойки\\n\\n"
        "📰 <b>Новости</b> — лента обновлений\\n"
        "💰 <b>Цены</b> — стоимость режимов на мойке\\n"
        "🅿️ <b>Занятость</b> — свободные и занятые посты\\n"
        "🎁 <b>Акции</b> — специальные предложения\\n\\n"
        f"<i>Шаблон бота v{esc(BOT_VERSION)}</i>"
    )


def show_main_menu(chat_id: int) -> None:
    clear_flow(chat_id)
    send_text(chat_id, welcome_text(), main_keyboard())


def show_news(chat_id: int, wash_id: str | None = None) -> None:
    items = fetch_messages(None, wash_id)[:10]
    if not items:
        send_text(chat_id, "📰 Пока нет опубликованных новостей.", main_keyboard())
        return
    send_text(chat_id, f"📰 <b>Новости</b> ({len(items)})", main_keyboard())
    for row in items:
        send_item(chat_id, str(row.get("title") or "Новость"), render_message_body(row), str(row.get("imageUrl") or "") or None)
        _CHAT_LAST_FEED_ID[chat_id] = str(row.get("id") or "")


def show_promotions(chat_id: int, wash_id: str | None = None) -> None:
    items = fetch_messages("promotion", wash_id)[:10]
    if not items:
        send_text(chat_id, "🎁 Сейчас нет активных акций.", main_keyboard())
        return
    send_text(chat_id, f"🎁 <b>Акции</b> ({len(items)})", main_keyboard())
    for row in items:
        send_item(chat_id, str(row.get("title") or "Акция"), render_message_body(row), str(row.get("imageUrl") or "") or None)


def push_new_feed_items(chat_id: int) -> None:
    items = fetch_messages()[:5]
    if not items:
        return
    newest_id = str(items[0].get("id") or "")
    last_id = _CHAT_LAST_FEED_ID.get(chat_id)
    if not last_id:
        _CHAT_LAST_FEED_ID[chat_id] = newest_id
        return
    if newest_id == last_id:
        return
    new_rows = []
    for row in items:
        if str(row.get("id") or "") == last_id:
            break
        new_rows.append(row)
    if not new_rows:
        return
    new_rows.reverse()
    for row in new_rows:
        send_item(chat_id, f"📢 {row.get('title') or 'Новость'}", render_message_body(row), str(row.get("imageUrl") or "") or None)
    _CHAT_LAST_FEED_ID[chat_id] = newest_id


def washes_keyboard(prefix: str) -> dict:
    washes = api_get("/api/crm/washes?limit=100") or []
    rows: list[list[dict[str, str]]] = []
    row: list[dict[str, str]] = []
    for wash in sorted(washes, key=lambda w: str(w.get("name", "")).lower()):
        wid = ref_id(wash)
        if not wid:
            continue
        row.append({"text": str(wash.get("name") or "Мойка")[:32], "callback_data": f"{prefix}:{wid}"})
        if len(row) == 2:
            rows.append(row)
            row = []
    if row:
        rows.append(row)
    rows.append([{"text": "« Назад", "callback_data": "m:main"}])
    return {"inline_keyboard": rows}


def show_prices_prompt(chat_id: int) -> None:
    set_flow(chat_id, "prices", "wash", {})
    send_text(chat_id, "💰 <b>Цены</b>\\nВыберите автомойку:", washes_keyboard("p"))


def show_occupancy_prompt(chat_id: int) -> None:
    set_flow(chat_id, "occupancy", "wash", {})
    send_text(chat_id, "🅿️ <b>Занятость постов</b>\\nВыберите автомойку:", washes_keyboard("o"))


def post_busy(state: dict | None) -> bool:
    if not state:
        return False
    ts = parse_ts(state.get("lastMessageAt") or state.get("createdAt"))
    if ts <= 0 or time.time() - ts > _POST_ONLINE_SEC:
        return False
    if float(state.get("balance") or 0) > 0:
        return True
    if float(state.get("modeTime") or 0) > 0:
        return True
    mode = str(state.get("mode") or "").strip().lower()
    return bool(mode and mode not in ("idle", "free", "0"))


def latest_states() -> dict[str, dict]:
    states = api_get("/api/crm/post-states?limit=500") or []
    by_post: dict[str, dict] = {}
    for row in states:
        pid = ref_id(row.get("postId"))
        prev = by_post.get(pid)
        if not prev or parse_ts(row) >= parse_ts(prev):
            by_post[pid] = row
    return by_post


def show_prices_for_wash(chat_id: int, wash_id: str) -> None:
    washes = {ref_id(w): w for w in (api_get("/api/crm/washes?limit=100") or [])}
    wash = washes.get(wash_id) or {}
    posts = [p for p in (api_get("/api/crm/posts?limit=200") or []) if ref_id(p.get("washId")) == wash_id]
    work_modes = {str(m.get("code")): str(m.get("name") or m.get("code")) for m in (api_get("/api/crm/work-modes?limit=100") or [])}
    if not posts:
        send_text(chat_id, "На выбранной мойке нет постов.", main_keyboard())
        return
    post = sorted(posts, key=lambda p: int(p.get("postNumber") or 0))[0]
    settings = post.get("settings") if isinstance(post.get("settings"), dict) else {}
    prices = settings.get("modePrices") if isinstance(settings.get("modePrices"), dict) else {}
    lines = [f"<b>{esc(wash.get('name') or 'Мойка')}</b>", f"Пост #{esc(post.get('postNumber', '?'))}"]
    if not prices:
        lines.append("Цены режимов пока не заданы в CRM.")
    else:
        lines.append("")
        for key in sorted(prices.keys(), key=lambda k: int(k) if str(k).isdigit() else 999):
            label = work_modes.get(str(key), f"Режим {key}")
            lines.append(f"• {esc(label)}: <b>{esc(format_money(float(prices[key] or 0)))}</b>")
    send_text(chat_id, "\\n".join(lines), main_keyboard())
    clear_flow(chat_id)


def show_occupancy_for_wash(chat_id: int, wash_id: str) -> None:
    washes = {ref_id(w): w for w in (api_get("/api/crm/washes?limit=100") or [])}
    wash = washes.get(wash_id) or {}
    posts = sorted(
        [p for p in (api_get("/api/crm/posts?limit=200") or []) if ref_id(p.get("washId")) == wash_id],
        key=lambda p: int(p.get("postNumber") or 0),
    )
    state_by_post = latest_states()
    lines = [f"<b>{esc(wash.get('name') or 'Мойка')}</b>", ""]
    if not posts:
        lines.append("Постов не найдено.")
    else:
        for post in posts:
            state = state_by_post.get(ref_id(post))
            if post_busy(state):
                status = "🔴 Занят"
            elif state and parse_ts(state.get("lastMessageAt")) > time.time() - _POST_ONLINE_SEC:
                status = "🟢 Свободен"
            else:
                status = "⚪ Нет связи"
            lines.append(f"#{esc(post.get('postNumber', '?'))} {esc(post.get('name') or '—')}: {status}")
    send_text(chat_id, "\\n".join(lines), main_keyboard())
    clear_flow(chat_id)


def handle_callback(chat_id: int, callback_id: str, data: str) -> None:
    telegram_api("answerCallbackQuery", {"callback_query_id": callback_id})
    if data == "m:main":
        show_main_menu(chat_id)
        return
    if data.startswith("p:"):
        show_prices_for_wash(chat_id, data[2:])
        return
    if data.startswith("o:"):
        show_occupancy_for_wash(chat_id, data[2:])


def handle_text(chat_id: int, text: str) -> None:
    push_new_feed_items(chat_id)
    stripped = text.strip()
    if stripped in ("/start", "/menu"):
        show_main_menu(chat_id)
        items = fetch_messages()[:3]
        if items:
            send_text(chat_id, "📰 Последние новости:", main_keyboard())
            for row in reversed(items):
                send_item(chat_id, str(row.get("title") or "Новость"), render_message_body(row), str(row.get("imageUrl") or "") or None)
            _CHAT_LAST_FEED_ID[chat_id] = str(items[0].get("id") or "")
        return
    if stripped == "/help":
        send_text(chat_id, welcome_text(), main_keyboard())
        return
    if stripped in MENU_BUTTONS:
        action = MENU_BUTTONS[stripped]
        if action == "main":
            show_main_menu(chat_id)
        elif action == "news":
            show_news(chat_id)
        elif action == "promotions":
            show_promotions(chat_id)
        elif action == "prices":
            show_prices_prompt(chat_id)
        elif action == "occupancy":
            show_occupancy_prompt(chat_id)
        return
    send_text(chat_id, "Выберите пункт меню или нажмите 🏠 Главное меню", main_keyboard())


def acquire_poll_lock() -> bool:
    lock_path = os.path.join(os.environ.get("PYORCH_WORKDIR", "."), "telegram_info_poll.lock")
    try:
        fd = os.open(lock_path, os.O_CREAT | os.O_RDWR)
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return True
    except OSError:
        return False


def main() -> None:
    if not TELEGRAM_TOKEN:
        print("SECRET_TELEGRAM_TOKEN not configured")
        return
    print(f"WASH PRO informational bot v{BOT_VERSION} started")
    time.sleep(2)
    if not acquire_poll_lock():
        print("Another info bot instance is polling this token. Exit.")
        return
    offset = 0
    while True:
        try:
            params = urllib.parse.urlencode({
                "offset": offset,
                "timeout": 25,
                "allowed_updates": json.dumps(["message", "callback_query"]),
            })
            url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/getUpdates?{params}"
            with urllib.request.urlopen(url, timeout=35) as resp:
                payload = json.loads(resp.read().decode())
            if not payload.get("ok"):
                time.sleep(3)
                continue
            for update in payload.get("result", []):
                offset = int(update["update_id"]) + 1
                if "callback_query" in update:
                    cb = update["callback_query"]
                    chat = (cb.get("message") or {}).get("chat") or {}
                    if "id" in chat:
                        handle_callback(int(chat["id"]), str(cb.get("id", "")), str(cb.get("data") or ""))
                    continue
                msg = update.get("message") or {}
                chat = msg.get("chat") or {}
                text = msg.get("text")
                if "id" not in chat or not text:
                    continue
                try:
                    handle_text(int(chat["id"]), text)
                except Exception as exc:
                    print(f"Message failed: {exc}")
        except Exception as exc:
            print(f"Poll cycle error: {exc}")
            time.sleep(5)


if __name__ == "__main__":
    main()
`;
