import http from 'node:http';
import fetch from 'node-fetch';
import { pino } from 'pino';
import {
  checkAllComponents,
  dismissComponentUpdate,
  getUpdatesStatus,
  startUpdate,
} from './jobs.js';
import type { UpdateComponentId } from './types.js';

const logger = pino({ level: 'info' });
const PORT = parseInt(process.env.UPDATE_HTTP_PORT || '3023', 10);
const API_URL = process.env.API_URL || 'http://dynamic-api:3001';

const COMPONENT_IDS = new Set<UpdateComponentId>(['crm', 'dynamic-api', 'pyorchestrator']);

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

function canManageUpdates(token: string): boolean {
  const perms = decodeJwtPermissions(token);
  return perms.includes('manage_users') || perms.includes('manage_api');
}

async function verifyAdmin(authHeader: string | undefined): Promise<{ ok: boolean; status: number }> {
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401 };
  }
  const token = authHeader.slice(7);
  try {
    const res = await fetch(`${API_URL}/api/profile`, {
      headers: { Authorization: authHeader },
    });
    const json = (await res.json()) as { success?: boolean };
    if (!res.ok || json.success !== true) {
      return { ok: false, status: 401 };
    }
    if (!canManageUpdates(token)) {
      return { ok: false, status: 403 };
    }
    return { ok: true, status: 200 };
  } catch (err) {
    logger.warn({ err }, 'CRM profile check failed');
    return { ok: false, status: 401 };
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

export function startUpdateHttpServer(): void {
  const server = http.createServer(async (req, res) => {
    const auth = await verifyAdmin(req.headers.authorization);
    if (!auth.ok) {
      const message = auth.status === 403 ? 'Forbidden' : 'Unauthorized';
      res.writeHead(auth.status, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(message);
      return;
    }

    const url = req.url?.split('?')[0] ?? '';
    const refresh = req.url?.includes('refresh=1') ?? false;

    if (req.method === 'GET' && url === '/status') {
      try {
        const data = await getUpdatesStatus(refresh);
        json(res, 200, { success: true, data });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Status failed';
        json(res, 500, { success: false, error: message });
      }
      return;
    }

    if (req.method === 'POST' && url === '/check') {
      try {
        const components = await checkAllComponents();
        json(res, 200, { success: true, data: { components } });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Check failed';
        json(res, 500, { success: false, error: message });
      }
      return;
    }

    const applyMatch = url.match(/^\/apply\/([^/]+)$/);
    if (req.method === 'POST' && applyMatch) {
      const component = decodeURIComponent(applyMatch[1]!) as UpdateComponentId;
      if (!COMPONENT_IDS.has(component)) {
        json(res, 400, { success: false, error: 'Unknown component' });
        return;
      }
      try {
        const raw = await readBody(req);
        const body = raw ? (JSON.parse(raw) as { targetTag?: string }) : {};
        const job = await startUpdate(component, body.targetTag);
        json(res, 200, { success: true, data: job });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Apply failed';
        json(res, 500, { success: false, error: message });
      }
      return;
    }

    const dismissMatch = url.match(/^\/dismiss\/([^/]+)$/);
    if (req.method === 'POST' && dismissMatch) {
      const component = decodeURIComponent(dismissMatch[1]!) as UpdateComponentId;
      if (!COMPONENT_IDS.has(component)) {
        json(res, 400, { success: false, error: 'Unknown component' });
        return;
      }
      try {
        const raw = await readBody(req);
        const body = JSON.parse(raw) as { version: string };
        await dismissComponentUpdate(component, body.version);
        json(res, 200, { success: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Dismiss failed';
        json(res, 500, { success: false, error: message });
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  });

  server.listen(PORT, () => {
    logger.info({ port: PORT }, 'Update bridge HTTP server started');
  });
}
