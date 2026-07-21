import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import { pino } from 'pino';
import { BOT_COMMAND_PRESETS, DEFAULT_DEMO_BOTS } from './botPresets.js';
import { generateBotMain, type WashBotType } from './botTemplate.js';
import { notifyCrm } from './notify.js';

// Docker/Node often prefer IPv6 AAAA that has no outbound route — Telegram getMe then fails.
dns.setDefaultResultOrder('ipv4first');

const logger = pino({ level: 'info' });

const PORT = parseInt(process.env.PYORCH_BRIDGE_PORT || '3021', 10);
const CRM_API_URL = process.env.CRM_API_URL || 'http://dynamic-api:3001';
const PYORCH_API_URL = (process.env.PYORCH_API_URL || 'http://pyorch-backend:8000').replace(/\/$/, '');
const PYORCH_EMAIL = process.env.PYORCH_EMAIL || 'admin@pyorchestrator.local';
const PYORCH_PASSWORD = process.env.PYORCH_PASSWORD || 'admin';
const SERVICE_LOGIN = process.env.SERVICE_LOGIN || 'service';
const SERVICE_PASSWORD = process.env.SERVICE_PASSWORD || 'ServiceInternal123!';
const CRM_API_BASE = process.env.CRM_API_BASE_URL || 'http://dynamic-api:3001';
const PROCESSOR_API_BASE = process.env.PROCESSOR_API_BASE_URL || 'http://message-processor:3022';
const INTERNAL_API_KEY = process.env.PYORCH_INTERNAL_API_KEY || process.env.INTERNAL_API_KEY || 'internal-dev-key';
const BRIDGE_PUBLIC_URL = (process.env.PYORCH_BRIDGE_URL || 'http://pyorch-bridge:3021').replace(/\/$/, '');
/** Optional host-network egress proxy (http://host.docker.internal:3987) when Docker cannot reach api.telegram.org. */
const TELEGRAM_API_BASE = (process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org').replace(/\/$/, '');
/** PyOrchestrator помечает run остановленным раньше, чем sandbox отпускает polling lock. */
const BOT_STOP_GRACE_MS = 6000;
const BOT_RESTART_STAGGER_MS = 2500;

interface PyorchScript {
  id: string;
  name: string;
  description: string;
  script_type: string;
  status: string;
  entrypoint?: string;
  metadata: Record<string, unknown>;
  created_at?: string;
  active_run?: { id: string; status: string; started_at: string | null; queued_at: string } | null;
}

let pyorchToken: string | null = null;

async function pyorchLogin(): Promise<string> {
  const res = await fetch(`${PYORCH_API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: PYORCH_EMAIL, password: PYORCH_PASSWORD }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PyOrchestrator login failed (${res.status}): ${err}`);
  }
  const data = (await res.json()) as { access_token: string };
  pyorchToken = data.access_token;
  return pyorchToken;
}

