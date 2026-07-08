export const WASH_TELEGRAM_BOT_MAIN = `"""WASH PRO CRM Telegram bot — menu-driven UI with multi-step flows."""
import fcntl
import hashlib
import html
import json
import os
import re
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime

BOT_VERSION = "2.9"

TELEGRAM_TOKEN = os.environ.get("SECRET_TELEGRAM_TOKEN", "")
API_BASE = os.environ.get("SECRET_API_BASE_URL", "http://dynamic-api:3001").rstrip("/")
PROCESSOR_API_BASE = os.environ.get("SECRET_PROCESSOR_API_BASE_URL", "http://message-processor:3022").rstrip("/")
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
BAKED_ALLOWED_COMMANDS: list[str] = []  # __WASH_BOT_ALLOWED_COMMANDS__
DEFAULT_COMMANDS = [
    "/help", "/start", "/menu", "/status", "/washes", "/wash", "/wash_add", "/wash_edit", "/wash_del",
    "/posts", "/post", "/post_add", "/post_edit", "/post_del", "/post_cmd", "/revenue", "/statistics", "/cards",
]

DEVICE_COMMANDS = {
    "soft_reset": "soft_reset", "hard_reset": "hard_reset", "credit_balance": "credit_balance",
    "fault_mode": "fault_mode", "service_mode": "service_mode", "vip_mode": "vip_mode",
    "collection_mode": "collection_mode",
}
DEVICE_LABELS = {
    "soft_reset": "Мягкая перезагрузка", "hard_reset": "Жёсткая перезагрузка",
    "credit_balance": "Зачислить баланс", "fault_mode": "Неисправность",
    "service_mode": "Обслуживание", "vip_mode": "VIP", "collection_mode": "Инкассация",
}
ACTION_TO_CMD = {
    "status": "/status", "washes": "/washes", "posts": "/posts", "revenue": "/revenue",
    "statistics": "/statistics", "cards": "/cards", "wash_add": "/wash_add", "wash_del": "/wash_del",
    "post_add": "/post_add", "post_del": "/post_del", "post_cmd": "/post_cmd",
}

MENU_BUTTONS = {
    "📊 Мониторинг": "monitor",
    "🏢 Автомойки": "washes",
    "🅿️ Посты": "posts",
    "⚙️ Команды": "commands",
    "📈 Отчёты": "reports",
    "❓ Справка": "help",
    "🏠 Главное меню": "main",
}

_access_token: str | None = None
USER_FLOW: dict[int, dict] = {}
_PROCESSED_UPDATES: set[int] = set()
_PROCESSED_UPDATE_ORDER: list[int] = []
_MAX_PROCESSED_UPDATES = 4000
_PROCESSED_CALLBACKS: set[str] = set()
_PROCESSED_CALLBACK_ORDER: list[str] = []
_MAX_PROCESSED_CALLBACKS = 2000
_POLL_LOCK_FILE = None
_LAST_SENT: dict[int, tuple[str, float]] = {}
_SEND_DEDUP_SEC = 3.0


def offset_file_path() -> str:
    workspace = os.environ.get("PYORCH_WORKSPACE", "").strip()
    if workspace:
        script_dir = os.path.dirname(workspace)
        os.makedirs(script_dir, exist_ok=True)
        return os.path.join(script_dir, "telegram_update.offset")
    return os.path.join(os.environ.get("PYORCH_WORKDIR", "."), "telegram_update.offset")


def allowed_commands() -> list[str]:
    if BAKED_ALLOWED_COMMANDS:
        return list(BAKED_ALLOWED_COMMANDS)
    if ALLOWED:
        return ALLOWED
    return DEFAULT_COMMANDS


def command_allowed(cmd: str) -> bool:
    return is_public_command(cmd) or cmd in allowed_commands()


def action_allowed(action: str) -> bool:
    mapped = ACTION_TO_CMD.get(action)
    return command_allowed(mapped) if mapped else True


_CHAT_SESSION: dict[int, dict] = {}
_AUTH_CACHE: dict[int, tuple[dict | None, float]] = {}
_AUTH_CACHE_TTL_SEC = 10

READ_ACTIONS = frozenset({"status", "washes", "posts", "revenue", "statistics", "cards"})
CREATE_ACTIONS = frozenset({"wash_add", "post_add"})
DELETE_ACTIONS = frozenset({"wash_del", "post_del"})
WRITE_ACTIONS = frozenset({"post_cmd"})


def resolve_user_session(telegram_user_id: int) -> dict | None:
    now = time.time()
    cached = _AUTH_CACHE.get(telegram_user_id)
    if cached and now - cached[1] < _AUTH_CACHE_TTL_SEC:
        return cached[0]

    session: dict | None = None
    try:
        data = api_get(f"/api/users/telegram/{telegram_user_id}/auth")
        if isinstance(data, dict) and data.get("authorized"):
            session = {
                "userId": data.get("userId"),
                "name": data.get("name"),
                "login": data.get("login"),
                "permissions": list(data.get("permissions") or []),
            }
    except Exception as exc:
        print(f"telegram auth lookup failed for {telegram_user_id}: {exc}")
        session = None

    _AUTH_CACHE[telegram_user_id] = (session, now)
    return session


def current_session(chat_id: int) -> dict | None:
    return _CHAT_SESSION.get(chat_id)


def session_permissions(chat_id: int) -> set[str]:
    session = current_session(chat_id)
    if not session:
        return set()
    return set(session.get("permissions") or [])


def has_permission(chat_id: int, permission: str) -> bool:
    perms = session_permissions(chat_id)
    if "manage_users" in perms or "manage_api" in perms:
        return True
    return permission in perms


def rbac_action_allowed(chat_id: int, action: str) -> bool:
    if action in READ_ACTIONS:
        return has_permission(chat_id, "view")
    if action in CREATE_ACTIONS:
        return has_permission(chat_id, "create")
    if action in DELETE_ACTIONS:
        return has_permission(chat_id, "delete")
    if action in WRITE_ACTIONS:
        return has_permission(chat_id, "update") or has_permission(chat_id, "create")
    return True


def access_allowed(chat_id: int, action: str) -> bool:
    if not action_allowed(action):
        return False
    return rbac_action_allowed(chat_id, action)


def private_guest_message(telegram_user_id: int) -> str:
    return (
        report_header("WASH PRO CRM", "Частный бот")
        + report_section(
            "Доступ закрыт",
            f"Ваш Telegram ID: <code>{telegram_user_id}</code>\\n\\n"
            "Бот доступен только сотрудникам с привязанной учётной записью CRM.\\n"
            "Для доступа обратитесь к администратору и укажите ваш Telegram ID.",
        )
        + "\\n\\n"
        + report_footer()
    )


def send_guest_reply(chat_id: int, telegram_user_id: int) -> None:
    send_ui(chat_id, private_guest_message(telegram_user_id))


def ui_write_denied() -> str:
    return ui_warning("Недостаточно прав. Для вашей учётной записи доступен только просмотр.")


def normalize_command(token: str) -> str:
    cmd = token.strip().lower()
    if cmd.startswith("/") and "@" in cmd:
        cmd = cmd.split("@", 1)[0]
    return cmd


def is_public_command(cmd: str) -> bool:
    return cmd in ("/help", "/start", "/menu")


def esc(value: object) -> str:
    return html.escape(str(value))


def set_flow(chat_id: int, flow: str, step: str, data: dict | None = None) -> None:
    USER_FLOW[chat_id] = {"flow": flow, "step": step, "data": data or {}}


def clear_flow(chat_id: int) -> None:
    USER_FLOW.pop(chat_id, None)


def get_flow(chat_id: int) -> dict | None:
    return USER_FLOW.get(chat_id)


def telegram_api(method: str, body: dict) -> dict:
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/{method}"
    payload = json.dumps(body).encode()
    req = urllib.request.Request(url, data=payload, method="POST", headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read().decode()
        return json.loads(raw) if raw else {}


def load_update_offset() -> int:
    try:
        with open(offset_file_path(), "r", encoding="utf-8") as handle:
            return int(handle.read().strip() or "0")
    except Exception:
        return 0


def save_update_offset(offset: int) -> None:
    try:
        path = offset_file_path()
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(str(offset))
    except Exception as exc:
        print(f"offset save failed: {exc}")


def remember_update(update_id: int) -> bool:
    if update_id in _PROCESSED_UPDATES:
        return False
    _PROCESSED_UPDATES.add(update_id)
    _PROCESSED_UPDATE_ORDER.append(update_id)
    while len(_PROCESSED_UPDATE_ORDER) > _MAX_PROCESSED_UPDATES:
        old = _PROCESSED_UPDATE_ORDER.pop(0)
        _PROCESSED_UPDATES.discard(old)
    return True


def remember_callback(callback_id: str) -> bool:
    cid = str(callback_id or "").strip()
    if not cid:
        return True
    if cid in _PROCESSED_CALLBACKS:
        return False
    _PROCESSED_CALLBACKS.add(cid)
    _PROCESSED_CALLBACK_ORDER.append(cid)
    while len(_PROCESSED_CALLBACK_ORDER) > _MAX_PROCESSED_CALLBACKS:
        old = _PROCESSED_CALLBACK_ORDER.pop(0)
        _PROCESSED_CALLBACKS.discard(old)
    return True


def polling_lock_path() -> str:
    token = TELEGRAM_TOKEN.strip() or "no-token"
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()[:24]
    lock_dir = os.environ.get("TELEGRAM_POLL_LOCK_DIR", "/tmp/wash-telegram-locks")
    os.makedirs(lock_dir, exist_ok=True)
    return os.path.join(lock_dir, f"poll_{digest}.lock")


def acquire_poll_lock(retries: int = 10, delay_sec: float = 2.0) -> bool:
    global _POLL_LOCK_FILE
    lock_path = polling_lock_path()
    for attempt in range(retries):
        try:
            handle = open(lock_path, "w", encoding="utf-8")
            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            handle.write(str(os.getpid()))
            handle.flush()
            _POLL_LOCK_FILE = handle
            print(f"Polling lock acquired ({lock_path}) pid={os.getpid()} bot v{BOT_VERSION}")
            return True
        except OSError as exc:
            print(f"polling lock denied (attempt {attempt + 1}/{retries}): {exc}")
            if attempt < retries - 1:
                time.sleep(delay_sec)
    return False


def bootstrap_polling() -> int:
    try:
        telegram_api("deleteWebhook", {"drop_pending_updates": False})
    except Exception as exc:
        print(f"deleteWebhook warning: {exc}")
    return load_update_offset()


def send_ui(chat_id: int, text: str, reply_markup: dict | None = None) -> None:
    text = truncate_report(text)
    now = time.time()
    prev = _LAST_SENT.get(chat_id)
    if prev and prev[0] == text and now - prev[1] < _SEND_DEDUP_SEC:
        return
    body: dict[str, object] = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_markup:
        body["reply_markup"] = reply_markup
    try:
        parsed = telegram_api("sendMessage", body)
    except Exception as exc:
        print(f"sendMessage error: {exc}")
        raise RuntimeError("Не удалось отправить сообщение") from exc
    if parsed.get("ok"):
        _LAST_SENT[chat_id] = (text, now)
        return
    description = str(parsed.get("description", "")).lower()
    if "parse" in description or "entity" in description:
        plain: dict[str, object] = {"chat_id": chat_id, "text": text}
        if reply_markup:
            plain["reply_markup"] = reply_markup
        try:
            parsed = telegram_api("sendMessage", plain)
        except Exception as exc:
            print(f"sendMessage plain error: {exc}")
            raise RuntimeError("Не удалось отправить сообщение") from exc
        if parsed.get("ok"):
            _LAST_SENT[chat_id] = (text, now)
            return
    print(f"sendMessage failed: {parsed}")
    raise RuntimeError("Не удалось отправить сообщение")


def answer_callback(callback_id: str, text: str = "") -> None:
    body: dict[str, object] = {"callback_query_id": callback_id}
    if text:
        body["text"] = text
    try:
        telegram_api("answerCallbackQuery", body)
    except Exception as exc:
        print(f"answerCallbackQuery error: {exc}")


def main_reply_keyboard(chat_id: int) -> dict:
    rows: list[list[dict[str, str]]] = []
    row1: list[dict[str, str]] = []
    row2: list[dict[str, str]] = []
    if menu_section_visible(chat_id, "monitor"):
        row1.append({"text": "📊 Мониторинг"})
    if menu_section_visible(chat_id, "washes"):
        row1.append({"text": "🏢 Автомойки"})
    if menu_section_visible(chat_id, "posts"):
        row2.append({"text": "🅿️ Посты"})
    if menu_section_visible(chat_id, "commands"):
        row2.append({"text": "⚙️ Команды"})
    if row1:
        rows.append(row1)
    if row2:
        rows.append(row2)
    row3: list[dict[str, str]] = []
    if menu_section_visible(chat_id, "reports"):
        row3.append({"text": "📈 Отчёты"})
    row3.append({"text": "❓ Справка"})
    rows.append(row3)
    rows.append([{"text": "🏠 Главное меню"}])
    return {"keyboard": rows, "resize_keyboard": True, "is_persistent": True}


def menu_section_visible(chat_id: int, section: str) -> bool:
    if section == "monitor":
        return any(access_allowed(chat_id, a) for a in ("status", "washes", "posts"))
    if section == "washes":
        return any(access_allowed(chat_id, a) for a in ("washes", "wash_add", "wash_del"))
    if section == "posts":
        return any(access_allowed(chat_id, a) for a in ("posts", "post_add", "post_del"))
    if section == "commands":
        return access_allowed(chat_id, "post_cmd")
    if section == "reports":
        return any(access_allowed(chat_id, a) for a in ("revenue", "statistics", "cards"))
    return True


def inline_keyboard(rows: list[list[tuple[str, str]]]) -> dict:
    return {"inline_keyboard": [[{"text": t, "callback_data": d} for t, d in row] for row in rows]}


def back_row(target: str = "m:main") -> list[tuple[str, str]]:
    return [("« Назад", target), ("✕ Отмена", "x:cancel")]


# --- CRM API ---

def request_json(method: str, base: str, path: str, body: dict | None = None, headers: dict | None = None) -> dict:
    url = f"{base}{path}"
    payload = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url, data=payload, method=method,
        headers={"Content-Type": "application/json", "User-Agent": "WASH-Telegram-Bot/2.0", **(headers or {})},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read().decode()
        return json.loads(raw) if raw else {}


def api_login() -> None:
    global _access_token
    data = request_json("POST", API_BASE, "/api/auth/login", {"login": API_LOGIN, "password": API_PASSWORD})
    if not data.get("success") or not data.get("data", {}).get("accessToken"):
        raise RuntimeError(f"Service login failed: {data.get('error', data)}")
    _access_token = data["data"]["accessToken"]


def auth_headers() -> dict[str, str]:
    global _access_token
    if not _access_token:
        api_login()
    return {"Authorization": f"Bearer {_access_token}"}


def api_call(method: str, path: str, body: dict | None = None) -> dict:
    global _access_token
    headers = auth_headers()
    try:
        data = request_json(method, API_BASE, path, body=body, headers=headers)
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            api_login()
            headers = auth_headers()
            data = request_json(method, API_BASE, path, body=body, headers=headers)
        else:
            err_body = exc.read().decode()
            try:
                parsed = json.loads(err_body)
                raise RuntimeError(parsed.get("error", err_body))
            except json.JSONDecodeError:
                raise RuntimeError(f"HTTP {exc.code}: {err_body}") from exc
    if method != "DELETE" and data.get("success") is False:
        raise RuntimeError(data.get("error", "API error"))
    return data


def api_get(path: str):
    return api_call("GET", path).get("data")


def api_post(path: str, body: dict):
    return api_call("POST", path, body).get("data")


def api_put(path: str, body: dict):
    return api_call("PUT", path, body).get("data")


def api_delete(path: str):
    api_call("DELETE", path)


def processor_post(path: str, body: dict):
    global _access_token
    headers = auth_headers()
    try:
        data = request_json("POST", PROCESSOR_API_BASE, path, body=body, headers=headers)
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            api_login()
            headers = auth_headers()
            data = request_json("POST", PROCESSOR_API_BASE, path, body=body, headers=headers)
        else:
            err_body = exc.read().decode()
            try:
                parsed = json.loads(err_body)
                raise RuntimeError(parsed.get("error", err_body))
            except json.JSONDecodeError:
                raise RuntimeError(f"HTTP {exc.code}: {err_body}") from exc
    if data.get("success") is False:
        raise RuntimeError(data.get("error", "Processor API error"))
    return data.get("data")


def mqtt_sync_users() -> None:
    processor_post("/mqtt/sync-users", {})


def generate_mqtt_password(length: int = 16) -> str:
    return secrets.token_hex((length + 1) // 2)[:length]


def default_mqtt_login(serial: str) -> str:
    return serial.strip() or "post"


def ref_id(value) -> str:
    if isinstance(value, dict):
        return str(value.get("id") or value.get("_id") or "")
    return str(value or "")


def find_wash(wash_id: str):
    for wash in api_get("/api/crm/washes?limit=100") or []:
        if str(wash.get("id", "")) == wash_id or str(wash.get("_id", "")) == wash_id:
            return wash
    return None


def find_post(post_id: str):
    for post in api_get("/api/crm/posts?limit=200") or []:
        if str(post.get("id", "")) == post_id or str(post.get("_id", "")) == post_id:
            return post
    return None


def find_post_by_serial(serial: str):
    target = serial.strip().lower()
    for post in api_get("/api/crm/posts?limit=200") or []:
        if str(post.get("serialNumber", "")).strip().lower() == target:
            return post
    return None


def wash_line(wash: dict) -> str:
    wid = wash.get("id") or wash.get("_id") or "?"
    return f"• <code>{esc(wid)}</code> {esc(wash.get('name', '?'))} — {esc(wash.get('address', ''))}"


def post_line(post: dict) -> str:
    pid = post.get("id") or post.get("_id") or "?"
    return (
        f"• #{esc(post.get('postNumber', '?'))} {esc(post.get('name', ''))} "
        f"serial=<code>{esc(post.get('serialNumber', ''))}</code> id=<code>{esc(pid)}</code>"
    )


def report_footer() -> str:
    return f"<i>Шаблон бота v{esc(BOT_VERSION)}</i>"


TELEGRAM_TEXT_LIMIT = 4096


def truncate_report(text: str, limit: int = TELEGRAM_TEXT_LIMIT) -> str:
    if len(text) <= limit:
        return text
    suffix = "\\n\\n<i>… сообщение обрезано</i>"
    return text[: max(0, limit - len(suffix))] + suffix


def report_header(title: str, *summary_lines: str) -> str:
    lines = [f"<b>{esc(title)}</b>"]
    for line in summary_lines:
        if line:
            lines.append(line)
    return "\\n".join(lines)


def report_section(title: str, body: str) -> str:
    body = body.strip()
    if not body:
        return ""
    return f"\\n\\n<b>{esc(title)}</b>\\n{body}"


def ui_menu(title: str, subtitle: str = "Выберите действие:") -> str:
    if subtitle:
        return f"{report_header(title)}\\n{esc(subtitle)}"
    return report_header(title)


def ui_notice(title: str, message: str, *, footer: bool = False) -> str:
    text = report_header(title, message)
    if footer:
        text += "\\n\\n" + report_footer()
    return text


def ui_empty(title: str, message: str) -> str:
    return ui_notice(title, message, footer=True)


def ui_success(title: str, *details: str) -> str:
    body = "\\n".join(line for line in details if line)
    text = report_header(f"✅ {title}")
    if body:
        text += "\\n" + body
    text += "\\n\\n" + report_footer()
    return text


def ui_error(message: str) -> str:
    return ui_notice("Ошибка", esc(str(message)), footer=True)


def ui_warning(message: str) -> str:
    return ui_notice("Внимание", esc(str(message)), footer=True)


def ui_denied(message: str = "Доступ запрещён") -> str:
    return ui_notice("Доступ", esc(message), footer=True)


def ui_step(flow: str, step: int, total: int, prompt: str) -> str:
    return (
        f"{report_header(flow)}\\n"
        f"<i>Шаг {step} из {total}</i>\\n"
        f"{prompt}"
    )


def ui_hint(message: str) -> str:
    return ui_notice("Подсказка", esc(message), footer=True)


def format_datetime(value) -> str:
    if not value:
        return "—"
    try:
        text = str(value)
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        return datetime.fromisoformat(text).strftime("%d.%m.%Y %H:%M")
    except Exception:
        return esc(str(value)[:16])


def posts_by_wash(posts: list) -> dict[str, list]:
    grouped: dict[str, list] = {}
    for post in posts:
        wash_id = ref_id(post.get("washId"))
        grouped.setdefault(wash_id, []).append(post)
    return grouped


def wash_title(wash_id: str, washes: list) -> str:
    for wash in washes:
        if ref_id(wash) == wash_id:
            return str(wash.get("name") or "Без названия")
    return "Неизвестный объект"


def post_status_emoji(post: dict, state_by_post: dict[str, dict]) -> str:
    state = state_by_post.get(ref_id(post))
    equipment = state.get("equipmentState") if isinstance(state, dict) else None
    if not isinstance(equipment, dict):
        equipment = {}
    if equipment.get("error") or equipment.get("hasError"):
        return "🔴"
    if equipment.get("maintenance"):
        return "🟡"
    if is_post_online(state):
        return "🟢"
    return "⚪"


def count_posts_by_status(posts: list, state_by_post: dict[str, dict]) -> dict[str, int]:
    counts = {"online": 0, "offline": 0, "maintenance": 0, "errors": 0}
    for post in posts:
        emoji = post_status_emoji(post, state_by_post)
        if emoji == "🔴":
            counts["errors"] += 1
        elif emoji == "🟡":
            counts["maintenance"] += 1
        elif emoji == "🟢":
            counts["online"] += 1
        else:
            counts["offline"] += 1
    return counts


def status_summary_line(counts: dict[str, int]) -> str:
    return (
        f"🟢 {counts['online']} · ⚪ {counts['offline']} · "
        f"🟡 {counts['maintenance']} · 🔴 {counts['errors']}"
    )


CARD_TYPE_LABELS = {
    "regular": "Скидочные",
    "service": "Сервисные",
    "unlimited": "VIP",
    "collection": "Инкассация",
}

CARD_STATUS_LABELS = {
    "success": "Активна",
    "rejected": "Отклонена",
}

_WORK_MODE_CODE_RE = re.compile(r"^program_(\\d+)$", re.I)


def normalize_work_mode_code(code: str) -> str:
    return str(code).strip().upper()


def work_modes_by_code(modes: list) -> dict[str, dict]:
    by_code: dict[str, dict] = {}
    for mode in modes:
        code = normalize_work_mode_code(str(mode.get("code") or ""))
        if code:
            by_code[code] = mode
    return by_code


def resolve_work_mode_label(mode_ref, by_code: dict[str, dict]) -> str:
    if mode_ref is None or mode_ref == "":
        return "—"
    as_string = str(mode_ref).strip()
    if not as_string:
        return "—"
    candidates = {normalize_work_mode_code(as_string)}
    match = _WORK_MODE_CODE_RE.match(as_string)
    if match:
        num = match.group(1)
        candidates.add(normalize_work_mode_code(num))
        candidates.add(normalize_work_mode_code(f"PROGRAM_{num}"))
    for key in candidates:
        mode = by_code.get(key)
        if mode and mode.get("name"):
            return str(mode["name"])
    return as_string


def resolve_post_mode_label(state: dict | None, by_code: dict[str, dict]) -> str:
    if not isinstance(state, dict):
        return ""
    mode_ref = state.get("modeName") or state.get("mode")
    if not mode_ref:
        mode_number = state.get("modeNumber") or state.get("mode_number")
        if mode_number is not None:
            try:
                num = int(mode_number)
                if num >= 0:
                    mode_ref = f"program_{num}"
            except (TypeError, ValueError):
                pass
    if not mode_ref:
        return ""
    label = resolve_work_mode_label(mode_ref, by_code)
    return label if label != "—" else ""


def record_time(row: dict) -> float:
    raw = row.get("recordedAt") or row.get("lastMessageAt") or row.get("createdAt")
    if not raw:
        return 0.0
    try:
        text = str(raw)
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        return datetime.fromisoformat(text).timestamp()
    except Exception:
        return 0.0


_DEFAULT_CURRENCY: dict[str, str] = {"code": "RUB", "symbol": "₽", "name": "Российский рубль"}
_CURRENCY_CACHE: tuple[dict[str, str], float] | None = None
_CURRENCY_CACHE_TTL_SEC = 60


def resolve_default_currency() -> dict[str, str]:
    global _CURRENCY_CACHE
    now = time.time()
    if _CURRENCY_CACHE and now - _CURRENCY_CACHE[1] < _CURRENCY_CACHE_TTL_SEC:
        return _CURRENCY_CACHE[0]

    currency = dict(_DEFAULT_CURRENCY)
    try:
        rows = api_get("/api/crm/currencies?limit=100") or []
        if isinstance(rows, list) and rows:
            default = next((c for c in rows if c.get("isDefault")), None) or rows[0]
            if isinstance(default, dict):
                code = str(default.get("code") or _DEFAULT_CURRENCY["code"])
                currency = {
                    "code": code,
                    "symbol": str(default.get("symbol") or code),
                    "name": str(default.get("name") or ""),
                }
    except Exception as exc:
        print(f"currency lookup failed: {exc}")

    _CURRENCY_CACHE = (currency, now)
    return currency


def format_money(amount: float) -> str:
    cur = resolve_default_currency()
    symbol = cur.get("symbol") or cur.get("code") or "₽"
    return f"{amount:,.2f} {symbol}".replace(",", " ")


def latest_finance_by_post(stats: list) -> list:
    by_key: dict[str, dict] = {}
    for row in stats:
        post_key = ref_id(row.get("postId")) or str(row.get("id", ""))
        period = row.get("period") or "before_collection"
        key = f"{post_key}:{period}"
        prev = by_key.get(key)
        if not prev or record_time(row) >= record_time(prev):
            by_key[key] = row
    return list(by_key.values())


def finance_totals(stats: list, period: str) -> dict[str, float]:
    rows = [s for s in latest_finance_by_post(stats) if (s.get("period") or "before_collection") == period]
    cash = sum(float(s.get("cash") or 0) for s in rows)
    cashless = sum(float(s.get("cashless") or 0) for s in rows)
    discount = sum(float(s.get("discountOps") or 0) for s in rows)
    revenue = sum(float(s.get("totalRevenue") or 0) for s in rows)
    if revenue <= 0:
        revenue = cash + cashless
    return {"cash": cash, "cashless": cashless, "discount": discount, "revenue": revenue}


def finance_period_block(title: str, totals: dict[str, float]) -> str:
    return (
        f"<b>{esc(title)}</b>\\n"
        f"├ Наличные: {esc(format_money(totals['cash']))}\\n"
        f"├ Внешние (безнал): {esc(format_money(totals['cashless']))}\\n"
        f"├ Скидочные: {esc(format_money(totals['discount']))}\\n"
        f"└ Выручка: {esc(format_money(totals['revenue']))}"
    )


def resolve_usage_seconds(stat: dict) -> float:
    usage = stat.get("usageTime")
    if usage and float(usage) > 0:
        return float(usage)
    client_count = stat.get("clientCount")
    if client_count and float(client_count) > 0:
        return float(client_count) * 60
    launch_count = stat.get("launchCount")
    if launch_count and float(launch_count) > 0:
        return float(launch_count) * 60
    return 0.0


def latest_usage_by_post_and_category(stats: list) -> list:
    by_key: dict[str, dict] = {}
    for row in stats:
        post_key = ref_id(row.get("postId")) or str(row.get("id", ""))
        period = row.get("period") or "before_collection"
        category = row.get("category") or "regular"
        discount = str(row.get("discountType") or "").strip()
        key = f"{post_key}:{period}:{category}:{discount}"
        prev = by_key.get(key)
        if not prev or record_time(row) >= record_time(prev):
            by_key[key] = row
    return list(by_key.values())


def sum_usage_seconds(stats: list, category: str) -> float:
    return sum(resolve_usage_seconds(s) for s in stats if s.get("category") == category)


def resolve_category_usage_seconds(stats: list, category: str) -> float:
    total = sum_usage_seconds(stats, category)
    if total > 0 or category != "service":
        return total
    return sum(float(s.get("launchCount") or 0) * 60 for s in stats if s.get("category") == "regular")


def format_usage_seconds(seconds: float) -> str:
    if seconds >= 3600:
        return f"{seconds / 3600:.1f} ч"
    if seconds >= 60:
        return f"{round(seconds / 60)} мин"
    return f"{int(seconds)} сек"


def usage_totals(stats: list, period: str) -> dict[str, float]:
    rows = [s for s in latest_usage_by_post_and_category(stats) if (s.get("period") or "before_collection") == period]
    return {
        "clients": sum_usage_seconds(rows, "regular"),
        "service": resolve_category_usage_seconds(rows, "service"),
        "vip": resolve_category_usage_seconds(rows, "unlimited"),
    }


def usage_period_block(title: str, totals: dict[str, float]) -> str:
    return (
        f"<b>{esc(title)}</b>\\n"
        f"├ Использование клиентами: {esc(format_usage_seconds(totals['clients']))}\\n"
        f"├ Сервисное использование: {esc(format_usage_seconds(totals['service']))}\\n"
        f"└ VIP-использование: {esc(format_usage_seconds(totals['vip']))}"
    )


POST_ONLINE_THRESHOLD_SEC = 30


def latest_post_state_by_post(states: list) -> dict[str, dict]:
    by_post: dict[str, dict] = {}
    for row in states:
        post_key = ref_id(row.get("postId")) or str(row.get("id", ""))
        prev = by_post.get(post_key)
        if not prev or record_time(row) >= record_time(prev):
            by_post[post_key] = row
    return by_post


def is_post_online(state: dict | None, now: float | None = None) -> bool:
    if not state:
        return False
    ts = record_time(state)
    if ts <= 0:
        return False
    current = now if now is not None else time.time()
    return current - ts <= POST_ONLINE_THRESHOLD_SEC


def summarize_post_statuses(posts: list, states: list) -> dict[str, int]:
    state_by_post = latest_post_state_by_post(states)
    counts = {"online": 0, "offline": 0, "maintenance": 0, "errors": 0}
    for post in posts:
        state = state_by_post.get(ref_id(post))
        equipment = state.get("equipmentState") if isinstance(state, dict) else None
        if not isinstance(equipment, dict):
            equipment = {}
        has_error = bool(equipment.get("error") or equipment.get("hasError"))
        is_maintenance = bool(equipment.get("maintenance"))
        if has_error:
            counts["errors"] += 1
        elif is_maintenance:
            counts["maintenance"] += 1
        elif is_post_online(state):
            counts["online"] += 1
        else:
            counts["offline"] += 1
    return counts


# --- Actions (return text) ---

def action_status() -> str:
    posts = api_get("/api/crm/posts?limit=200") or []
    states = api_get("/api/crm/post-states?limit=500") or []
    washes = api_get("/api/crm/washes?limit=100") or []
    counts = summarize_post_statuses(posts, states)
    return (
        report_header(
            "Статус системы",
            f"🏢 Автомоек: {len(washes)} · 🅿️ Постов: {len(posts)}",
            status_summary_line(counts),
        )
        + report_section(
            "Состояние постов",
            "🟢 Онлайн — данные за 30 сек\\n"
            f"🟢 Онлайн: {counts['online']}\\n"
            f"⚪ Офлайн: {counts['offline']}\\n"
            f"🟡 В обслуживании: {counts['maintenance']}\\n"
            f"🔴 В ошибке: {counts['errors']}",
        )
        + "\\n\\n"
        + report_footer()
    )


def action_washes() -> str:
    washes = api_get("/api/crm/washes?limit=100") or []
    posts = api_get("/api/crm/posts?limit=200") or []
    states = api_get("/api/crm/post-states?limit=500") or []
    work_modes = api_get("/api/crm/work-modes?limit=100") or []
    mode_labels = work_modes_by_code(work_modes)
    if not washes:
        return ui_empty("Автомойки", "Нет зарегистрированных объектов")

    grouped = posts_by_wash(posts)
    state_by_post = latest_post_state_by_post(states)
    total_counts = summarize_post_statuses(posts, states)
    items: list[str] = []

    for index, wash in enumerate(sorted(washes, key=lambda row: str(row.get("name", "")).lower()), 1):
        wash_id = ref_id(wash)
        wash_posts = sorted(grouped.get(wash_id, []), key=lambda row: int(row.get("postNumber") or 0))
        post_counts = count_posts_by_status(wash_posts, state_by_post)
        cloud = "☁️ Облако" if wash.get("cloudEnabled") else "🏢 Локально"
        block = (
            f"{index}. <b>{esc(wash.get('name') or 'Без названия')}</b>\\n"
            f"   📍 {esc(wash.get('address') or '—')}\\n"
            f"   {cloud} · 🅿️ Постов: {len(wash_posts)}\\n"
            f"   {status_summary_line(post_counts)}"
        )
        if wash_posts:
            post_lines: list[str] = []
            for post in wash_posts[:6]:
                emoji = post_status_emoji(post, state_by_post)
                state = state_by_post.get(ref_id(post)) or {}
                mode_label = resolve_post_mode_label(state, mode_labels)
                mode_part = f" · ⚙️ {esc(mode_label)}" if mode_label else ""
                post_lines.append(
                    f"   {emoji} #{esc(post.get('postNumber', '?'))} {esc(post.get('name') or '—')}{mode_part}"
                )
            if len(wash_posts) > 6:
                post_lines.append(f"   <i>… и ещё {len(wash_posts) - 6} постов</i>")
            block += "\\n" + "\\n".join(post_lines)
        if wash.get("description"):
            block += f"\\n   📝 {esc(str(wash.get('description'))[:100])}"
        if wash.get("registeredAt") or wash.get("createdAt"):
            block += f"\\n   📅 {format_datetime(wash.get('registeredAt') or wash.get('createdAt'))}"
        items.append(block)

    body = "\\n\\n".join(items[:15])
    if len(washes) > 15:
        body += f"\\n\\n<i>… и ещё {len(washes) - 15} объектов</i>"

    return (
        report_header(
            "Автомойки",
            f"Объектов: {len(washes)} · Постов всего: {len(posts)}",
            status_summary_line(total_counts),
        )
        + report_section("Список объектов", body)
        + "\\n\\n"
        + report_footer()
    )


def action_posts() -> str:
    posts = api_get("/api/crm/posts?limit=200") or []
    washes = api_get("/api/crm/washes?limit=100") or []
    states = api_get("/api/crm/post-states?limit=500") or []
    work_modes = api_get("/api/crm/work-modes?limit=100") or []
    mode_labels = work_modes_by_code(work_modes)
    if not posts:
        return ui_empty("Посты", "Постов нет")

    state_by_post = latest_post_state_by_post(states)
    counts = summarize_post_statuses(posts, states)
    grouped = posts_by_wash(posts)
    known_wash_ids = {ref_id(wash) for wash in washes}
    sections: list[str] = []

    for wash in sorted(washes, key=lambda row: str(row.get("name", "")).lower()):
        wash_id = ref_id(wash)
        wash_posts = sorted(grouped.get(wash_id, []), key=lambda row: int(row.get("postNumber") or 0))
        if not wash_posts:
            continue
        lines: list[str] = []
        for post in wash_posts[:12]:
            emoji = post_status_emoji(post, state_by_post)
            state = state_by_post.get(ref_id(post)) or {}
            balance = state.get("balance")
            extra = ""
            if balance not in (None, "", 0):
                extra = f" · 💰 {esc(format_money(float(balance)))}"
            mode_label = resolve_post_mode_label(state, mode_labels)
            if mode_label:
                extra += f" · ⚙️ {esc(mode_label)}"
            lines.append(
                f"{emoji} #{esc(post.get('postNumber', '?'))} {esc(post.get('name') or '—')}\\n"
                f"   serial <code>{esc(post.get('serialNumber', ''))}</code>{extra}"
            )
        if len(wash_posts) > 12:
            lines.append(f"<i>… и ещё {len(wash_posts) - 12} постов</i>")
        sections.append(
            f"<b>{esc(wash.get('name') or 'Объект')}</b>\\n"
            f"📍 {esc(wash.get('address') or '—')} · 🅿️ {len(wash_posts)}\\n"
            + "\\n".join(lines)
        )

    orphan_posts = [post for post in posts if ref_id(post.get("washId")) not in known_wash_ids]
    if orphan_posts:
        lines = []
        for post in sorted(orphan_posts, key=lambda row: int(row.get("postNumber") or 0))[:10]:
            emoji = post_status_emoji(post, state_by_post)
            lines.append(
                f"{emoji} #{esc(post.get('postNumber', '?'))} {esc(post.get('name') or '—')} "
                f"<code>{esc(post.get('serialNumber', ''))}</code>"
            )
        sections.append("<b>Без привязки к объекту</b>\\n" + "\\n".join(lines))

    return (
        report_header(
            "Посты",
            f"Всего: {len(posts)} · Объектов: {len(washes)}",
            status_summary_line(counts),
        )
        + report_section("По объектам", "\\n\\n".join(sections[:10]))
        + "\\n\\n"
        + report_footer()
    )


def action_revenue() -> str:
    stats = api_get("/api/crm/finance-stats?limit=500") or []
    if not stats:
        return ui_empty("Выручка", "Нет финансовых данных")
    latest = latest_finance_by_post(stats)
    posts_count = len({ref_id(row.get("postId")) or row.get("id") for row in latest})
    before = finance_totals(stats, "before_collection")
    after = finance_totals(stats, "after_collection")
    return (
        report_header(
            "Выручка",
            f"Постов в отчёте: {posts_count}",
            f"До инкассации: {esc(format_money(before['revenue']))} · После: {esc(format_money(after['revenue']))}",
        )
        + report_section(
            "Периоды",
            f"{finance_period_block('До инкассации', before)}\\n\\n{finance_period_block('После инкассации', after)}",
        )
        + "\\n\\n"
        + report_footer()
    )


def action_statistics() -> str:
    stats = api_get("/api/crm/usage-stats?limit=500") or []
    if not stats:
        return ui_empty("Статистика использования", "Нет данных")
    latest = latest_usage_by_post_and_category(stats)
    posts_count = len({ref_id(row.get("postId")) or row.get("id") for row in latest})
    before = usage_totals(stats, "before_collection")
    after = usage_totals(stats, "after_collection")
    return (
        report_header(
            "Статистика использования",
            f"Постов в отчёте: {posts_count}",
            (
                f"До инкассации: {esc(format_usage_seconds(before['clients'] + before['service'] + before['vip']))} · "
                f"После: {esc(format_usage_seconds(after['clients'] + after['service'] + after['vip']))}"
            ),
        )
        + report_section(
            "Периоды",
            f"{usage_period_block('До инкассации', before)}\\n\\n{usage_period_block('После инкассации', after)}",
        )
        + "\\n\\n"
        + report_footer()
    )


def action_cards() -> str:
    cards = api_get("/api/crm/cards?limit=200") or []
    if not cards:
        return ui_empty("Карты", "Карт нет")

    by_type: dict[str, list] = {}
    for card in cards:
        card_type = str(card.get("cardType") or "regular")
        by_type.setdefault(card_type, []).append(card)

    summary_parts = []
    for card_type, items in sorted(by_type.items(), key=lambda row: row[0]):
        label = CARD_TYPE_LABELS.get(card_type, card_type)
        balance_sum = sum(float(item.get("balance") or 0) for item in items)
        summary_parts.append(f"{label}: {len(items)} · {esc(format_money(balance_sum))}")
    summary = " · ".join(summary_parts[:4])

    sections: list[str] = []
    for card_type in ("regular", "service", "unlimited", "collection"):
        items = by_type.get(card_type, [])
        if not items:
            continue
        label = CARD_TYPE_LABELS.get(card_type, card_type)
        lines = []
        for card in sorted(items, key=lambda row: str(row.get("cardNumber", "")), reverse=True)[:8]:
            status = CARD_STATUS_LABELS.get(str(card.get("status") or ""), str(card.get("status") or "—"))
            line = (
                f"• <code>{esc(card.get('cardNumber', '?'))}</code> · "
                f"{esc(format_money(float(card.get('balance') or 0)))} · {esc(status)}"
            )
            if card.get("discountType"):
                line += f" · тип {esc(str(card.get('discountType')))}"
            lines.append(line)
        if len(items) > 8:
            lines.append(f"<i>… и ещё {len(items) - 8} карт</i>")
        sections.append(f"<b>{esc(label)}</b> ({len(items)})\\n" + "\\n".join(lines))

    return (
        report_header("Карты", f"Всего: {len(cards)}", summary)
        + report_section("По типам", "\\n\\n".join(sections))
        + "\\n\\n"
        + report_footer()
    )


def execute_post_command(serial: str, command_key: str, amount: float | None = None) -> str:
    post = find_post_by_serial(serial)
    if not post:
        return report_header("Ошибка", f"Пост <code>{esc(serial)}</code> не найден") + "\\n\\n" + report_footer()
    body: dict[str, object] = {"command": command_key}
    if command_key == "credit_balance":
        if amount is None or amount <= 0:
            raise ValueError("Укажите сумму больше 0")
        body["amount"] = amount
    prefix = ((post.get("settings") or {}).get("mqttPrefix") or "").strip()
    if prefix:
        body["mqttPrefix"] = prefix
    result = processor_post(f"/posts/{urllib.parse.quote(serial, safe='')}/command", body)
    topic = (result or {}).get("topic", "")
    label = DEVICE_LABELS.get(command_key, command_key)
    details = [
        f"├ Команда: {esc(label)}",
        f"├ Пост: <code>{esc(serial)}</code>",
    ]
    if amount is not None:
        details.append(f"├ Сумма: {esc(format_money(float(amount)))}")
    details.append(f"└ MQTT: {esc(topic)}")
    return ui_success("Команда отправлена", *details)


def welcome_text(session: dict) -> str:
    name = esc(session.get("name") or session.get("login") or "пользователь")
    perms = set(session.get("permissions") or [])
    if "manage_users" in perms or "manage_api" in perms:
        access = "администратор"
    elif "delete" in perms:
        access = "оператор (с удалением)"
    elif "create" in perms or "update" in perms:
        access = "оператор"
    elif "view" in perms:
        access = "только просмотр"
    else:
        access = "ограниченный"
    return (
        report_header("WASH PRO CRM", f"Здравствуйте, {name}")
        + report_section(
            "Разделы",
            "Кнопки меню зависят от настроек бота и вашей группы в CRM.",
        )
        + report_section("Доступ", f"Режим: {esc(access)}")
        + "\\n\\n"
        + report_footer()
    )


# --- Inline menus ---

def show_main_menu(chat_id: int) -> None:
    session = current_session(chat_id) or {}
    send_ui(chat_id, welcome_text(session), main_reply_keyboard(chat_id))


def show_inline_menu(chat_id: int, menu: str) -> None:
    if menu == "monitor":
        if not access_allowed(chat_id, "status"):
            send_ui(chat_id, ui_warning("Раздел недоступен для вашей учётной записи."))
            return
        kb = inline_keyboard([
            [("Статус", "a:status"), ("Автомойки", "a:washes")],
            [("Посты", "a:posts")],
            back_row("m:main"),
        ])
        send_ui(chat_id, ui_menu("📊 Мониторинг"), kb)
    elif menu == "washes":
        rows = []
        if access_allowed(chat_id, "washes"):
            rows.append([("Список", "a:washes")])
        if access_allowed(chat_id, "wash_add"):
            rows.append([("➕ Создать автомойку", "f:wash_add")])
        if access_allowed(chat_id, "wash_del"):
            rows.append([("🗑 Удалить автомойку", "f:wash_del")])
        if not rows:
            send_ui(chat_id, ui_warning("Раздел недоступен для вашей учётной записи."))
            return
        rows.append(back_row("m:main"))
        send_ui(chat_id, ui_menu("🏢 Автомойки", "Управление объектами:"), inline_keyboard(rows))
    elif menu == "posts":
        rows = []
        if access_allowed(chat_id, "posts"):
            rows.append([("Список постов", "a:posts")])
        if access_allowed(chat_id, "post_add"):
            rows.append([("➕ Создать пост", "f:post_add")])
        if access_allowed(chat_id, "post_del"):
            rows.append([("🗑 Удалить пост", "f:post_del")])
        if not rows:
            send_ui(chat_id, ui_warning("Раздел недоступен для вашей учётной записи."))
            return
        rows.append(back_row("m:main"))
        send_ui(chat_id, ui_menu("🅿️ Посты", "Управление постами:"), inline_keyboard(rows))
    elif menu == "commands":
        if not access_allowed(chat_id, "post_cmd"):
            send_ui(chat_id, ui_warning("Команды поста недоступны для вашей учётной записи."))
            return
        cmd_rows = [
            [(DEVICE_LABELS[k], f"c:{k}")]
            for k in ("soft_reset", "hard_reset", "credit_balance", "fault_mode", "service_mode", "vip_mode", "collection_mode")
        ]
        cmd_rows.append(back_row("m:main"))
        send_ui(chat_id, ui_step("⚙️ Команды поста", 1, 3, "Выберите команду"), inline_keyboard(cmd_rows))
    elif menu == "reports":
        rows = []
        if access_allowed(chat_id, "revenue"):
            rows.append([("💰 Выручка", "a:revenue")])
        if access_allowed(chat_id, "statistics"):
            rows.append([("📊 Статистика", "a:statistics")])
        if access_allowed(chat_id, "cards"):
            rows.append([("💳 Карты", "a:cards")])
        if not rows:
            send_ui(chat_id, ui_warning("Отчёты недоступны для вашей учётной записи."))
            return
        rows.append(back_row("m:main"))
        send_ui(chat_id, ui_menu("📈 Отчёты"), inline_keyboard(rows))
    elif menu == "help":
        send_ui(chat_id, help_text(), inline_keyboard([back_row("m:main")]))
    else:
        show_main_menu(chat_id)


def help_text() -> str:
    return (
        report_header("Справка", "WASH PRO CRM · Telegram-бот")
        + report_section(
            "Навигация",
            "├ Главное меню — кнопки внизу экрана\\n"
            "├ Подменю — кнопки под сообщением\\n"
            "├ Многошаговые сценарии — бот задаст вопросы по очереди\\n"
            "└ Отмена — «✕ Отмена» или /menu",
        )
        + report_section(
            "Команды",
            "/status · /washes · /posts · /revenue · /statistics · /cards · /post_cmd",
        )
        + "\\n\\n"
        + report_footer()
    )


def post_picker_keyboard(command_key: str) -> dict:
    posts = api_get("/api/crm/posts?limit=12") or []
    rows: list[list[tuple[str, str]]] = []
    row: list[tuple[str, str]] = []
    for post in posts:
        pid = ref_id(post)
        serial = str(post.get("serialNumber", ""))
        label = f"#{post.get('postNumber', '?')} {serial}"[:40]
        row.append((label, f"s:{command_key}:{pid}"))
        if len(row) == 2:
            rows.append(row)
            row = []
    if row:
        rows.append(row)
    rows.append(back_row("m:commands"))
    return inline_keyboard(rows)


def wash_picker_keyboard(flow: str) -> dict:
    washes = api_get("/api/crm/washes?limit=12") or []
    rows: list[list[tuple[str, str]]] = []
    for wash in washes:
        wid = ref_id(wash)
        label = str(wash.get("name", wid))[:40]
        rows.append([(label, f"w:{flow}:{wid}")])
    rows.append(back_row())
    return inline_keyboard(rows)


# --- Multi-step flows ---

def start_flow(chat_id: int, flow: str) -> None:
    if flow == "wash_add":
        set_flow(chat_id, "wash_add", "name", {})
        send_ui(chat_id, ui_step("➕ Создание автомойки", 1, 2, "Введите <b>название</b>:"), inline_keyboard([back_row()]))
    elif flow == "wash_del":
        washes = api_get("/api/crm/washes?limit=100") or []
        if not washes:
            send_ui(chat_id, ui_empty("Автомойки", "Нет зарегистрированных объектов"))
            return
        set_flow(chat_id, "wash_del", "pick", {})
        send_ui(chat_id, ui_menu("🗑 Удаление автомойки", "Выберите объект:"), wash_picker_keyboard("wash_del"))
    elif flow == "post_add":
        washes = api_get("/api/crm/washes?limit=100") or []
        if not washes:
            send_ui(chat_id, ui_warning("Сначала создайте автомойку"))
            return
        set_flow(chat_id, "post_add", "wash", {})
        send_ui(chat_id, ui_step("➕ Создание поста", 1, 4, "Выберите автомойку:"), wash_picker_keyboard("post_add"))
    elif flow == "post_del":
        posts = api_get("/api/crm/posts?limit=100") or []
        if not posts:
            send_ui(chat_id, ui_empty("Посты", "Постов нет"))
            return
        set_flow(chat_id, "post_del", "pick", {})
        rows = [[(f"#{p.get('postNumber')} {p.get('serialNumber', '')}"[:40], f"p:post_del:{ref_id(p)}")] for p in posts[:12]]
        rows.append(back_row("m:posts"))
        send_ui(chat_id, ui_menu("🗑 Удаление поста", "Выберите пост:"), inline_keyboard(rows))


def handle_flow_text(chat_id: int, text: str) -> bool:
    flow = get_flow(chat_id)
    if not flow:
        return False
    flow_name = flow["flow"]
    if flow_name in ("wash_add", "wash_del", "post_add", "post_del", "post_cmd"):
        action_key = flow_name
        if not access_allowed(chat_id, action_key):
            send_ui(chat_id, ui_write_denied())
            clear_flow(chat_id)
            return True
    data = flow["data"]
    step = flow["step"]
    name = flow["flow"]

    if name == "wash_add":
        if step == "name":
            data["name"] = text.strip()
            set_flow(chat_id, name, "address", data)
            send_ui(
                chat_id,
                ui_step("➕ Создание автомойки", 2, 2, f"Введите <b>адрес</b> для «{esc(data['name'])}»:"),
                inline_keyboard([back_row()]),
            )
            return True
        if step == "address":
            created = api_post("/api/crm/washes", {"name": data["name"], "address": text.strip()}) or {}
            wid = ref_id(created) or "?"
            clear_flow(chat_id)
            send_ui(chat_id, ui_success("Автомойка создана", f"└ ID: <code>{esc(wid)}</code>"), main_reply_keyboard(chat_id))
            return True

    if name == "post_add":
        if step == "number":
            try:
                data["postNumber"] = int(text.strip())
            except ValueError:
                send_ui(chat_id, ui_warning("Введите номер поста числом"))
                return True
            set_flow(chat_id, name, "serial", data)
            send_ui(chat_id, ui_step("➕ Создание поста", 3, 4, "Введите <b>серийный номер</b> (serial):"), inline_keyboard([back_row()]))
            return True
        if step == "serial":
            data["serial"] = text.strip()
            set_flow(chat_id, name, "title", data)
            send_ui(chat_id, ui_step("➕ Создание поста", 4, 4, "Введите <b>название</b> поста:"), inline_keyboard([back_row()]))
            return True
        if step == "title":
            serial = data["serial"]
            mqtt_login = default_mqtt_login(serial)
            mqtt_password = generate_mqtt_password()
            created = api_post("/api/crm/posts", {
                "washId": data["washId"], "postNumber": data["postNumber"],
                "name": text.strip(), "serialNumber": serial,
                "settings": {"mqttLogin": mqtt_login, "mqttPassword": mqtt_password},
            }) or {}
            mqtt_sync_users()
            clear_flow(chat_id)
            send_ui(
                chat_id,
                ui_success(
                    "Пост создан",
                    f"├ ID: <code>{esc(ref_id(created))}</code>",
                    f"└ Serial: <code>{esc(serial)}</code>",
                ),
                main_reply_keyboard(chat_id),
            )
            return True

    if name == "post_cmd":
        if step == "amount":
            try:
                amount = float(text.strip().replace(",", "."))
            except ValueError:
                send_ui(chat_id, ui_warning("Введите сумму числом, например 500"))
                return True
            serial = data["serial"]
            command_key = data["command"]
            clear_flow(chat_id)
            try:
                reply = execute_post_command(serial, command_key, amount)
            except Exception as exc:
                reply = ui_error(str(exc))
            send_ui(chat_id, reply, main_reply_keyboard(chat_id))
            return True

    return False


def handle_callback(chat_id: int, callback_id: str, data: str) -> None:
    answer_callback(callback_id)

    if data == "x:cancel":
        clear_flow(chat_id)
        send_ui(chat_id, ui_notice("Отмена", "Действие отменено", footer=True), main_reply_keyboard(chat_id))
        return

    if data == "m:main":
        clear_flow(chat_id)
        show_main_menu(chat_id)
        return

    if data.startswith("m:"):
        show_inline_menu(chat_id, data[2:])
        return

    if data.startswith("a:"):
        action = data[2:]
        if not access_allowed(chat_id, action):
            send_ui(chat_id, ui_warning("Действие недоступно для вашей учётной записи."))
            return
        actions = {
            "status": action_status, "washes": action_washes, "posts": action_posts,
            "revenue": action_revenue, "statistics": action_statistics, "cards": action_cards,
        }
        fn = actions.get(action)
        if fn:
            send_ui(chat_id, fn(), inline_keyboard([back_row()]))
        return

    if data.startswith("f:"):
        flow = data[2:]
        if flow == "wash_add" and not access_allowed(chat_id, "wash_add"):
            send_ui(chat_id, ui_write_denied())
            return
        if flow == "wash_del" and not access_allowed(chat_id, "wash_del"):
            send_ui(chat_id, ui_write_denied())
            return
        if flow == "post_add" and not access_allowed(chat_id, "post_add"):
            send_ui(chat_id, ui_write_denied())
            return
        if flow == "post_del" and not access_allowed(chat_id, "post_del"):
            send_ui(chat_id, ui_write_denied())
            return
        start_flow(chat_id, flow)
        return

    if data.startswith("c:"):
        command_key = data[2:]
        if not access_allowed(chat_id, "post_cmd"):
            send_ui(chat_id, ui_write_denied())
            return
        posts = api_get("/api/crm/posts?limit=100") or []
        if not posts:
            send_ui(chat_id, ui_empty("Посты", "Постов нет. Сначала создайте пост."))
            return
        label = DEVICE_LABELS.get(command_key, command_key)
        set_flow(chat_id, "post_cmd", "pick", {"command": command_key})
        send_ui(
            chat_id,
            ui_step(f"⚙️ {label}", 2, 3, "Выберите пост"),
            post_picker_keyboard(command_key),
        )
        return

    if data.startswith("s:"):
        # s:command_key:post_id
        parts = data.split(":", 2)
        if len(parts) < 3:
            return
        command_key, post_id = parts[1], parts[2]
        post = find_post(post_id)
        if not post:
            send_ui(chat_id, ui_error("Пост не найден"))
            return
        serial = str(post.get("serialNumber", ""))
        if command_key == "credit_balance":
            set_flow(chat_id, "post_cmd", "amount", {"command": command_key, "serial": serial})
            send_ui(
                chat_id,
                ui_step("⚙️ Зачислить баланс", 3, 3, f"Введите <b>сумму</b> для поста <code>{esc(serial)}</code>:"),
                inline_keyboard([back_row("m:commands")]),
            )
        else:
            clear_flow(chat_id)
            try:
                reply = execute_post_command(serial, command_key)
            except Exception as exc:
                reply = ui_error(str(exc))
            send_ui(chat_id, reply, main_reply_keyboard(chat_id))
        return

    if data.startswith("w:"):
        # w:flow:wash_id
        parts = data.split(":", 2)
        if len(parts) < 3:
            return
        flow_name, wash_id = parts[1], parts[2]
        if flow_name == "wash_del":
            if not find_wash(wash_id):
                send_ui(chat_id, ui_error("Автомойка не найдена"))
                return
            api_delete(f"/api/crm/washes/{wash_id}")
            mqtt_sync_users()
            clear_flow(chat_id)
            send_ui(chat_id, ui_success("Автомойка удалена", f"└ ID: <code>{esc(wash_id)}</code>"), main_reply_keyboard(chat_id))
            return
        if flow_name == "post_add":
            set_flow(chat_id, "post_add", "number", {"washId": wash_id})
            send_ui(chat_id, ui_step("➕ Создание поста", 2, 4, "Введите <b>номер поста</b> (число):"), inline_keyboard([back_row()]))
            return

    if data.startswith("p:"):
        # p:post_del:post_id
        parts = data.split(":", 2)
        if len(parts) < 3:
            return
        flow_name, post_id = parts[1], parts[2]
        if flow_name == "post_del":
            if not find_post(post_id):
                send_ui(chat_id, ui_error("Пост не найден"))
                return
            api_delete(f"/api/crm/posts/{post_id}")
            mqtt_sync_users()
            clear_flow(chat_id)
            send_ui(chat_id, ui_success("Пост удалён", f"└ ID: <code>{esc(post_id)}</code>"), main_reply_keyboard(chat_id))
            return


def handle_slash_command(chat_id: int, text: str) -> None:
    parts = text.strip().split()
    cmd = normalize_command(parts[0])
    args = parts[1:]

    if cmd in ("/start", "/menu"):
        clear_flow(chat_id)
        show_main_menu(chat_id)
        return
    if cmd == "/help":
        send_ui(chat_id, help_text(), inline_keyboard([back_row("m:main")]))
        return
    if cmd == "/status":
        if not access_allowed(chat_id, "status"):
            send_ui(chat_id, ui_warning("Команда недоступна для вашей учётной записи."))
            return
        send_ui(chat_id, action_status(), inline_keyboard([back_row()]))
        return
    if cmd == "/washes":
        if not access_allowed(chat_id, "washes"):
            send_ui(chat_id, ui_warning("Команда недоступна для вашей учётной записи."))
            return
        send_ui(chat_id, action_washes(), inline_keyboard([back_row()]))
        return
    if cmd == "/posts":
        if not access_allowed(chat_id, "posts"):
            send_ui(chat_id, ui_warning("Команда недоступна для вашей учётной записи."))
            return
        send_ui(chat_id, action_posts(), inline_keyboard([back_row()]))
        return
    if cmd == "/revenue":
        if not access_allowed(chat_id, "revenue"):
            send_ui(chat_id, ui_warning("Команда недоступна для вашей учётной записи."))
            return
        send_ui(chat_id, action_revenue(), inline_keyboard([back_row()]))
        return
    if cmd == "/statistics":
        if not access_allowed(chat_id, "statistics"):
            send_ui(chat_id, ui_warning("Команда недоступна для вашей учётной записи."))
            return
        send_ui(chat_id, action_statistics(), inline_keyboard([back_row()]))
        return
    if cmd == "/cards":
        if not access_allowed(chat_id, "cards"):
            send_ui(chat_id, ui_warning("Команда недоступна для вашей учётной записи."))
            return
        send_ui(chat_id, action_cards(), inline_keyboard([back_row()]))
        return
    if cmd == "/post_cmd" and len(args) >= 2:
        if not access_allowed(chat_id, "post_cmd"):
            send_ui(chat_id, ui_write_denied())
            return
        command_key = DEVICE_COMMANDS.get(args[1].lower(), args[1])
        amount = float(args[2]) if len(args) > 2 and command_key == "credit_balance" else None
        send_ui(chat_id, execute_post_command(args[0], command_key, amount), main_reply_keyboard(chat_id))
        return

    send_ui(chat_id, ui_hint("Команда не поддерживается в кратком режиме. Используйте меню или /menu"), main_reply_keyboard(chat_id))


def process_update(chat_id: int, user_id: int, text: str | None, callback: dict | None) -> None:
    session = resolve_user_session(user_id)
    if not session:
        if callback:
            answer_callback(str(callback.get("id", "")))
        if text or callback:
            send_guest_reply(chat_id, user_id)
        return

    _CHAT_SESSION[chat_id] = session
    try:
        if callback:
            handle_callback(chat_id, callback["id"], callback.get("data") or "")
            return

        if not text:
            return

        if handle_flow_text(chat_id, text.strip()):
            return

        if text.strip() in MENU_BUTTONS:
            menu = MENU_BUTTONS[text.strip()]
            if menu == "main":
                clear_flow(chat_id)
                show_main_menu(chat_id)
            elif menu == "help":
                show_inline_menu(chat_id, "help")
            elif menu == "commands" and not access_allowed(chat_id, "post_cmd"):
                send_ui(chat_id, ui_write_denied())
            elif menu == "washes" and not menu_section_visible(chat_id, "washes"):
                send_ui(chat_id, ui_warning("Раздел недоступен для вашей учётной записи."))
            elif menu == "posts" and not menu_section_visible(chat_id, "posts"):
                send_ui(chat_id, ui_warning("Раздел недоступен для вашей учётной записи."))
            elif menu == "reports" and not menu_section_visible(chat_id, "reports"):
                send_ui(chat_id, ui_warning("Раздел недоступен для вашей учётной записи."))
            elif menu == "monitor" and not menu_section_visible(chat_id, "monitor"):
                send_ui(chat_id, ui_warning("Раздел недоступен для вашей учётной записи."))
            else:
                show_inline_menu(chat_id, menu)
            return

        if text.strip().startswith("/"):
            parts = text.strip().split()
            cmd = normalize_command(parts[0])
            if not command_allowed(cmd):
                send_ui(chat_id, ui_warning("Команда не разрешена"))
                return
            try:
                handle_slash_command(chat_id, text.strip())
            except Exception as exc:
                send_ui(chat_id, ui_error(str(exc)))
            return

        send_ui(chat_id, ui_hint("Выберите пункт меню или нажмите 🏠 Главное меню"), main_reply_keyboard(chat_id))
    finally:
        _CHAT_SESSION.pop(chat_id, None)


def main() -> None:
    if not TELEGRAM_TOKEN:
        print("SECRET_TELEGRAM_TOKEN not configured")
        return
    if not ADMIN_IDS:
        print("INFO: CRM telegram auth via /api/users/telegram/{id}/auth (ADMIN_IDS optional fallback)")
    print(f"WASH PRO CRM Telegram bot v{BOT_VERSION} started")
    try:
        cur = resolve_default_currency()
        print(f"Default currency: {cur.get('code')} ({cur.get('symbol')})")
    except Exception as exc:
        print(f"Default currency init failed: {exc}")
    time.sleep(2)
    if not acquire_poll_lock():
        print("Another bot instance is already polling this Telegram token. Exit.")
        return
    offset = bootstrap_polling()
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
                update_id = int(update["update_id"])
                next_offset = update_id + 1
                if not remember_update(update_id):
                    offset = next_offset
                    save_update_offset(offset)
                    continue
                offset = next_offset
                save_update_offset(offset)
                cb = update.get("callback_query")
                if cb:
                    if not remember_callback(str(cb.get("id", ""))):
                        continue
                    msg = cb.get("message") or {}
                    chat = msg.get("chat") or {}
                    user = cb.get("from") or {}
                    if "id" in chat and "id" in user:
                        try:
                            process_update(chat["id"], user["id"], None, cb)
                        except Exception as exc:
                            print(f"Callback failed: {exc}")
                    continue
                msg = update.get("message") or {}
                text = msg.get("text") or ""
                user = msg.get("from") or {}
                chat = msg.get("chat") or {}
                if not user or "id" not in chat:
                    continue
                try:
                    process_update(chat["id"], user["id"], text, None)
                except Exception as exc:
                    print(f"Message failed: {exc}")
        except Exception as exc:
            print(f"Poll cycle error: {exc}")
            time.sleep(5)


if __name__ == "__main__":
    main()
`;

