import fetch from 'node-fetch';
import {
  channelsFromSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
  isNotificationTypeEnabled,
  normalizeNotificationSettings,
} from './notification-settings.js';

const API_URL = (process.env.API_URL || 'http://dynamic-api:3001').replace(/\/$/, '');
const SERVICE_LOGIN = process.env.SERVICE_LOGIN || 'service';
const SERVICE_PASSWORD = process.env.SERVICE_PASSWORD || 'ServiceInternal123!';

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getServiceToken(): Promise<string | null> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: SERVICE_LOGIN, password: SERVICE_PASSWORD }),
    });
    const json = (await res.json()) as { success?: boolean; data?: { accessToken: string } };
    if (!json.success || !json.data?.accessToken) return null;
    cachedToken = json.data.accessToken;
    tokenExpiresAt = Date.now() + 14 * 60 * 1000;
    return cachedToken;
  } catch {
    return null;
  }
}

export async function notifyCrm(
  type: string,
  message: string,
  severity: 'info' | 'warning' | 'error' = 'info'
): Promise<void> {
  const token = await getServiceToken();
  if (!token) return;

  let settings = DEFAULT_NOTIFICATION_SETTINGS;
  try {
    const settingsRes = await fetch(`${API_URL}/api/crm/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const settingsJson = (await settingsRes.json()) as {
      success?: boolean;
      data?: Array<{ key: string; value: unknown }>;
    };
    const row = settingsJson.data?.find((s) => s.key === 'notifications');
    if (row) settings = normalizeNotificationSettings(row.value);
  } catch {
    // defaults
  }

  if (!isNotificationTypeEnabled(type, settings)) return;

  const channels = channelsFromSettings(settings);
  if (!channels.length) return;

  await fetch(`${API_URL}/api/crm/notifications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      type,
      severity,
      message,
      read: false,
      channels,
      createdAt: new Date().toISOString(),
    }),
  }).catch(() => undefined);
}
