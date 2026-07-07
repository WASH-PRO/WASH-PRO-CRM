export const WASH_TELEGRAM_BOT_MAIN = `"""WASH PRO CRM Telegram bot — menu-driven UI with multi-step flows."""
import html
import json
import os
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request

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


def allowed_commands() -> list[str]:
    return ALLOWED if ALLOWED else DEFAULT_COMMANDS


def command_allowed(cmd: str) -> bool:
    return is_public_command(cmd) or cmd in allowed_commands()


def action_allowed(action: str) -> bool:
    mapped = ACTION_TO_CMD.get(action)
    return command_allowed(mapped) if mapped else True


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


def send_ui(chat_id: int, text: str, reply_markup: dict | None = None) -> None:
    for parse_mode in ("HTML", None):
        body: dict[str, object] = {"chat_id": chat_id, "text": text}
        if parse_mode:
            body["parse_mode"] = parse_mode
        if reply_markup:
            body["reply_markup"] = reply_markup
        try:
            parsed = telegram_api("sendMessage", body)
            if parsed.get("ok"):
                return
            print(f"sendMessage failed: {parsed}")
        except Exception as exc:
            print(f"sendMessage error ({parse_mode}): {exc}")
    raise RuntimeError("Не удалось отправить сообщение")


def answer_callback(callback_id: str, text: str = "") -> None:
    body: dict[str, object] = {"callback_query_id": callback_id}
    if text:
        body["text"] = text
    try:
        telegram_api("answerCallbackQuery", body)
    except Exception as exc:
        print(f"answerCallbackQuery error: {exc}")


def main_reply_keyboard() -> dict:
    return {
        "keyboard": [
            [{"text": "📊 Мониторинг"}, {"text": "🏢 Автомойки"}],
            [{"text": "🅿️ Посты"}, {"text": "⚙️ Команды"}],
            [{"text": "📈 Отчёты"}, {"text": "❓ Справка"}],
            [{"text": "🏠 Главное меню"}],
        ],
        "resize_keyboard": True,
        "is_persistent": True,
    }


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


# --- Actions (return text) ---

def action_status() -> str:
    states = api_get("/api/crm/post-states?limit=100") or []
    online = sum(1 for s in states if s.get("connected"))
    return f"<b>Статус системы</b>\\nПостов онлайн: {online}/{len(states)}"


def action_washes() -> str:
    washes = api_get("/api/crm/washes?limit=50") or []
    if not washes:
        return "Автомоек нет"
    return "<b>Автомойки</b>\\n" + "\\n".join(wash_line(w) for w in washes)


def action_posts() -> str:
    posts = api_get("/api/crm/posts?limit=100") or []
    if not posts:
        return "Постов нет"
    return "<b>Посты</b>\\n" + "\\n".join(post_line(p) for p in posts)


def action_revenue() -> str:
    stats = api_get("/api/crm/finance-stats?limit=50") or []
    total = sum(float(s.get("totalRevenue") or 0) for s in stats)
    return f"<b>Выручка</b>\\nОбщая: {total:.2f} ₽\\nЗаписей: {len(stats)}"


def action_statistics() -> str:
    stats = api_get("/api/crm/usage-stats?limit=50") or []
    launches = sum(int(s.get("launchCount") or 0) for s in stats)
    usage = sum(float(s.get("usageTime") or 0) for s in stats)
    return f"<b>Статистика</b>\\nЗапусков: {launches}\\nВремя: {round(usage / 60)} мин"


def action_cards() -> str:
    cards = api_get("/api/crm/cards?limit=20") or []
    if not cards:
        return "Карт нет"
    return "<b>Карты</b>\\n" + "\\n".join(
        f"• {esc(c.get('cardNumber', '?'))}: {c.get('balance', 0)}₽" for c in cards
    )


def execute_post_command(serial: str, command_key: str, amount: float | None = None) -> str:
    post = find_post_by_serial(serial)
    if not post:
        return f"Пост <code>{esc(serial)}</code> не найден"
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
    return f"✅ {esc(label)} → <code>{esc(serial)}</code>\\n{esc(topic)}"


def welcome_text() -> str:
    return (
        "<b>Добро пожаловать в WASH PRO CRM</b>\\n\\n"
        "Используйте кнопки меню ниже или вложенные кнопки в сообщениях.\\n"
        "Для многошаговых операций бот задаст вопросы по очереди.\\n\\n"
        "Пример: <b>Команды</b> → <b>Зачислить баланс</b> → выбор поста → ввод суммы."
    )


# --- Inline menus ---

def show_main_menu(chat_id: int) -> None:
    send_ui(chat_id, welcome_text(), main_reply_keyboard())
    send_ui(
        chat_id,
        "<b>Быстрый доступ</b> — кнопки под этим сообщением:",
        inline_keyboard([
            [("📊 Мониторинг", "m:monitor"), ("🏢 Автомойки", "m:washes")],
            [("🅿️ Посты", "m:posts"), ("⚙️ Команды", "m:commands")],
            [("📈 Отчёты", "m:reports")],
        ]),
    )


def show_inline_menu(chat_id: int, menu: str) -> None:
    if menu == "monitor":
        if not action_allowed("status"):
            send_ui(chat_id, "Раздел недоступен в настройках бота.")
            return
        kb = inline_keyboard([
            [("Статус", "a:status"), ("Автомойки", "a:washes")],
            [("Посты", "a:posts")],
            back_row("m:main"),
        ])
        send_ui(chat_id, "<b>Мониторинг</b>\\nВыберите действие:", kb)
    elif menu == "washes":
        rows = [[("Список", "a:washes")]]
        if action_allowed("wash_add"):
            rows.append([("➕ Создать автомойку", "f:wash_add")])
        if action_allowed("wash_del"):
            rows.append([("🗑 Удалить автомойку", "f:wash_del")])
        rows.append(back_row("m:main"))
        send_ui(chat_id, "<b>Автомойки</b>\\nУправление объектами:", inline_keyboard(rows))
    elif menu == "posts":
        rows = [[("Список постов", "a:posts")]]
        if action_allowed("post_add"):
            rows.append([("➕ Создать пост", "f:post_add")])
        if action_allowed("post_del"):
            rows.append([("🗑 Удалить пост", "f:post_del")])
        rows.append(back_row("m:main"))
        send_ui(chat_id, "<b>Посты</b>\\nУправление постами:", inline_keyboard(rows))
    elif menu == "commands":
        if not action_allowed("post_cmd"):
            send_ui(chat_id, "Команды поста отключены в настройках бота.")
            return
        cmd_rows = [
            [(DEVICE_LABELS[k], f"c:{k}")]
            for k in ("soft_reset", "hard_reset", "credit_balance", "fault_mode", "service_mode", "vip_mode", "collection_mode")
        ]
        cmd_rows.append(back_row("m:main"))
        send_ui(chat_id, "<b>Команды поста</b>\\nШаг 1: выберите команду", inline_keyboard(cmd_rows))
    elif menu == "reports":
        rows = []
        if action_allowed("revenue"):
            rows.append([("💰 Выручка", "a:revenue")])
        if action_allowed("statistics"):
            rows.append([("📊 Статистика", "a:statistics")])
        if action_allowed("cards"):
            rows.append([("💳 Карты", "a:cards")])
        rows.append(back_row("m:main"))
        send_ui(chat_id, "<b>Отчёты</b>", inline_keyboard(rows))
    elif menu == "help":
        send_ui(chat_id, help_text(), inline_keyboard([back_row("m:main")]))
    else:
        show_main_menu(chat_id)


def help_text() -> str:
    return (
        "<b>Справка</b>\\n"
        "• Главное меню — кнопки внизу экрана\\n"
        "• Подменю — кнопки под сообщением\\n"
        "• Многошаговые сценарии: бот спросит данные по очереди\\n"
        "• Отмена — кнопка «✕ Отмена» или /menu\\n\\n"
        "<b>Текстовые команды</b> (для опытных): /status, /washes, /post_cmd …"
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
        send_ui(chat_id, "➕ <b>Создание автомойки</b>\\nШаг 1/2: введите <b>название</b>:", inline_keyboard([back_row()]))
    elif flow == "wash_del":
        washes = api_get("/api/crm/washes?limit=100") or []
        if not washes:
            send_ui(chat_id, "Автомоек нет")
            return
        set_flow(chat_id, "wash_del", "pick", {})
        send_ui(chat_id, "🗑 <b>Удаление автомойки</b>\\nВыберите объект:", wash_picker_keyboard("wash_del"))
    elif flow == "post_add":
        washes = api_get("/api/crm/washes?limit=100") or []
        if not washes:
            send_ui(chat_id, "Сначала создайте автомойку")
            return
        set_flow(chat_id, "post_add", "wash", {})
        send_ui(chat_id, "➕ <b>Создание поста</b>\\nШаг 1/4: выберите автомойку:", wash_picker_keyboard("post_add"))
    elif flow == "post_del":
        posts = api_get("/api/crm/posts?limit=100") or []
        if not posts:
            send_ui(chat_id, "Постов нет")
            return
        set_flow(chat_id, "post_del", "pick", {})
        rows = [[(f"#{p.get('postNumber')} {p.get('serialNumber', '')}"[:40], f"p:post_del:{ref_id(p)}")] for p in posts[:12]]
        rows.append(back_row("m:posts"))
        send_ui(chat_id, "🗑 <b>Удаление поста</b>\\nВыберите пост:", inline_keyboard(rows))


def handle_flow_text(chat_id: int, text: str) -> bool:
    flow = get_flow(chat_id)
    if not flow:
        return False
    data = flow["data"]
    step = flow["step"]
    name = flow["flow"]

    if name == "wash_add":
        if step == "name":
            data["name"] = text.strip()
            set_flow(chat_id, name, "address", data)
            send_ui(chat_id, f"Шаг 2/2: введите <b>адрес</b> для «{esc(data['name'])}»:", inline_keyboard([back_row()]))
            return True
        if step == "address":
            created = api_post("/api/crm/washes", {"name": data["name"], "address": text.strip()}) or {}
            wid = ref_id(created) or "?"
            clear_flow(chat_id)
            send_ui(chat_id, f"✅ Автомойка создана\\nID: <code>{esc(wid)}</code>", main_reply_keyboard())
            return True

    if name == "post_add":
        if step == "number":
            try:
                data["postNumber"] = int(text.strip())
            except ValueError:
                send_ui(chat_id, "Введите номер поста числом:")
                return True
            set_flow(chat_id, name, "serial", data)
            send_ui(chat_id, "Шаг 3/4: введите <b>серийный номер</b> (serial):", inline_keyboard([back_row()]))
            return True
        if step == "serial":
            data["serial"] = text.strip()
            set_flow(chat_id, name, "title", data)
            send_ui(chat_id, "Шаг 4/4: введите <b>название</b> поста:", inline_keyboard([back_row()]))
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
                f"✅ Пост создан\\nID: <code>{esc(ref_id(created))}</code>\\nSerial: <code>{esc(serial)}</code>",
                main_reply_keyboard(),
            )
            return True

    if name == "post_cmd":
        if step == "amount":
            try:
                amount = float(text.strip().replace(",", "."))
            except ValueError:
                send_ui(chat_id, "Введите сумму числом, например 500:")
                return True
            serial = data["serial"]
            command_key = data["command"]
            clear_flow(chat_id)
            try:
                reply = execute_post_command(serial, command_key, amount)
            except Exception as exc:
                reply = f"Ошибка: {esc(exc)}"
            send_ui(chat_id, reply, main_reply_keyboard())
            return True

    return False


def handle_callback(chat_id: int, callback_id: str, data: str) -> None:
    answer_callback(callback_id)

    if data == "x:cancel":
        clear_flow(chat_id)
        send_ui(chat_id, "Отменено.", main_reply_keyboard())
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
        if not action_allowed(action):
            send_ui(chat_id, "Действие отключено в настройках бота.")
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
        if not action_allowed(flow.replace("_add", "_add").replace("wash", "wash")):
            pass
        if flow == "wash_add" and not action_allowed("wash_add"):
            send_ui(chat_id, "Создание автомоек отключено.")
            return
        if flow == "wash_del" and not action_allowed("wash_del"):
            send_ui(chat_id, "Удаление автомоек отключено.")
            return
        if flow == "post_add" and not action_allowed("post_add"):
            send_ui(chat_id, "Создание постов отключено.")
            return
        if flow == "post_del" and not action_allowed("post_del"):
            send_ui(chat_id, "Удаление постов отключено.")
            return
        start_flow(chat_id, flow)
        return

    if data.startswith("c:"):
        command_key = data[2:]
        if not action_allowed("post_cmd"):
            send_ui(chat_id, "Команды поста отключены.")
            return
        posts = api_get("/api/crm/posts?limit=100") or []
        if not posts:
            send_ui(chat_id, "Постов нет. Сначала создайте пост.")
            return
        label = DEVICE_LABELS.get(command_key, command_key)
        if command_key == "credit_balance":
            set_flow(chat_id, "post_cmd", "pick", {"command": command_key})
            send_ui(
                chat_id,
                f"<b>{esc(label)}</b>\\nШаг 2: выберите пост",
                post_picker_keyboard(command_key),
            )
        else:
            set_flow(chat_id, "post_cmd", "pick", {"command": command_key})
            send_ui(
                chat_id,
                f"<b>{esc(label)}</b>\\nШаг 2: выберите пост",
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
            send_ui(chat_id, "Пост не найден")
            return
        serial = str(post.get("serialNumber", ""))
        if command_key == "credit_balance":
            set_flow(chat_id, "post_cmd", "amount", {"command": command_key, "serial": serial})
            send_ui(
                chat_id,
                f"Шаг 3: введите <b>сумму</b> для поста <code>{esc(serial)}</code>:",
                inline_keyboard([back_row("m:commands")]),
            )
        else:
            clear_flow(chat_id)
            try:
                reply = execute_post_command(serial, command_key)
            except Exception as exc:
                reply = f"Ошибка: {esc(exc)}"
            send_ui(chat_id, reply, main_reply_keyboard())
        return

    if data.startswith("w:"):
        # w:flow:wash_id
        parts = data.split(":", 2)
        if len(parts) < 3:
            return
        flow_name, wash_id = parts[1], parts[2]
        if flow_name == "wash_del":
            if not find_wash(wash_id):
                send_ui(chat_id, "Автомойка не найдена")
                return
            api_delete(f"/api/crm/washes/{wash_id}")
            mqtt_sync_users()
            clear_flow(chat_id)
            send_ui(chat_id, f"✅ Автомойка <code>{esc(wash_id)}</code> удалена", main_reply_keyboard())
            return
        if flow_name == "post_add":
            set_flow(chat_id, "post_add", "number", {"washId": wash_id})
            send_ui(chat_id, "Шаг 2/4: введите <b>номер поста</b> (число):", inline_keyboard([back_row()]))
            return

    if data.startswith("p:"):
        # p:post_del:post_id
        parts = data.split(":", 2)
        if len(parts) < 3:
            return
        flow_name, post_id = parts[1], parts[2]
        if flow_name == "post_del":
            if not find_post(post_id):
                send_ui(chat_id, "Пост не найден")
                return
            api_delete(f"/api/crm/posts/{post_id}")
            mqtt_sync_users()
            clear_flow(chat_id)
            send_ui(chat_id, f"✅ Пост <code>{esc(post_id)}</code> удалён", main_reply_keyboard())
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
        send_ui(chat_id, action_status(), inline_keyboard([back_row()]))
        return
    if cmd == "/washes":
        send_ui(chat_id, action_washes(), inline_keyboard([back_row()]))
        return
    if cmd == "/posts":
        send_ui(chat_id, action_posts(), inline_keyboard([back_row()]))
        return
    if cmd == "/revenue":
        send_ui(chat_id, action_revenue(), inline_keyboard([back_row()]))
        return
    if cmd == "/statistics":
        send_ui(chat_id, action_statistics(), inline_keyboard([back_row()]))
        return
    if cmd == "/cards":
        send_ui(chat_id, action_cards(), inline_keyboard([back_row()]))
        return
    if cmd == "/post_cmd" and len(args) >= 2:
        command_key = DEVICE_COMMANDS.get(args[1].lower(), args[1])
        amount = float(args[2]) if len(args) > 2 and command_key == "credit_balance" else None
        send_ui(chat_id, execute_post_command(args[0], command_key, amount), main_reply_keyboard())
        return

    send_ui(chat_id, "Команда не поддерживается в кратком режиме. Используйте меню или /menu")


def process_update(chat_id: int, user_id: int, text: str | None, callback: dict | None) -> None:
    if user_id not in ADMIN_IDS:
        send_ui(chat_id, "Доступ запрещён")
        return

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
        else:
            show_inline_menu(chat_id, menu)
        return

    if text.strip().startswith("/"):
        parts = text.strip().split()
        cmd = normalize_command(parts[0])
        if not command_allowed(cmd):
            send_ui(chat_id, "Команда не разрешена")
            return
        try:
            handle_slash_command(chat_id, text.strip())
        except Exception as exc:
            send_ui(chat_id, f"Ошибка: {esc(exc)}")
        return

    send_ui(chat_id, "Выберите пункт меню или нажмите 🏠 Главное меню", main_reply_keyboard())


def main() -> None:
    if not TELEGRAM_TOKEN:
        print("SECRET_TELEGRAM_TOKEN not configured")
        return
    if not ADMIN_IDS:
        print("WARNING: SECRET_ADMIN_IDS is empty")
    print("WASH PRO CRM Telegram bot v2 started")
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
                cb = update.get("callback_query")
                if cb:
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
                    try:
                        send_ui(chat["id"], f"Ошибка: {esc(exc)}")
                    except Exception:
                        pass
        except Exception as exc:
            print(f"Poll cycle error: {exc}")
            time.sleep(5)


if __name__ == "__main__":
    main()
`;