async function pyorchFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!pyorchToken) await pyorchLogin();
  const doRequest = async (token: string) =>
    fetch(`${PYORCH_API_URL}/api/v1${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers as Record<string, string>),
      },
    });

  let res = await doRequest(pyorchToken!);
  if (res.status === 401) {
    await pyorchLogin();
    res = await doRequest(pyorchToken!);
  }
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const err = await res.text();
    let detail = err;
    try {
      const parsed = JSON.parse(err) as { detail?: string };
      if (typeof parsed.detail === 'string') detail = parsed.detail;
    } catch {
      /* raw text */
    }
    throw new Error(`PyOrchestrator ${path} (${res.status}): ${detail}`);
  }
  return res.json() as Promise<T>;
}

function isWashBot(script: PyorchScript): boolean {
  const meta = script.metadata ?? {};
  if (meta.wash_telegram_bot === true) return true;
  return meta.source === 'wash-pro-crm' && script.script_type === 'bot';
}

async function listWashBots(): Promise<PyorchScript[]> {
  const scripts = await pyorchFetch<PyorchScript[]>('/scripts');
  return scripts.filter(isWashBot);
}

async function getWashBot(scriptId: string): Promise<PyorchScript | null> {
  try {
    const script = await pyorchFetch<PyorchScript>(`/scripts/${scriptId}`);
    return isWashBot(script) ? script : null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('404') || message.includes('not found')) return null;
    throw err;
  }
}

async function getBotsGroupId(): Promise<string | null> {
  const groups = await pyorchFetch<Array<{ id: string; name: string }>>('/groups');
  return groups.find((g) => g.name === 'bots')?.id ?? null;
}


const TELEGRAM_BOT_TOKEN_RE = /^\d{6,}:[A-Za-z0-9_-]{20,}$/;

function isValidTelegramBotToken(token: string | undefined | null): boolean {
  return TELEGRAM_BOT_TOKEN_RE.test((token ?? '').trim());
}

async function setSecret(scriptId: string, key: string, value: string): Promise<void> {
  await pyorchFetch(`/scripts/${scriptId}/secrets`, {
    method: 'POST',
    body: JSON.stringify({ key, value, description: '' }),
  });
}

async function telegramUpstream(
  token: string,
  method: string,
  options: {
    params?: Record<string, string | number | boolean>;
    json?: Record<string, unknown>;
    timeoutMs?: number;
  } = {}
): Promise<{ status: number; body: unknown }> {
  const trimmed = token.trim();
  if (!isValidTelegramBotToken(trimmed)) {
    return { status: 400, body: { ok: false, description: 'Invalid bot token' } };
  }
  const timeoutMs = options.timeoutMs ?? 35000;
  const qs = options.params
    ? `?${new URLSearchParams(
        Object.entries(options.params).map(([k, v]) => [k, String(v)])
      ).toString()}`
    : '';
  const url = `${TELEGRAM_API_BASE}/bot${trimmed}/${method}${qs}`;
  const useHttp = url.startsWith('http://');

  const viaFetch = async (): Promise<{ status: number; body: unknown }> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: options.json ? 'POST' : 'GET',
        headers: options.json ? { 'Content-Type': 'application/json' } : undefined,
        body: options.json ? JSON.stringify(options.json) : undefined,
        signal: controller.signal,
      });
      const text = await res.text();
      let body: unknown = text;
      try {
        body = JSON.parse(text);
      } catch {
        /* raw */
      }
      return { status: res.status, body };
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const viaDirect = async (): Promise<{ status: number; body: unknown }> =>
    new Promise((resolve, reject) => {
      const payload = options.json ? JSON.stringify(options.json) : undefined;
      const lib = useHttp ? http : https;
      const req = lib.request(
        url,
        {
          method: options.json ? 'POST' : 'GET',
          ...(useHttp ? {} : { family: 4 as const, servername: 'api.telegram.org' }),
          timeout: timeoutMs,
          headers: payload
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
            : undefined,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            let body: unknown = text;
            try {
              body = JSON.parse(text);
            } catch {
              /* raw */
            }
            resolve({ status: res.statusCode ?? 502, body });
          });
        }
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Telegram upstream timeout'));
      });
      if (payload) req.write(payload);
      req.end();
    });

  // Prefer direct socket (IPv4 for real Telegram; plain HTTP for host egress proxy).
  try {
    return await viaDirect();
  } catch (err) {
    logger.warn({ err, method, base: TELEGRAM_API_BASE }, 'Telegram direct upstream failed, trying fetch');
    return await viaFetch();
  }
}

async function fetchTelegramBotUsername(token: string): Promise<string | null> {
  try {
    const { status, body } = await telegramUpstream(token, 'getMe', { timeoutMs: 15000 });
    if (status >= 400) return null;
    const data = body as { ok?: boolean; result?: { username?: string } };
    if (!data?.ok) return null;
    return data.result?.username?.trim() || null;
  } catch (err) {
    logger.warn({ err }, 'Telegram getMe failed');
    return null;
  }
}

async function resolveTelegramUsername(token?: string): Promise<string | null> {
  if (!token?.trim()) return null;
  try {
    return await fetchTelegramBotUsername(token);
  } catch {
    return null;
  }
}

function botTelegramUrl(script: PyorchScript, username?: string | null): string | null {
  const fromArg = username?.trim().replace(/^@/, '');
  const fromMeta = script.metadata?.telegram_username;
  const resolved =
    fromArg ||
    (typeof fromMeta === 'string' ? fromMeta.trim().replace(/^@/, '') : '');
  if (!resolved) return null;
  return `https://t.me/${resolved}`;
}

async function getBotTelegramToken(scriptId: string): Promise<string | null> {
  try {
    const data = await pyorchFetch<{ key: string; value: string }>(
      `/scripts/${scriptId}/secrets/TELEGRAM_TOKEN/value`
    );
    return data.value?.trim() || null;
  } catch {
    return null;
  }
}

type BotWithTokenFlag = PyorchScript & { has_token: boolean };

