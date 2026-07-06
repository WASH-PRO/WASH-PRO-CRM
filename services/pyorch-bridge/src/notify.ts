import fetch from 'node-fetch';
import {
  channelsFromSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
  isNotificationTypeEnabled,
  normalizeNotificationSettings,
} from './notification-settings.js';

const API_URL = process.env.CRM_API_URL || 'http://dynamic-api:3001';
const SERVICE_LOGIN = process.env.SERVICE_LOGIN || 'service';
const SERVICE_PASSWORD = process.env.SERVICE_PASSWORD || 'ServiceInternal123!';

let cachedToken: string | null = null;

async function getServiceToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: SERVICE_LOGIN, password: SERVICE_PASSWORD }),
  });
  const json = (await res.json()) as { success: boolean; data?: { accessToken: string } };
  if (!json.success || !json.data?.accessToken) throw new Error('Service login failed');
  cachedToken = json.data.accessToken;
  return cachedToken;
}

export async function notifyCrm(
  type: string,
  message: string,
  severity: 'info' | 'warning' | 'error' = 'info'
): Promise<void> {
  try {
    const token = await getServiceToken();
    let settings = DEFAULT_NOTIFICATION_SETTINGS;
    const settingsRes = await fetch(`${API_URL}/api/crm/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const settingsJson = (await settingsRes.json()) as {
      success: boolean;
      data?: Array<{ key: string; value: unknown }>;
    };
    const row = settingsJson.data?.find((s) => s.key === 'notifications');
    if (row) settings = normalizeNotificationSettings(row.value);
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
    });
  } catch {
    // best effort
  }
}