const WASH_BOT_COMMANDS_MARKER = '# __WASH_BOT_ALLOWED_COMMANDS__';

const DEFAULT_BOT_COMMANDS = [
  '/help',
  '/start',
  '/menu',
  '/status',
  '/washes',
  '/wash',
  '/wash_add',
  '/wash_edit',
  '/wash_del',
  '/posts',
  '/post',
  '/post_add',
  '/post_edit',
  '/post_del',
  '/post_cmd',
  '/revenue',
  '/statistics',
  '/cards',
];

import { WASH_TELEGRAM_INFO_BOT_MAIN } from './infoBotTemplate.js';

export type WashBotType = 'management' | 'service' | 'informational';

/** Генерирует main.py с зашитыми allowed-командами из настроек бота в CRM. */
export function generateBotMain(allowedCommands: string[], botType: WashBotType = 'management'): string {
  if (botType === 'informational') {
    return WASH_TELEGRAM_INFO_BOT_MAIN;
  }
  const cmds = [
    ...new Set(
      (allowedCommands.length ? allowedCommands : DEFAULT_BOT_COMMANDS)
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
  const baked = `BAKED_ALLOWED_COMMANDS: list[str] = [${cmds.map((c) => JSON.stringify(c)).join(', ')}]`;
  return WASH_TELEGRAM_BOT_MAIN.replace(
    /BAKED_ALLOWED_COMMANDS: list\[str\] = \[\]  # __WASH_BOT_ALLOWED_COMMANDS__/,
    `${baked}  ${WASH_BOT_COMMANDS_MARKER}`
  );
}
