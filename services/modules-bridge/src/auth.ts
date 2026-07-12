import fetch from 'node-fetch';
import { pino } from 'pino';

const logger = pino({ level: 'info' });
const API_URL = process.env.CRM_API_URL || 'http://dynamic-api:3001';
const PROFILE_TIMEOUT_MS = 8000;

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

function canManageModules(token: string): boolean {
  const perms = decodeJwtPermissions(token);
  return perms.includes('manage_users') || perms.includes('manage_api');
}

export async function verifyAdmin(
  authHeader: string | undefined
): Promise<{ ok: boolean; status: number }> {
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401 };
  }
  const token = authHeader.slice(7);
  try {
    const res = await fetch(`${API_URL}/api/profile`, {
      headers: { Authorization: authHeader },
      signal: AbortSignal.timeout(PROFILE_TIMEOUT_MS),
    });
    const json = (await res.json()) as { success?: boolean };
    if (!res.ok || json.success !== true) {
      return { ok: false, status: 401 };
    }
    if (!canManageModules(token)) {
      return { ok: false, status: 403 };
    }
    return { ok: true, status: 200 };
  } catch (err) {
    logger.warn({ err }, 'CRM profile check failed');
    return { ok: false, status: 401 };
  }
}
