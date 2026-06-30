import http from 'node:http';
import { pino } from 'pino';
import { WASH_TELEGRAM_BOT_MAIN } from './botTemplate.js';

const logger = pino({ level: 'info' });

const PORT = parseInt(process.env.PYORCH_BRIDGE_PORT || '3021', 10);
const CRM_API_URL = process.env.CRM_API_URL || 'http://dynamic-api:3001';
const PYORCH_API_URL = (process.env.PYORCH_API_URL || 'http://pyorch-backend:8000').replace(/\/$/, '');
const PYORCH_EMAIL = process.env.PYORCH_EMAIL || 'admin@pyorchestrator.local';
const PYORCH_PASSWORD = process.env.PYORCH_PASSWORD || 'admin';
const SERVICE_LOGIN = process.env.SERVICE_LOGIN || 'service';
const SERVICE_PASSWORD = process.env.SERVICE_PASSWORD || 'ServiceInternal123!';
const CRM_API_BASE = process.env.CRM_API_BASE_URL || 'http://dynamic-api:3001';

interface PyorchScript {
  id: string;
  name: string;
  description: string;
  script_type: string;
  status: string;
  metadata: Record<string, unknown>;
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
  return script.metadata?.wash_telegram_bot === true;
}

async function listWashBots(): Promise<PyorchScript[]> {
  const scripts = await pyorchFetch<PyorchScript[]>('/scripts');
  return scripts.filter(isWashBot);
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

async function applySecrets(
  scriptId: string,
  input: { token?: string; adminIds: number[]; commands: string[] },
  updateToken: boolean
): Promise<void> {
  if (updateToken && input.token?.trim()) {
    await setSecret(scriptId, 'TELEGRAM_TOKEN', input.token.trim());
  }
  await setSecret(scriptId, 'API_BASE_URL', CRM_API_BASE);
  await setSecret(scriptId, 'API_LOGIN', SERVICE_LOGIN);
  await setSecret(scriptId, 'API_PASSWORD', SERVICE_PASSWORD);
  await setSecret(scriptId, 'ADMIN_IDS', input.adminIds.join(','));
  await setSecret(scriptId, 'ALLOWED_COMMANDS', input.commands.join(','));
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

      if (req.method === 'POST' && url === '/bots') {
        const body = JSON.parse(await readBody(req)) as {
          name?: string;
          description?: string;
          token?: string;
          adminIds?: number[];
          commands?: string[];
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
        if (!body.adminIds?.length) {
          json(res, 400, { success: false, error: 'adminIds required' });
          return;
        }

        const groupId = await getBotsGroupId();
        const botMeta = {
          wash_telegram_bot: true,
          source: 'wash-pro-crm',
          admin_ids: body.adminIds,
          allowed_commands: body.commands ?? [],
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
              code: WASH_TELEGRAM_BOT_MAIN,
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
            { token: body.token, adminIds: body.adminIds, commands: body.commands ?? [] },
            true
          );
          await pyorchFetch(`/scripts/${script.id}/enable`, { method: 'POST' });

          if (body.start !== false) {
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
          };
          const existing = (await listWashBots()).find((b) => b.id === botId);
          if (!existing) {
            json(res, 404, { success: false, error: 'Bot not found' });
            return;
          }
          const adminIds = body.adminIds ?? (existing.metadata.admin_ids as number[]) ?? [];
          const commands = body.commands ?? (existing.metadata.allowed_commands as string[]) ?? [];
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
              },
            }),
          });
          await applySecrets(
            botId,
            { token: body.token, adminIds, commands },
            Boolean(body.token?.trim())
          );
          const updated = (await listWashBots()).find((b) => b.id === botId);
          json(res, 200, { success: true, data: updated });
          return;
        }

        if (req.method === 'DELETE') {
          await pyorchFetch(`/runs/scripts/${botId}/stop`, { method: 'POST' }).catch(() => undefined);
          await pyorchFetch(`/scripts/${botId}`, { method: 'DELETE' });
          json(res, 200, { success: true });
          return;
        }

        if (req.method === 'POST' && botMatch[2] === '/start') {
          await pyorchFetch(`/scripts/${botId}/enable`, { method: 'POST' });
          await pyorchFetch(`/runs/scripts/${botId}/run`, { method: 'POST' });
          const updated = (await listWashBots()).find((b) => b.id === botId);
          json(res, 200, { success: true, data: updated });
          return;
        }

        if (req.method === 'POST' && botMatch[2] === '/stop') {
          await pyorchFetch(`/runs/scripts/${botId}/stop`, { method: 'POST' });
          await pyorchFetch(`/scripts/${botId}/disable`, { method: 'POST' });
          const updated = (await listWashBots()).find((b) => b.id === botId);
          json(res, 200, { success: true, data: updated });
          return;
        }
      }

      json(res, 404, { success: false, error: 'Not found' });
    } catch (err) {
      logger.error({ err, url, method: req.method }, 'Bridge error');
      const message = err instanceof Error ? err.message : 'Internal error';
      const status = message.includes('login failed') || message.includes('unreachable') ? 503 : 500;
      json(res, status, { success: false, error: message });
    }
  });

  server.listen(PORT, () => logger.info({ port: PORT }, 'pyorch-bridge listening'));
}

startServer();
