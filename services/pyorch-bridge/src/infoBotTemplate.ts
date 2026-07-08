// Публичный информационный Telegram-бот: без проверки Telegram ID, доступен всем.
export const WASH_TELEGRAM_INFO_BOT_MAIN = `"""WASH PRO CRM — информационный Telegram-бот."""
import fcntl
import html
import json
import os
import re
import time
import uuid
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime

BOT_VERSION = "1.8"

TELEGRAM_TOKEN = os.environ.get("SECRET_TELEGRAM_TOKEN", "")
API_BASE = os.environ.get("SECRET_API_BASE_URL", "http://dynamic-api:3001").rstrip("/")
API_LOGIN = os.environ.get("SECRET_API_LOGIN", "service")
API_PASSWORD = os.environ.get("SECRET_API_PASSWORD", "")
PYORCH_SCRIPT_ID = os.environ.get("PYORCH_SCRIPT_ID", "").strip()
PYORCH_BRIDGE_URL = os.environ.get("SECRET_PYORCH_BRIDGE_URL", "http://pyorch-bridge:3021").rstrip("/")
BRIDGE_INTERNAL_KEY = os.environ.get("SECRET_BRIDGE_INTERNAL_KEY", "")


def register_bot_username() -> None:
    if not PYORCH_SCRIPT_ID or not TELEGRAM_TOKEN:
        return
    try:
        with urllib.request.urlopen(f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/getMe", timeout=15) as resp:
            payload = json.loads(resp.read().decode())
        username = str((payload.get("result") or {}).get("username") or "").strip()
        if not username:
            return
        req = urllib.request.Request(
            f"{PYORCH_BRIDGE_URL}/internal/bots/{PYORCH_SCRIPT_ID}/username",
            data=json.dumps({"username": username}).encode(),
            headers={
                "Content-Type": "application/json",
                "X-Internal-Key": BRIDGE_INTERNAL_KEY,
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10):
            print(f"Registered Telegram username @{username}")
    except Exception as exc:
        print(f"register username skipped: {exc}")

_CHAT_FLOW: dict[int, dict] = {}
_SUBSCRIBED_CHATS: set[int] = set()
_PRIVATE_HINT_SENT: set[int] = set()
_GLOBAL_LAST_BROADCAST_TS: dict[str, float] = {"news": 0.0, "promotion": 0.0}
_FEED_HISTORY_LIMIT = 10
_BROADCAST_POLL_SEC = 30
_STATE_PATH = os.path.join(os.environ.get("PYORCH_WORKDIR", "."), "info_bot_state.json")
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
        headers={"Content-Type": "application/json", "User-Agent": "WASH-Info-Bot/1.8", **(headers or {})},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode()
        try:
            parsed = json.loads(err_body)
            err_msg = str(parsed.get("error") or err_body)
        except json.JSONDecodeError:
            err_msg = err_body or f"HTTP {exc.code}"
        raise RuntimeError(f"HTTP {exc.code}: {err_msg}") from exc


_access_token: str | None = None


def api_login() -> None:
    global _access_token
    if not API_LOGIN or not API_PASSWORD:
        raise RuntimeError("Service API credentials not configured")
    data = request_json("POST", "/api/auth/login", {"login": API_LOGIN, "password": API_PASSWORD})
    token = (data.get("data") or {}).get("accessToken")
    if not data.get("success") or not token:
        raise RuntimeError(data.get("error") or "Service login failed")
    _access_token = str(token)


def auth_headers() -> dict[str, str]:
    global _access_token
    if not _access_token:
        api_login()
    return {"Authorization": f"Bearer {_access_token}"}


def api_get(path: str):
    """Чтение CRM: сначала публично, при 401/403 — сервисный JWT."""
    last_error: Exception | None = None
    for use_auth in (False, True):
        try:
            headers = auth_headers() if use_auth else None
            data = request_json("GET", path, headers=headers)
            if data.get("success") is False:
                err = str(data.get("error") or "API error")
                if not use_auth and API_PASSWORD and ("Unauthorized" in err or "Forbidden" in err):
                    last_error = RuntimeError(err)
                    continue
                raise RuntimeError(err)
            return data.get("data")
        except RuntimeError as exc:
            msg = str(exc)
            if not use_auth and API_PASSWORD and ("HTTP 401" in msg or "HTTP 403" in msg or "Unauthorized" in msg or "Forbidden" in msg):
                last_error = exc
                continue
            raise
    if last_error:
        raise last_error
    raise RuntimeError("API request failed")


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
    try:
        with urllib.request.urlopen(req, timeout=35) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode()
        try:
            parsed = json.loads(err_body)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass
        raise RuntimeError(f"Telegram {method} HTTP {exc.code}: {err_body}") from exc


_MAX_IMAGE_BYTES = 10 * 1024 * 1024


def _guess_image_meta(url: str, content_type: str) -> tuple[str, str]:
    path = urllib.parse.urlparse(url).path
    name = os.path.basename(path) or "photo.jpg"
    if "." not in name:
        lowered = content_type.lower()
        if "png" in lowered:
            name = "photo.png"
        elif "webp" in lowered:
            name = "photo.webp"
        elif "gif" in lowered:
            name = "photo.gif"
        else:
            name = "photo.jpg"
    mime = content_type.split(";")[0].strip().lower() or "image/jpeg"
    if mime == "application/octet-stream":
        ext = name.rsplit(".", 1)[-1].lower()
        mime = {
            "png": "image/png",
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "webp": "image/webp",
            "gif": "image/gif",
        }.get(ext, "image/jpeg")
    return name, mime


def download_image(url: str) -> tuple[bytes, str, str] | None:
    target = url.strip()
    if not target:
        return None
    try:
        req = urllib.request.Request(target, headers={"User-Agent": "WASH-Info-Bot/1.8"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            content_type = str(resp.headers.get("Content-Type") or "image/jpeg")
            data = resp.read(_MAX_IMAGE_BYTES + 1)
            if len(data) > _MAX_IMAGE_BYTES:
                print(f"image too large: {target}")
                return None
            if not data:
                return None
            filename, mime = _guess_image_meta(target, content_type)
            return data, filename, mime
    except Exception as exc:
        print(f"download image failed ({target}): {exc}")
        return None


def _multipart_body(boundary: str, fields: dict[str, str], files: dict[str, tuple[str, bytes, str]]) -> bytes:
    chunks: list[bytes] = []
    for key, value in fields.items():
        if value is None:
            continue
        chunks.append(f"--{boundary}\\r\\n".encode())
        chunks.append(f'Content-Disposition: form-data; name="{key}"\\r\\n\\r\\n'.encode())
        chunks.append(f"{value}\\r\\n".encode())
    for key, (filename, content, mime) in files.items():
        chunks.append(f"--{boundary}\\r\\n".encode())
        chunks.append(f'Content-Disposition: form-data; name="{key}"; filename="{filename}"\\r\\n'.encode())
        chunks.append(f"Content-Type: {mime}\\r\\n\\r\\n".encode())
        chunks.append(content)
        chunks.append(b"\\r\\n")
    chunks.append(f"--{boundary}--\\r\\n".encode())
    return b"".join(chunks)


def telegram_api_multipart(method: str, fields: dict[str, str], files: dict[str, tuple[str, bytes, str]]) -> dict:
    boundary = uuid.uuid4().hex
    body = _multipart_body(boundary, fields, files)
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/{method}"
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode()
        try:
            parsed = json.loads(err_body)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass
        raise RuntimeError(f"Telegram {method} HTTP {exc.code}: {err_body}") from exc


def send_photo_upload(
    chat_id: int,
    image_bytes: bytes,
    filename: str,
    mime: str,
    caption: str | None = None,
    parse_mode: str | None = None,
    reply_markup: dict | None = None,
) -> None:
    fields: dict[str, str] = {"chat_id": str(chat_id)}
    if caption:
        fields["caption"] = caption[:1024]
    if parse_mode and caption:
        fields["parse_mode"] = parse_mode
    if reply_markup:
        fields["reply_markup"] = json.dumps(reply_markup, ensure_ascii=False)
    parsed = telegram_api_multipart(
        "sendPhoto",
        fields,
        {"photo": (filename, image_bytes, mime)},
    )
    if not parsed.get("ok"):
        raise RuntimeError(str(parsed.get("description") or "sendPhoto upload failed"))


def send_message(chat_id: int, text: str, reply_markup: dict | None = None, parse_mode: str | None = "HTML") -> None:
    body: dict[str, object] = {
        "chat_id": chat_id,
        "text": text[:4096],
        "disable_web_page_preview": True,
    }
    if parse_mode:
        body["parse_mode"] = parse_mode
    if reply_markup:
        body["reply_markup"] = reply_markup
    parsed = telegram_api("sendMessage", body)
    if not parsed.get("ok"):
        raise RuntimeError(str(parsed.get("description") or "sendMessage failed"))


def send_text(chat_id: int, text: str, reply_markup: dict | None = None) -> None:
    send_message(chat_id, text, reply_markup, "HTML")


def body_plain_text(raw: object) -> str:
    text = html.unescape(str(raw or ""))
    text = re.sub(r"<br\\s*/?>", "\\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    return text.strip()


def render_message_body(row: dict) -> str:
    raw = str(row.get("body") or "")
    if "<" in raw and ">" in raw:
        return raw
    return esc(raw)


def send_item(chat_id: int, title: str, body: str, image_url: str | None = None, reply_markup: dict | None = None) -> None:
    title_text = str(title or "Сообщение")
    body_html = str(body or "")
    body_text = body_plain_text(body_html)
    text_html = f"<b>{esc(title_text)}</b>\\n\\n{body_html}"[:4096]
    text_plain = f"{title_text}\\n\\n{body_text}"[:4096]
    photo_url = (image_url or "").strip()
    errors: list[str] = []

    downloaded = download_image(photo_url) if photo_url else None
    if downloaded:
        image_bytes, filename, mime = downloaded
        for caption, mode in ((None, None), (title_text[:1024], None)):
            try:
                send_photo_upload(chat_id, image_bytes, filename, mime, caption, mode, None)
                for text, mode in ((text_html, "HTML"), (text_plain, None)):
                    try:
                        send_message(chat_id, text, reply_markup, mode)
                        return
                    except Exception as exc:
                        errors.append(str(exc))
                return
            except Exception as exc:
                errors.append(str(exc))

    if photo_url:
        payload: dict[str, object] = {
            "chat_id": chat_id,
            "photo": photo_url,
            "caption": title_text[:1024],
        }
        try:
            parsed = telegram_api("sendPhoto", payload)
            if parsed.get("ok"):
                for text, mode in ((text_html, "HTML"), (text_plain, None)):
                    try:
                        send_message(chat_id, text, reply_markup, mode)
                        return
                    except Exception as exc:
                        errors.append(str(exc))
                return
            errors.append(str(parsed.get("description") or "sendPhoto url failed"))
        except Exception as exc:
            errors.append(str(exc))

    for text, mode in ((text_html, "HTML"), (text_plain, None)):
        try:
            send_message(chat_id, text, reply_markup, mode)
            return
        except Exception as exc:
            errors.append(str(exc))

    raise RuntimeError("; ".join(errors[:3]))


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
    status = str(row.get("status") or "draft").lower()
    if status not in ("published", "scheduled"):
        return False
    now = time.time()
    pub = parse_ts(row.get("publishedAt"))
    if pub <= 0 and status == "published":
        pub = parse_ts(row.get("updatedAt") or row.get("createdAt"))
    if pub > now:
        return False
    exp = parse_ts(row.get("expiresAt"))
    if exp > 0 and pub > 0 and exp <= pub:
        exp = 0.0
    if exp > 0 and exp < now:
        return False
    if wash_id:
        msg_wash = ref_id(row.get("washId"))
        if msg_wash and msg_wash != wash_id:
            return False
    return True


def is_private_chat(chat: dict) -> bool:
    return str(chat.get("type") or "") == "private"


def private_chat_id(chat: dict) -> int | None:
    if not is_private_chat(chat):
        return None
    raw = chat.get("id")
    if raw is None:
        return None
    cid = int(raw)
    return cid if cid > 0 else None


def maybe_notify_private_chat(user_id: int) -> None:
    if user_id <= 0 or user_id in _PRIVATE_HINT_SENT:
        return
    _PRIVATE_HINT_SENT.add(user_id)
    try:
        send_message(
            user_id,
            "🔒 Бот работает только в личных сообщениях.\\n"
            "Ваш диалог изолирован — другие пользователи не видят ваши команды и ответы.\\n"
            "Откройте чат с ботом напрямую и нажмите /start.",
            parse_mode=None,
        )
    except Exception as exc:
        print(f"private chat hint failed for {user_id}: {exc}")


def load_state() -> None:
    global _SUBSCRIBED_CHATS, _GLOBAL_LAST_BROADCAST_TS
    try:
        with open(_STATE_PATH, encoding="utf-8") as fh:
            data = json.load(fh)
        _SUBSCRIBED_CHATS = {int(x) for x in data.get("chats", []) if int(x) > 0}
        stored_ts = data.get("broadcastTs") or {}
        _GLOBAL_LAST_BROADCAST_TS = {
            "news": float(stored_ts.get("news") or 0),
            "promotion": float(stored_ts.get("promotion") or 0),
        }
    except Exception:
        pass


def save_state() -> None:
    try:
        with open(_STATE_PATH, "w", encoding="utf-8") as fh:
            json.dump(
                {
                    "chats": sorted(_SUBSCRIBED_CHATS),
                    "broadcastTs": _GLOBAL_LAST_BROADCAST_TS,
                },
                fh,
            )
    except Exception as exc:
        print(f"state save failed: {exc}")


def register_chat(chat_id: int) -> None:
    if chat_id <= 0:
        return
    if chat_id in _SUBSCRIBED_CHATS:
        return
    _SUBSCRIBED_CHATS.add(chat_id)
    save_state()


def row_publish_ts(row: dict) -> float:
    pub = parse_ts(row.get("publishedAt"))
    if pub > 0:
        return pub
    return parse_ts(row.get("createdAt"))


def fetch_messages(categories: tuple[str, ...] | None = None, wash_id: str | None = None) -> list[dict]:
    rows = api_get("/api/crm/info-messages?limit=200") or []
    if not isinstance(rows, list):
        rows = []
    items = [r for r in rows if isinstance(r, dict) and message_visible(r, wash_id)]
    if categories:
        allowed = set(categories)
        items = [r for r in items if str(r.get("category") or "news") in allowed]
    items.sort(
        key=lambda r: (-parse_ts(r.get("publishedAt")), int(r.get("sortOrder") or 0), str(r.get("id", ""))),
    )
    return items


def feed_empty_hint(categories: tuple[str, ...]) -> str:
    try:
        rows = api_get("/api/crm/info-messages?limit=200") or []
        if not isinstance(rows, list) or not rows:
            return "В CRM пока нет сообщений. Создайте новость в разделе «Информация» со статусом «Опубликовано»."
        raw = [r for r in rows if isinstance(r, dict)]
        cat_rows = [r for r in raw if str(r.get("category") or "news") in set(categories)]
        if not cat_rows:
            return "Нет сообщений в этой категории."
        if not any(message_visible(r) for r in cat_rows):
            if any(str(r.get("status") or "draft") == "draft" for r in cat_rows):
                return "Есть черновики — смените статус на «Опубликовано» в CRM."
            if any(parse_ts(r.get("expiresAt")) > 0 and parse_ts(r.get("expiresAt")) < time.time() for r in cat_rows):
                return "Сообщения есть, но срок показа истёк. Очистите поле «Скрыть после» или продлите дату в CRM."
            return "Сообщения есть, но ещё не доступны (статус или дата публикации)."
    except Exception:
        pass
    return "📰 Пока нет опубликованных новостей."


def broadcast_category(category_key: str, categories: tuple[str, ...], icon: str, fallback_title: str) -> None:
    global _GLOBAL_LAST_BROADCAST_TS
    items = fetch_messages(categories)
    if not items or not _SUBSCRIBED_CHATS:
        return
    last_ts = float(_GLOBAL_LAST_BROADCAST_TS.get(category_key) or 0)
    if last_ts <= 0:
        newest_ts = max((row_publish_ts(r) for r in items), default=0.0)
        _GLOBAL_LAST_BROADCAST_TS[category_key] = newest_ts if newest_ts > 0 else time.time()
        save_state()
        return
    new_rows = [r for r in items if row_publish_ts(r) > last_ts]
    if not new_rows:
        return
    new_rows.sort(key=row_publish_ts)
    max_ts = last_ts
    for chat_id in list(_SUBSCRIBED_CHATS):
        for row in new_rows:
            try:
                title = str(row.get("title") or fallback_title)
                send_item(chat_id, f"{icon} {title}", render_message_body(row), str(row.get("imageUrl") or "") or None)
                max_ts = max(max_ts, row_publish_ts(row))
            except Exception as exc:
                print(f"broadcast to {chat_id} failed: {exc}")
    _GLOBAL_LAST_BROADCAST_TS[category_key] = max(max_ts, time.time() - 1)
    save_state()


def broadcast_new_messages() -> None:
    if not _SUBSCRIBED_CHATS:
        return
    broadcast_category("news", ("news", "general"), "📰", "Новость")
    broadcast_category("promotion", ("promotion",), "🎁", "Акция")


def show_feed_history(chat_id: int, categories: tuple[str, ...], header: str, empty_text: str) -> None:
    try:
        items = fetch_messages(categories)[:_FEED_HISTORY_LIMIT]
    except Exception as exc:
        print(f"feed fetch failed: {exc}")
        send_text(chat_id, "⚠️ Не удалось загрузить ленту из CRM. Попробуйте позже.", main_keyboard())
        return
    if not items:
        send_text(chat_id, empty_text, main_keyboard())
        return
    send_text(chat_id, f"{header} ({len(items)})", main_keyboard())
    failed = 0
    for row in items:
        try:
            send_item(chat_id, str(row.get("title") or header), render_message_body(row), str(row.get("imageUrl") or "") or None)
        except Exception as exc:
            failed += 1
            print(f"feed item send failed: {exc}")
    if failed:
        send_text(
            chat_id,
            f"⚠️ Не удалось показать {failed} из {len(items)} сообщений (часто из‑за недоступного изображения).",
            main_keyboard(),
        )


def welcome_text() -> str:
    return (
        "<b>WASH PRO</b>\\n"
        "Информационный бот автомойки\\n\\n"
        "🔒 <b>Личный чат</b> — ваши сообщения не видны другим пользователям.\\n"
        "Бот доступен <b>всем</b> — регистрация и Telegram ID не нужны.\\n\\n"
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
    show_feed_history(chat_id, ("news", "general"), "📰 <b>Новости</b>", feed_empty_hint(("news", "general")))


def show_promotions(chat_id: int, wash_id: str | None = None) -> None:
    show_feed_history(chat_id, ("promotion",), "🎁 <b>Акции</b>", feed_empty_hint(("promotion",)))


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
    register_chat(chat_id)
    stripped = text.strip()
    if stripped in ("/start", "/menu"):
        show_main_menu(chat_id)
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
    register_bot_username()
    time.sleep(2)
    if not acquire_poll_lock():
        print("Another info bot instance is polling this token. Exit.")
        return
    load_state()
    offset = 0
    last_broadcast_check = 0.0
    while True:
        try:
            now = time.time()
            if now - last_broadcast_check >= _BROADCAST_POLL_SEC:
                last_broadcast_check = now
                try:
                    broadcast_new_messages()
                except Exception as exc:
                    print(f"broadcast cycle failed: {exc}")
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
                    chat_id = private_chat_id(chat)
                    if chat_id is None:
                        uid = int((cb.get("from") or {}).get("id") or 0)
                        if uid:
                            maybe_notify_private_chat(uid)
                        continue
                    register_chat(chat_id)
                    handle_callback(chat_id, str(cb.get("id", "")), str(cb.get("data") or ""))
                    continue
                msg = update.get("message") or {}
                chat = msg.get("chat") or {}
                text = msg.get("text")
                chat_id = private_chat_id(chat)
                if chat_id is None:
                    uid = int((msg.get("from") or {}).get("id") or 0)
                    if uid:
                        maybe_notify_private_chat(uid)
                    continue
                if not text:
                    continue
                try:
                    register_chat(chat_id)
                    handle_text(chat_id, text)
                except Exception as exc:
                    print(f"Message failed: {exc}")
                    try:
                        send_text(chat_id, "⚠️ Ошибка обработки. Попробуйте позже.", main_keyboard())
                    except Exception:
                        pass
        except Exception as exc:
            print(f"Poll cycle error: {exc}")
            time.sleep(5)


if __name__ == "__main__":
    main()
`;
