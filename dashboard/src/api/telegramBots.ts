import { fetchWithAuth } from './client';

export const WASH_TELEGRAM_COMMANDS = [
  '/status',
  '/washes',
  '/posts',
  '/revenue',
  '/statistics',
  '/cards',
] as const;

export interface TelegramBot {
  id: string;
  name: string;
  description: string;
  script_type: string;
  status: string;
  created_at?: string;
  metadata: {
    wash_telegram_bot?: boolean;
    admin_ids?: number[];
    allowed_commands?: string[];
  };
  active_run?: {
    id: string;
    status: string;
    started_at: string | null;
    queued_at: string;
  } | null;
}

interface BridgeResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function bridgeFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetchWithAuth(`/api/telegram-bots${path}`, options);

  const json = (await res.json()) as BridgeResult<T> & { ok?: boolean; error?: string };

  if (path === '/health') {
    if (!res.ok) {
      throw new Error(json.error ?? 'PyOrchestrator недоступен');
    }
    return json as T;
  }

  if (!res.ok || !json.success) {
    if (res.status === 401) {
      throw new Error('Сессия истекла. Обновите страницу или войдите снова.');
    }
    throw new Error(json.error ?? `Ошибка ${res.status}`);
  }
  return json.data as T;
}

export async function checkTelegramBridgeHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/telegram-bots/health');
    if (!res.ok) {
      return { ok: false, error: `Сервис недоступен (HTTP ${res.status})` };
    }
    return (await res.json()) as { ok: boolean; error?: string };
  } catch {
    return { ok: false, error: 'Не удалось связаться с сервисом ботов' };
  }
}

export async function listTelegramBots(): Promise<TelegramBot[]> {
  return bridgeFetch<TelegramBot[]>('/bots');
}

export async function createTelegramBot(input: {
  name: string;
  description?: string;
  token: string;
  adminIds: number[];
  commands: string[];
  start?: boolean;
}): Promise<TelegramBot> {
  return bridgeFetch<TelegramBot>('/bots', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateTelegramBot(
  id: string,
  input: {
    name?: string;
    description?: string;
    token?: string;
    adminIds?: number[];
    commands?: string[];
  }
): Promise<TelegramBot> {
  return bridgeFetch<TelegramBot>(`/bots/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteTelegramBot(id: string): Promise<void> {
  await bridgeFetch<void>(`/bots/${id}`, { method: 'DELETE' });
}

export async function startTelegramBot(id: string): Promise<TelegramBot> {
  return bridgeFetch<TelegramBot>(`/bots/${id}/start`, { method: 'POST' });
}

export async function stopTelegramBot(id: string): Promise<TelegramBot> {
  return bridgeFetch<TelegramBot>(`/bots/${id}/stop`, { method: 'POST' });
}
