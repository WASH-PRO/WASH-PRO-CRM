import http from 'node:http';
import { pino } from 'pino';
import { generateBotMain, type WashBotType } from './botTemplate.js';
import { notifyCrm } from './notify.js';

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

async function setSecret(scriptId: string, key: string, value: string): Promise<void> {
  await pyorchFetch(`/scripts/${scriptId}/secrets`, {
    method: 'POST',
    body: JSON.stringify({ key, value, description: '' }),
  });
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function applySecrets(
  scriptId: string,
  input: { token?: string; adminIds: number[]; commands: string[] },
  updateToken: boolean
): Promise<void> {
  if (updateToken && input.token?.trim()) {
    await setSecret(scriptId, 'TELEGRAM_TOKEN', input.token.trim());
  }
  await setSecret(scriptId, 'API_BASE_URL', CRM_API_BASE);
  await setSecret(scriptId, 'PROCESSOR_API_BASE_URL', PROCESSOR_API_BASE);
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
    await waitForBotStopped(script.id, 20000);
  }
}

async function restartWashBot(bot: PyorchScript, commands?: string[], type?: WashBotType): Promise<void> {
  await stopLegacyDuplicateBots();
  await pyorchFetch(`/runs/scripts/${bot.id}/stop`, { method: 'POST' }).catch(() => undefined);
  const stopped = await waitForBotStopped(bot.id);
  if (!stopped) {
    logger.warn({ botId: bot.id, name: bot.name }, 'Bot stop timed out before restart');
  }
  await syncBotCode(bot, commands, type);
  await pyorchFetch(`/scripts/${bot.id}/enable`, { method: 'POST' }).catch(() => undefined);
  await pyorchFetch(`/runs/scripts/${bot.id}/run`, { method: 'POST' });
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
        await waitForBotStopped(botId, 30000);
      }
    }

    for (const bot of bots) {
      const cmds = botCommands(bot);
      const kind = botType(bot);
      const adminIds = (bot.metadata.admin_ids as number[]) ?? [];
      await syncBotCode(bot, cmds, kind);
      if (restartRunning && runningIds.includes(bot.id)) {
        await applySecrets(bot.id, { adminIds, commands: cmds }, false).catch(() => undefined);
        await pyorchFetch(`/scripts/${bot.id}/enable`, { method: 'POST' }).catch(() => undefined);
        await pyorchFetch(`/runs/scripts/${bot.id}/run`, { method: 'POST' });
        logger.info({ botId: bot.id, name: bot.name }, 'Restarted wash telegram bot with fresh template');
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

    const auth = await verifyAdmin(req.headers.authorization);
    if (!auth.ok) {
      json(res, auth.status, { success: false, error: auth.error });
      return;
    }

    try {
      if (req.method === 'GET' && url === '/bots') {
        const bots = await listWashBots();
        json(res, 200, { success: true, data: bots });
        return;
      }

      if (req.method === 'POST' && url === '/bots/refresh') {
        await refreshAllWashBots(true);
        const bots = await listWashBots();
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

        const groupId = await getBotsGroupId();
        const adminIds = body.adminIds ?? [];
        const commands = body.commands ?? [];
        const kind: WashBotType = body.botType ?? 'management';
        const botMeta = {
          wash_telegram_bot: true,
          source: 'wash-pro-crm',
          admin_ids: adminIds,
          allowed_commands: commands,
          bot_type: kind,
        };

        let script: PyorchScript | undefined;
        try {
          script = await pyorchFetch<PyorchScript>('/scripts', {
            method: 'POST',
            body: JSON.stringify({
              name: body.name.trim(),
              description: body.description?.trim() || 'Telegram-бот WASH PRO CRM',
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
              max_runtime_seconds: 86400,
              max_concurrent_runs: 1,
              metadata: botMeta,
            }),
          });

          await applySecrets(
            script.id,
            { token: body.token, adminIds, commands: body.commands ?? [] },
            true
          );
          await pyorchFetch(`/scripts/${script.id}/enable`, { method: 'POST' });

          if (body.start !== false) {
            await stopLegacyDuplicateBots();
            await syncBotCode(script, commands, kind);
            await pyorchFetch(`/runs/scripts/${script.id}/run`, { method: 'POST' });
          }
        } catch (err) {
          if (script?.id) {
            await pyorchFetch(`/runs/scripts/${script.id}/stop`, { method: 'POST' }).catch(() => undefined);
            await pyorchFetch(`/scripts/${script.id}`, { method: 'DELETE' }).catch(() => undefined);
          }
          throw err;
        }

        const bots = await listWashBots();
        const created = bots.find((b) => b.id === script.id) ?? script;
        void notifyCrm('telegram_bot_created', `Создан Telegram-бот: ${created.name}`);
        json(res, 201, { success: true, data: created });
        return;
      }

      const botMatch = url.match(/^\/bots\/([^/]+)(\/start|\/stop)?$/);
      if (botMatch) {
        const botId = botMatch[1]!;

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
          await pyorchFetch(`/scripts/${botId}`, {
            method: 'PUT',
            body: JSON.stringify({
              name: body.name ?? existing.name,
              description: body.description ?? existing.description,
              metadata: {
                ...existing.metadata,
                wash_telegram_bot: true,
                source: 'wash-pro-crm',
                admin_ids: adminIds,
                allowed_commands: commands,
                bot_type: kind,
              },
            }),
          });
          await syncBotCode(existing, commands, kind);
          await applySecrets(
            botId,
            { token: body.token, adminIds, commands },
            Boolean(body.token?.trim())
          );
          const wasRunning = isBotRunning(existing);
          if (wasRunning) {
            await restartWashBot(
              { ...existing, metadata: { ...existing.metadata, allowed_commands: commands, bot_type: kind } },
              commands,
              kind
            );
          }
          const updated = (await getWashBot(botId)) ?? existing;
          json(res, 200, { success: true, data: updated });
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
          const adminIds = (existing.metadata.admin_ids as number[]) ?? [];
          const commands = botCommands(existing);
          const kind = botType(existing);
          await syncBotCode(existing, commands, kind);
          await applySecrets(botId, { adminIds, commands }, false);
          await restartWashBot(existing, commands, kind);
          const updated = (await getWashBot(botId)) ?? existing;
          json(res, 200, { success: true, data: updated });
          return;
        }

        if (req.method === 'POST' && botMatch[2] === '/stop') {
          const existing = await getWashBot(botId);
          if (!existing) {
            json(res, 404, { success: false, error: 'Bot not found' });
            return;
          }
          await pyorchFetch(`/runs/scripts/${botId}/stop`, { method: 'POST' });
          await pyorchFetch(`/scripts/${botId}/disable`, { method: 'POST' });
          const updated = (await getWashBot(botId)) ?? existing;
          json(res, 200, { success: true, data: updated });
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
    void refreshAllWashBots(true);
  });
}

startServer();