async function withTokenFlag(bot: PyorchScript): Promise<BotWithTokenFlag> {
  const token = await getBotTelegramToken(bot.id);
  return { ...bot, has_token: isValidTelegramBotToken(token) };
}

async function withTokenFlags(bots: PyorchScript[]): Promise<BotWithTokenFlag[]> {
  return Promise.all(bots.map(withTokenFlag));
}

async function persistBotUsername(bot: PyorchScript, username: string): Promise<PyorchScript> {
  const normalized = username.trim().replace(/^@/, '');
  if (!normalized) return bot;
  const metadata = {
    ...bot.metadata,
    telegram_username: normalized,
  };
  await pyorchFetch(`/scripts/${bot.id}`, {
    method: 'PUT',
    body: JSON.stringify({ metadata }),
  });
  return { ...bot, metadata };
}

async function ensureBotTelegramUsername(bot: PyorchScript): Promise<string | null> {
  const cached = bot.metadata?.telegram_username;
  if (typeof cached === 'string' && cached.trim()) {
    return cached.trim().replace(/^@/, '');
  }
  const token = await getBotTelegramToken(bot.id);
  if (!token) return null;
  const username = await fetchTelegramBotUsername(token);
  if (!username) return null;
  await persistBotUsername(bot, username);
  return username;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function applySecrets(
  scriptId: string,
  input: { token?: string; adminIds: number[]; commands: string[] },
  updateToken: boolean,
  kind: WashBotType = 'management'
): Promise<void> {
  if (updateToken && input.token?.trim()) {
    const token = input.token.trim();
    if (!isValidTelegramBotToken(token)) {
      throw new Error(
        'Invalid Telegram bot token. Expected format 123456789:AA… from @BotFather (not an error message).'
      );
    }
    await setSecret(scriptId, 'TELEGRAM_TOKEN', token);
  }
  await setSecret(scriptId, 'API_BASE_URL', CRM_API_BASE);
  await setSecret(scriptId, 'PROCESSOR_API_BASE_URL', PROCESSOR_API_BASE);
  await setSecret(scriptId, 'PYORCH_BRIDGE_URL', BRIDGE_PUBLIC_URL);
  await setSecret(scriptId, 'BRIDGE_INTERNAL_KEY', INTERNAL_API_KEY);
  if (kind === 'informational') {
    await setSecret(scriptId, 'API_LOGIN', SERVICE_LOGIN);
    await setSecret(scriptId, 'API_PASSWORD', SERVICE_PASSWORD);
    await setSecret(scriptId, 'ADMIN_IDS', '');
    await setSecret(scriptId, 'ALLOWED_COMMANDS', '/help,/start,/menu');
    return;
  }
  await setSecret(scriptId, 'API_LOGIN', SERVICE_LOGIN);
  await setSecret(scriptId, 'API_PASSWORD', SERVICE_PASSWORD);
  await setSecret(scriptId, 'ADMIN_IDS', input.adminIds.join(','));
  await setSecret(scriptId, 'ALLOWED_COMMANDS', input.commands.join(','));
}

function botCommands(script: PyorchScript): string[] {
  const raw = script.metadata?.allowed_commands;
  return Array.isArray(raw) ? (raw as string[]) : [];
}

function botType(script: PyorchScript): WashBotType {
  const raw = script.metadata?.bot_type;
  if (raw === 'informational' || raw === 'service' || raw === 'management') return raw;
  return 'management';
}

/** Подтягиваем актуальный шаблон main.py с командами из metadata CRM. */
async function syncBotCode(script: PyorchScript, commands?: string[], type?: WashBotType): Promise<void> {
  const cmds = commands ?? botCommands(script);
  const kind = type ?? botType(script);
  const entrypoint = script.entrypoint || 'main.py';
  const content = generateBotMain(cmds, kind);
  await pyorchFetch(`/scripts/${script.id}/files/${entrypoint}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });
  logger.info({ botId: script.id, commands: cmds.length, botType: kind }, 'Synced telegram bot template');
}

function isBotRunning(bot: PyorchScript): boolean {
  return bot.active_run?.status === 'running' || bot.active_run?.status === 'queued';
}

async function waitForBotStopped(botId: string, timeoutMs = 30000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const bot = await getWashBot(botId);
    if (!bot || !isBotRunning(bot)) return true;
    await sleep(1000);
  }
  return false;
}

async function waitForBotFullyStopped(botId: string, timeoutMs = 45000): Promise<boolean> {
  const stopped = await waitForBotStopped(botId, timeoutMs);
  if (!stopped) return false;
  await sleep(BOT_STOP_GRACE_MS);
  const bot = await getWashBot(botId);
  return !bot || !isBotRunning(bot);
}

async function clearTelegramWebhook(token: string): Promise<void> {
  const trimmed = token.trim();
  if (!trimmed) return;
  try {
    // Must go through TELEGRAM_API_BASE (host egress). Direct fetch hangs when Docker has no Telegram route.
    await telegramUpstream(trimmed, 'deleteWebhook', {
      params: { drop_pending_updates: false },
      timeoutMs: 5000,
    });
  } catch (err) {
    logger.warn({ err }, 'Telegram deleteWebhook failed');
  }
}

async function stopBotsWithToken(token: string, exceptBotId?: string): Promise<void> {
  const normalized = token.trim();
  if (!normalized) return;
  const bots = await listWashBots();
  for (const bot of bots) {
    if (exceptBotId && bot.id === exceptBotId) continue;
    const botToken = await getBotTelegramToken(bot.id);
    if (botToken?.trim() !== normalized || !isBotRunning(bot)) continue;
    logger.warn({ botId: bot.id, name: bot.name }, 'Stopping duplicate-token telegram bot');
    await pyorchFetch(`/runs/scripts/${bot.id}/stop`, { method: 'POST' }).catch(() => undefined);
    await waitForBotFullyStopped(bot.id, 30000);
  }
}

async function startWashBotRun(bot: PyorchScript, token?: string | null): Promise<void> {
  const resolvedToken = token ?? (await getBotTelegramToken(bot.id));
  if (resolvedToken?.trim()) {
    await stopBotsWithToken(resolvedToken, bot.id);
    await clearTelegramWebhook(resolvedToken);
  }
  // Legacy bots had 86400s / 3600s caps — force unlimited on every start.
  await pyorchFetch(`/scripts/${bot.id}`, {
    method: 'PUT',
    body: JSON.stringify({ max_runtime_seconds: 0 }),
  }).catch(() => undefined);
  await pyorchFetch(`/scripts/${bot.id}/enable`, { method: 'POST' }).catch(() => undefined);
  await pyorchFetch(`/runs/scripts/${bot.id}/run`, { method: 'POST' });
}

function isLegacyWashTelegramBot(script: PyorchScript): boolean {
  if (isWashBot(script) || script.script_type !== 'bot') return false;
  const name = (script.name || '').toLowerCase();
  const desc = (script.description || '').toLowerCase();
  return (
    (name.includes('wash pro crm') && name.includes('telegram')) ||
    (desc.includes('wash pro crm') && desc.includes('telegram'))
  );
}

/** Останавливает старые боты из шаблона PyOrchestrator (без metadata wash_telegram_bot). */
async function stopLegacyDuplicateBots(): Promise<void> {
  const scripts = await pyorchFetch<PyorchScript[]>('/scripts');
  for (const script of scripts) {
    if (!isLegacyWashTelegramBot(script) || !isBotRunning(script)) continue;
    logger.warn(
      { scriptId: script.id, name: script.name },
      'Stopping legacy duplicate CRM telegram bot'
    );
    await pyorchFetch(`/runs/scripts/${script.id}/stop`, { method: 'POST' }).catch(() => undefined);
    await waitForBotFullyStopped(script.id, 20000);
  }
}

async function stopWashBot(bot: PyorchScript): Promise<PyorchScript> {
  const token = await getBotTelegramToken(bot.id);
  await pyorchFetch(`/runs/scripts/${bot.id}/stop`, { method: 'POST' }).catch(() => undefined);
  await waitForBotFullyStopped(bot.id);
  if (token?.trim()) await clearTelegramWebhook(token);
  await pyorchFetch(`/scripts/${bot.id}/disable`, { method: 'POST' }).catch(() => undefined);
  return (await getWashBot(bot.id)) ?? bot;
}

async function stopAllWashBots(): Promise<PyorchScript[]> {
  const bots = await listWashBots();
  const stopped: PyorchScript[] = [];
  for (const bot of bots) {
    if (!isBotRunning(bot) && bot.status !== 'enabled') continue;
    stopped.push(await stopWashBot(bot));
    await sleep(500);
  }
  return stopped;
}

async function restartWashBot(bot: PyorchScript, commands?: string[], type?: WashBotType): Promise<void> {
  await stopLegacyDuplicateBots();
  const token = await getBotTelegramToken(bot.id);
  await stopWashBot(bot);
  await syncBotCode(bot, commands, type);
  await startWashBotRun(bot, token);
}

interface CreateWashBotInput {
  name: string;
  description?: string;
  token?: string;
  adminIds?: number[];
  commands?: string[];
  botType?: WashBotType;
  start?: boolean;
  demo?: boolean;
}

async function createWashBot(input: CreateWashBotInput): Promise<PyorchScript> {
  const kind: WashBotType = input.botType ?? 'management';
  const adminIds = input.adminIds ?? [];
  const commands = input.commands ?? [...BOT_COMMAND_PRESETS[kind]];
  const token = input.token?.trim() ?? '';
  const isDemo = input.demo === true;

  if (!isDemo && !token) {
    throw new Error('token required');
  }
  if (token && !isValidTelegramBotToken(token)) {
    throw new Error(
      'Invalid Telegram bot token. Paste the token from @BotFather (123456789:AA…), not an error text.'
    );
  }

  const groupId = await getBotsGroupId();
  const telegramUsername = token ? await resolveTelegramUsername(token) : null;
  const botMeta = {
    wash_telegram_bot: true,
    source: 'wash-pro-crm',
    admin_ids: kind === 'informational' ? [] : adminIds,
    allowed_commands: commands,
    bot_type: kind,
    public_access: kind === 'informational',
    ...(isDemo ? { demo_bot: true } : {}),
    ...(telegramUsername ? { telegram_username: telegramUsername } : {}),
  };

  let script: PyorchScript | undefined;
  try {
    script = await pyorchFetch<PyorchScript>('/scripts', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name.trim(),
        description: input.description?.trim() || 'Telegram-бот WASH PRO CRM',
        group_id: groupId,
        script_type: 'bot',
        entrypoint: 'main.py',
        code: generateBotMain(commands, kind),
        metadata: botMeta,
      }),
    });

    await pyorchFetch(`/scripts/${script.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        // 0 = unlimited (bots must not die after 24h / 1h defaults)
        max_runtime_seconds: 0,
        max_concurrent_runs: 1,
        metadata: botMeta,
      }),
    });

    await applySecrets(
      script.id,
      { token: token || undefined, adminIds, commands },
      Boolean(token),
      kind
    );
    await syncBotCode(script, commands, kind);

    if (input.start === true) {
      await stopLegacyDuplicateBots();
      await startWashBotRun(script, token || null);
    } else {
      await pyorchFetch(`/scripts/${script.id}/disable`, { method: 'POST' }).catch(() => undefined);
    }
  } catch (err) {
    if (script?.id) {
      await pyorchFetch(`/runs/scripts/${script.id}/stop`, { method: 'POST' }).catch(() => undefined);
      await pyorchFetch(`/scripts/${script.id}`, { method: 'DELETE' }).catch(() => undefined);
    }
    throw err;
  }

  const bots = await listWashBots();
  return bots.find((b) => b.id === script!.id) ?? script!;
}

