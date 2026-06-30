const PYORCH_BASE = '/pyorch/api/v1';
const PYORCH_TOKEN_KEY = 'wash_pyorch_token';

export interface PyorchScript {
  id: string;
  name: string;
  slug: string;
  description: string;
  script_type: string;
  status: string;
  entrypoint: string;
  group_id: string | null;
  version: number;
  max_concurrent_runs: number;
  max_runtime_seconds: number;
  max_memory_bytes: number;
  metadata: Record<string, unknown>;
  active_run?: {
    id: string;
    status: string;
    started_at: string | null;
    queued_at: string;
  } | null;
}

export interface PyorchGroup {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
}

export interface PyorchTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  file_tree: Record<string, string>;
}

export interface PyorchConnection {
  email: string;
  password: string;
  panelPort?: number;
}

export function getPyorchToken(): string | null {
  return sessionStorage.getItem(PYORCH_TOKEN_KEY);
}

export function clearPyorchToken(): void {
  sessionStorage.removeItem(PYORCH_TOKEN_KEY);
}

export async function pyorchLogin(email: string, password: string): Promise<void> {
  const res = await fetch(`${PYORCH_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(typeof err.detail === 'string' ? err.detail : 'Не удалось войти в PyOrchestrator');
  }
  const data = (await res.json()) as { access_token: string };
  sessionStorage.setItem(PYORCH_TOKEN_KEY, data.access_token);
}

async function pyorchFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getPyorchToken();
  if (!token) throw new Error('PyOrchestrator: требуется авторизация');

  const res = await fetch(`${PYORCH_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string>),
    },
  });

  if (res.status === 401) {
    clearPyorchToken();
    throw new Error('Сессия PyOrchestrator истекла — войдите снова');
  }
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = err.detail;
    const message =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg?: string }) => d.msg ?? String(d)).join(', ')
          : `PyOrchestrator error ${res.status}`;
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export function isWashTelegramBot(script: PyorchScript): boolean {
  return script.metadata?.wash_telegram_bot === true;
}

export async function listGroups(): Promise<PyorchGroup[]> {
  return pyorchFetch<PyorchGroup[]>('/groups');
}

export async function listScripts(groupId?: string): Promise<PyorchScript[]> {
  const q = groupId ? `?group_id=${groupId}` : '';
  return pyorchFetch<PyorchScript[]>(`/scripts${q}`);
}

export async function listTemplates(): Promise<PyorchTemplate[]> {
  return pyorchFetch<PyorchTemplate[]>('/scripts/templates');
}

export async function createWashTelegramBot(input: {
  name: string;
  description?: string;
  groupId: string | null;
  code: string;
}): Promise<PyorchScript> {
  return pyorchFetch<PyorchScript>('/scripts', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      description: input.description ?? 'Telegram bot for WASH PRO CRM',
      group_id: input.groupId,
      script_type: 'bot',
      entrypoint: 'main.py',
      code: input.code,
      metadata: { wash_telegram_bot: true, source: 'wash-pro-crm' },
    }),
  });
}

export async function updateScript(
  id: string,
  patch: Partial<Pick<PyorchScript, 'name' | 'description' | 'status'>> & {
    max_runtime_seconds?: number;
    max_concurrent_runs?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<PyorchScript> {
  return pyorchFetch<PyorchScript>(`/scripts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

export async function deleteScript(id: string): Promise<void> {
  await pyorchFetch<void>(`/scripts/${id}`, { method: 'DELETE' });
}

export async function setScriptSecret(scriptId: string, key: string, value: string): Promise<void> {
  await pyorchFetch(`/scripts/${scriptId}/secrets`, {
    method: 'POST',
    body: JSON.stringify({ key, value, description: '' }),
  });
}

export async function runScript(scriptId: string): Promise<void> {
  await pyorchFetch(`/runs/scripts/${scriptId}/run`, { method: 'POST' });
}

export async function stopScript(scriptId: string): Promise<void> {
  await pyorchFetch(`/runs/scripts/${scriptId}/stop`, { method: 'POST' });
}

export async function enableScript(scriptId: string): Promise<void> {
  await pyorchFetch(`/scripts/${scriptId}/enable`, { method: 'POST' });
}

export async function disableScript(scriptId: string): Promise<void> {
  await pyorchFetch(`/scripts/${scriptId}/disable`, { method: 'POST' });
}

export function orchestratorPanelUrl(scriptId?: string, panelPort = 8090): string {
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const base = `http://${host}:${panelPort}`;
  return scriptId ? `${base}/scripts/${scriptId}` : base;
}

export const WASH_TELEGRAM_COMMANDS = [
  '/status',
  '/washes',
  '/posts',
  '/revenue',
  '/statistics',
  '/cards',
] as const;

export const WASH_TELEGRAM_BOT_MAIN = `"""WASH PRO CRM Telegram bot — runs in PyOrchestrator runtime."""
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
`;
