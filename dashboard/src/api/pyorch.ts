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

export async function createWashTelegramBot(_input: {
  name: string;
  description?: string;
  groupId: string | null;
  code: string;
}): Promise<PyorchScript> {
  throw new Error('Создавайте Telegram-ботов через раздел «Telegram» в CRM (pyorch-bridge).');
}

/** @deprecated Используйте pyorch-bridge / botTemplate.ts */
export const WASH_TELEGRAM_BOT_MAIN = `"""Deprecated — use CRM Telegram page to create bots."""
import sys

print("Шаблон устарел. Создайте бота в CRM: Настройки → Telegram.")
sys.exit(0)
`;

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