async function ensureDefaultDemoBots(): Promise<void> {
  try {
    await pyorchLogin();
    const bots = await listWashBots();
    if (bots.some((bot) => bot.metadata?.demo_bot === true)) {
      logger.info('Default demo telegram bots already seeded');
      return;
    }
    if (bots.length > 0) {
      logger.info('Default demo telegram bots skipped: custom bots already exist');
      return;
    }

    for (const def of DEFAULT_DEMO_BOTS) {
      logger.info({ botType: def.botType, name: def.name }, 'Creating default demo telegram bot');
      await createWashBot({
        name: def.name,
        commands: def.commands,
        botType: def.botType,
        start: false,
        demo: true,
      });
    }
  } catch (err) {
    logger.warn({ err }, 'Default demo telegram bots seed failed');
  }
}

async function refreshAllWashBots(restartRunning: boolean): Promise<void> {
  try {
    await pyorchLogin();
    await stopLegacyDuplicateBots();
    const bots = await listWashBots();
    const runningIds = bots.filter(isBotRunning).map((b) => b.id);

    if (restartRunning && runningIds.length > 0) {
      for (const bot of bots) {
        if (!isBotRunning(bot)) continue;
        await pyorchFetch(`/runs/scripts/${bot.id}/stop`, { method: 'POST' }).catch(() => undefined);
      }
      for (const botId of runningIds) {
        await waitForBotFullyStopped(botId, 45000);
      }
      await sleep(BOT_STOP_GRACE_MS);
    }

    for (const bot of bots) {
      const cmds = botCommands(bot);
      const kind = botType(bot);
      const adminIds = (bot.metadata.admin_ids as number[]) ?? [];
      await syncBotCode(bot, cmds, kind);
      await applySecrets(bot.id, { adminIds, commands: cmds }, false, kind).catch(() => undefined);
      if (restartRunning && runningIds.includes(bot.id)) {
        await startWashBotRun(bot);
        logger.info({ botId: bot.id, name: bot.name }, 'Restarted wash telegram bot with fresh template');
        await sleep(BOT_RESTART_STAGGER_MS);
      } else {
        logger.info({ botId: bot.id, name: bot.name }, 'Synced wash telegram bot template');
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Wash telegram bot template refresh failed');
  }
}

function decodeJwtPermissions(token: string): string[] {
  try {
    const part = token.split('.')[1];
    if (!part) return [];
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as {
      permissions?: string[];
    };
    return payload.permissions ?? [];
  } catch {
    return [];
  }
}

function isAdminToken(token: string): boolean {
  const perms = decodeJwtPermissions(token);
  return perms.includes('manage_users') || perms.includes('view_logs');
}

async function verifyAdmin(authHeader: string | undefined): Promise<{ ok: boolean; status: number; error: string }> {
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  const token = authHeader.slice(7);
  try {
    const res = await fetch(`${CRM_API_URL}/api/profile`, {
      headers: { Authorization: authHeader },
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, 'CRM profile rejected token');
      return { ok: false, status: 401, error: 'Unauthorized' };
    }
    const json = (await res.json()) as { success?: boolean };
    if (json.success !== true) {
      return { ok: false, status: 401, error: 'Unauthorized' };
    }
    if (!isAdminToken(token)) {
      return { ok: false, status: 403, error: 'Forbidden: admin access required' };
    }
    return { ok: true, status: 200, error: '' };
  } catch (err) {
    logger.warn({ err }, 'CRM profile check failed');
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

/** nginx с переменной в proxy_pass может передать полный URI — нормализуем */
function routePath(rawUrl: string): string {
  const path = rawUrl.split('?')[0] ?? '/';
  const prefix = '/api/telegram-bots';
  if (path === prefix || path === `${prefix}/`) return '/';
  if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length);
  return path;
}

async function checkPyorchHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${PYORCH_API_URL}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return { ok: false, error: `health ${res.status}` };
    await pyorchLogin();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unreachable' };
  }
}

export function startServer(): void {
  const server = http.createServer(async (req, res) => {
    const url = routePath(req.url ?? '/');

    if (req.method === 'GET' && url === '/health') {
      const health = await checkPyorchHealth();
      json(res, health.ok ? 200 : 503, health);
      return;
    }

    const internalUsernameMatch = url.match(/^\/internal\/bots\/([^/]+)\/username$/);
    if (req.method === 'POST' && internalUsernameMatch) {
      const internalKey = req.headers['x-internal-key'];
      if (internalKey !== INTERNAL_API_KEY) {
        json(res, 401, { success: false, error: 'Unauthorized' });
        return;
      }
      try {
        const body = JSON.parse(await readBody(req)) as { username?: string };
        const username = body.username?.trim().replace(/^@/, '');
        if (!username) {
          json(res, 400, { success: false, error: 'username required' });
          return;
        }
        const botId = internalUsernameMatch[1]!;
        const bot = await getWashBot(botId);
        if (!bot) {
          json(res, 404, { success: false, error: 'Bot not found' });
          return;
        }
        await persistBotUsername(bot, username);
        json(res, 200, { success: true });
      } catch (err) {
        logger.error({ err, url }, 'Internal username registration failed');
        const message = err instanceof Error ? err.message : 'Internal error';
        json(res, 500, { success: false, error: message });
      }
      return;
    }

    if (req.method === 'POST' && url === '/internal/telegram/call') {
      const internalKey = req.headers['x-internal-key'];
      if (internalKey !== INTERNAL_API_KEY) {
        json(res, 401, { success: false, error: 'Unauthorized' });
        return;
      }
      try {
        const body = JSON.parse(await readBody(req)) as {
          token?: string;
          method?: string;
          params?: Record<string, string | number | boolean>;
          json?: Record<string, unknown>;
          timeoutSec?: number;
        };
        const method = body.method?.trim();
        if (!body.token?.trim() || !method || !/^[A-Za-z0-9_]+$/.test(method)) {
          json(res, 400, { success: false, error: 'token and method required' });
          return;
        }
        const timeoutSec = Math.min(Math.max(Number(body.timeoutSec) || 35, 5), 90);
        const upstream = await telegramUpstream(body.token, method, {
          params: body.params,
          json: body.json,
          timeoutMs: timeoutSec * 1000,
        });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(upstream.body));
      } catch (err) {
        logger.error({ err }, 'Internal telegram proxy failed');
        const message = err instanceof Error ? err.message : 'Internal error';
        json(res, 502, { ok: false, description: message });
      }
      return;
    }

    const auth = await verifyAdmin(req.headers.authorization);
    if (!auth.ok) {
      json(res, auth.status, { success: false, error: auth.error });
      return;
    }

    try {
      if (req.method === 'GET' && url === '/bots') {
        const bots = await withTokenFlags(await listWashBots());
        json(res, 200, { success: true, data: bots });
        return;
      }

      if (req.method === 'POST' && url === '/bots/stop-all') {
        const bots = await withTokenFlags(await stopAllWashBots());
        json(res, 200, { success: true, data: bots });
        return;
      }

      if (req.method === 'POST' && url === '/bots/refresh') {
        await refreshAllWashBots(true);
        const bots = await withTokenFlags(await listWashBots());
        json(res, 200, { success: true, data: bots });
        return;
      }

      if (req.method === 'POST' && url === '/bots') {
        const body = JSON.parse(await readBody(req)) as {
          name?: string;
          description?: string;
          token?: string;
          adminIds?: number[];
          commands?: string[];
          botType?: WashBotType;
          start?: boolean;
        };
        if (!body.name?.trim()) {
          json(res, 400, { success: false, error: 'name required' });
          return;
        }
        if (!body.token?.trim()) {
          json(res, 400, { success: false, error: 'token required' });
          return;
        }
        if (!isValidTelegramBotToken(body.token)) {
          json(res, 400, {
            success: false,
            error:
              'Invalid Telegram bot token. Paste the token from @BotFather (123456789:AA…), not an error text.',
          });
          return;
        }

        const kind: WashBotType = body.botType ?? 'management';
        const created = await createWashBot({
          name: body.name.trim(),
          description: body.description,
          token: body.token,
          adminIds: body.adminIds ?? [],
          commands: body.commands ?? [...BOT_COMMAND_PRESETS[kind]],
          botType: kind,
          start: body.start !== false,
        });
        void notifyCrm('telegram_bot_created', `Создан Telegram-бот: ${created.name}`);
        json(res, 201, { success: true, data: await withTokenFlag(created) });
        return;
      }

      const botMatch = url.match(/^\/bots\/([^/]+)(\/start|\/stop|\/link)?$/);
      if (botMatch) {
        const botId = botMatch[1]!;

        if (req.method === 'GET' && botMatch[2] === '/link') {
          let existing = await getWashBot(botId);
          if (!existing) {
            json(res, 404, { success: false, error: 'Bot not found' });
            return;
          }
          let username = await ensureBotTelegramUsername(existing);
          if (!username) {
            existing = (await getWashBot(botId)) ?? existing;
            username = await ensureBotTelegramUsername(existing);
          }
          const link = botTelegramUrl(existing, username);
          if (!link) {
            const token = await getBotTelegramToken(botId);
            let error =
              'Ссылка на бота недоступна. Запустите бота (он зарегистрирует username) или сохраните токен в настройках.';
            if (!token) {
              error =
                'Токен бота не задан. Откройте «Настройки бота» и вставьте токен от @BotFather (формат 123456789:AA…).';
            } else if (!isValidTelegramBotToken(token)) {
              error =
                'В настройках сохранён не токен BotFather, а другой текст. Откройте «Настройки бота» и вставьте настоящий токен (123456789:AA…).';
            } else {
              error =
                'Не удалось получить @username бота через Telegram API. Проверьте токен в @BotFather и доступ сервера к api.telegram.org, затем сохраните токен снова и перезапустите бота.';
            }
            json(res, 404, {
              success: false,
              error,
            });
            return;
          }
          json(res, 200, {
            success: true,
            data: {
              url: link,
              username: username || String(existing.metadata.telegram_username || '').replace(/^@/, ''),
              qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(link)}`,
            },
          });
          return;
        }

        if (req.method === 'PUT') {
          const body = JSON.parse(await readBody(req)) as {
            name?: string;
            description?: string;
            token?: string;
            adminIds?: number[];
            commands?: string[];
            botType?: WashBotType;
          };
          const existing = await getWashBot(botId);
          if (!existing) {
            json(res, 404, { success: false, error: 'Bot not found' });
            return;
          }
          const adminIds = body.adminIds ?? (existing.metadata.admin_ids as number[]) ?? [];
          const commands = body.commands ?? (existing.metadata.allowed_commands as string[]) ?? [];
          const kind: WashBotType =
            body.botType ??
            (existing.metadata.bot_type as WashBotType | undefined) ??
            'management';
          const tokenToSave = body.token?.trim() || '';
          const updateToken = Boolean(tokenToSave);

          // Token must be persisted before code sync — sync failures previously skipped secrets.
          await applySecrets(
            botId,
            { token: tokenToSave || undefined, adminIds, commands },
            updateToken,
            kind
          );
          if (updateToken) {
            const stored = await getBotTelegramToken(botId);
            if (stored !== tokenToSave) {
              throw new Error('Failed to persist TELEGRAM_TOKEN in PyOrchestrator');
            }
          }

          const telegramUsername = tokenToSave
            ? await resolveTelegramUsername(tokenToSave)
            : await ensureBotTelegramUsername(existing);
          await pyorchFetch(`/scripts/${botId}`, {
            method: 'PUT',
            body: JSON.stringify({
              name: body.name ?? existing.name,
              description: body.description ?? existing.description,
              metadata: {
                ...existing.metadata,
                wash_telegram_bot: true,
                source: 'wash-pro-crm',
                admin_ids: kind === 'informational' ? [] : adminIds,
                allowed_commands: commands,
                bot_type: kind,
                public_access: kind === 'informational',
                ...(telegramUsername ? { telegram_username: telegramUsername } : {}),
              },
            }),
          });
          await syncBotCode(existing, commands, kind);
          const wasRunning = isBotRunning(existing);
          if (wasRunning) {
            await restartWashBot(
              { ...existing, metadata: { ...existing.metadata, allowed_commands: commands, bot_type: kind } },
              commands,
              kind
            );
          }
          const updated = (await getWashBot(botId)) ?? existing;
          json(res, 200, { success: true, data: await withTokenFlag(updated) });
          return;
        }

        if (req.method === 'DELETE') {
          await pyorchFetch(`/runs/scripts/${botId}/stop`, { method: 'POST' }).catch(() => undefined);
          try {
            await pyorchFetch(`/scripts/${botId}`, { method: 'DELETE' });
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Delete failed';
            if (!message.includes('404')) throw err;
          }
          json(res, 200, { success: true });
          return;
        }

        if (req.method === 'POST' && botMatch[2] === '/start') {
          const existing = await getWashBot(botId);
          if (!existing) {
            json(res, 404, { success: false, error: 'Bot not found' });
            return;
          }
          const token = await getBotTelegramToken(botId);
          if (!isValidTelegramBotToken(token)) {
            json(res, 400, {
              success: false,
              error: !token
                ? 'Токен бота не задан. Откройте «Настройки бота», вставьте токен от @BotFather и сохраните.'
                : 'В настройках сохранён неверный токен. Вставьте токен от @BotFather (123456789:AA…), не текст ошибки.',
            });
            return;
          }
          const adminIds = (existing.metadata.admin_ids as number[]) ?? [];
          const commands = botCommands(existing);
          const kind = botType(existing);
          await syncBotCode(existing, commands, kind);
          await applySecrets(botId, { adminIds, commands }, false, kind);
          await restartWashBot(existing, commands, kind);
          const updated = (await getWashBot(botId)) ?? existing;
          json(res, 200, { success: true, data: await withTokenFlag(updated) });
          return;
        }

        if (req.method === 'POST' && botMatch[2] === '/stop') {
          const existing = await getWashBot(botId);
          if (!existing) {
            json(res, 404, { success: false, error: 'Bot not found' });
            return;
          }
          const updated = await stopWashBot(existing);
          json(res, 200, { success: true, data: await withTokenFlag(updated) });
          return;
        }
      }

      json(res, 404, { success: false, error: 'Not found' });
    } catch (err) {
      logger.error({ err, url, method: req.method }, 'Bridge error');
      const message = err instanceof Error ? err.message : 'Internal error';
      if (req.method === 'POST' && url === '/bots') {
        void notifyCrm('telegram_bot_error', `Ошибка создания Telegram-бота: ${message}`, 'error');
      }
      const status = message.includes('login failed') || message.includes('unreachable') ? 503 : 500;
      json(res, status, { success: false, error: message });
    }
  });

  server.listen(PORT, () => {
    logger.info({ port: PORT }, 'pyorch-bridge listening');
    void (async () => {
      await ensureDefaultDemoBots();
      await refreshAllWashBots(false);
    })();
  });
}

startServer();
