import { fetchWithAuth } from './client';
import type { DeviceCommandKey } from '../utils/postDevice';
import { tGlobal } from '../i18n/runtime';

async function parseJson<T>(res: Response): Promise<T> {
  const json = (await res.json()) as { success?: boolean; error?: string; data?: T };
  if (!res.ok || json.success === false) {
    throw new Error(json.error || res.statusText || tGlobal('errors.requestFailed', { status: res.status }));
  }
  return json.data as T;
}

export async function sendPostPrices(
  serial: string,
  body: {
    prices: Record<string, number>;
    mqttPrefix?: string;
    sendToDevice?: boolean;
    persist?: boolean;
  }
): Promise<{ topic?: string; prices: Record<string, number>; mqttPrefix: string }> {
  const res = await fetchWithAuth(`/api/crm/post-device/posts/${encodeURIComponent(serial)}/prices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function sendPostCommand(
  serial: string,
  body: { command: DeviceCommandKey; amount?: number; mqttPrefix?: string }
): Promise<{ topic: string; command: DeviceCommandKey }> {
  const res = await fetchWithAuth(`/api/crm/post-device/posts/${encodeURIComponent(serial)}/command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function syncMqttUsers(): Promise<{ postUsers: number }> {
  const res = await fetchWithAuth('/api/crm/post-device/mqtt/sync-users', { method: 'POST' });
  return parseJson(res);
}
