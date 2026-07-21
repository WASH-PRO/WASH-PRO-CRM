import { fetchWithAuth } from './client';
import { tGlobal } from '../i18n/runtime';

export const WASH_TELEGRAM_COMMAND_GROUPS = [
  {
    label: tGlobal('telegram.commandGroups.helpMonitoring'),
    commands: ['/help', '/start', '/menu', '/status', '/washes', '/wash', '/posts', '/post', '/revenue', '/statistics', '/cards'],
  },
  {
    label: tGlobal('telegram.commandGroups.washes'),
    commands: ['/wash_add', '/wash_edit', '/wash_del'],
  },
  {
    label: tGlobal('telegram.commandGroups.postsDevices'),
    commands: ['/post_add', '/post_edit', '/post_del', '/post_cmd'],
  },
] as const;

export const WASH_TELEGRAM_COMMANDS = WASH_TELEGRAM_COMMAND_GROUPS.flatMap((group) => [
  ...group.commands,
]);

export type TelegramBotType = 'management' | 'service' | 'informational';

export const TELEGRAM_BOT_TYPE_OPTIONS: { value: TelegramBotType; label: string; hint: string }[] = [
  {
    value: 'management',
    label: tGlobal('telegram.botTypes.management'),
    hint: tGlobal('telegram.botTypeHints.management'),
  },
  {
    value: 'service',
    label: tGlobal('telegram.botTypes.service'),
    hint: tGlobal('telegram.botTypeHints.service'),
  },
  {
    value: 'informational',
    label: tGlobal('telegram.botTypes.informational'),
    hint: tGlobal('telegram.botTypeHints.informational'),
  },
];

export const TELEGRAM_BOT_COMMAND_PRESETS: Record<TelegramBotType, string[]> = {
  management: [...WASH_TELEGRAM_COMMANDS],
  service: [
    '/help',
    '/start',
    '/menu',
    '/status',
    '/washes',
    '/wash',
    '/posts',
    '/post',
    '/post_cmd',
    '/revenue',
    '/statistics',
    '/cards',
  ],
  informational: ['/help', '/start', '/menu'],
};

export const TELEGRAM_BOT_TYPE_LABELS: Record<TelegramBotType, string> = {
  management: tGlobal('telegram.botTypes.management'),
  service: tGlobal('telegram.botTypes.service'),
  informational: tGlobal('telegram.botTypes.informational'),
};

export interface TelegramBot {
  id: string;
  name: string;
  description: string;
  script_type: string;
  status: string;
  created_at?: string;
  /** True when TELEGRAM_TOKEN secret is stored in PyOrchestrator (token value never returned). */
  has_token?: boolean;
  metadata: {
    wash_telegram_bot?: boolean;
    admin_ids?: number[];
    allowed_commands?: string[];
    bot_type?: TelegramBotType;
    telegram_username?: string;
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
      throw new Error(json.error ?? tGlobal('telegram.errors.pyorchUnavailable'));
    }
    return json as T;
  }

  if (!res.ok || !json.success) {
    if (res.status === 401) {
      throw new Error(tGlobal('errors.sessionExpired'));
    }
    const raw = json.error ?? tGlobal('errors.requestFailed', { status: res.status });
    if (/fetch failed|ECONNREFUSED|ENOTFOUND|network/i.test(raw)) {
      throw new Error(tGlobal('telegram.errors.serviceTemporarilyUnavailable'));
    }
    throw new Error(raw);
  }
  return json.data as T;
}

export async function checkTelegramBridgeHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/telegram-bots/health');
    if (!res.ok) {
      return { ok: false, error: tGlobal('telegram.errors.serviceUnavailableHttp', { status: res.status }) };
    }
    return (await res.json()) as { ok: boolean; error?: string };
  } catch {
    return { ok: false, error: tGlobal('telegram.errors.cannotConnect') };
  }
}

export async function listTelegramBots(): Promise<TelegramBot[]> {
  return bridgeFetch<TelegramBot[]>('/bots');
}

export async function createTelegramBot(input: {
  name: string;
  description?: string;
  token: string;
  adminIds?: number[];
  commands: string[];
  botType?: TelegramBotType;
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
    botType?: TelegramBotType;
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
  const bot = await bridgeFetch<TelegramBot>(`/bots/${id}/start`, { method: 'POST' });
  if (!bot?.id) throw new Error(tGlobal('telegram.errors.noBotData'));
  return bot;
}

export async function stopTelegramBot(id: string): Promise<TelegramBot> {
  const bot = await bridgeFetch<TelegramBot>(`/bots/${id}/stop`, { method: 'POST' });
  if (!bot?.id) throw new Error(tGlobal('telegram.errors.noBotData'));
  return bot;
}

export interface TelegramBotLink {
  url: string;
  username: string;
  qrUrl: string;
}

export async function getTelegramBotLink(id: string): Promise<TelegramBotLink> {
  return bridgeFetch<TelegramBotLink>(`/bots/${id}/link`);
}
