import fetch from 'node-fetch';
import { pino } from 'pino';
import {
  channelsFromSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
  isNotificationTypeEnabled,
  normalizeNotificationSettings,
  type NotificationSettingsValue,
} from './notification-settings.js';

const API_URL = process.env.API_URL || 'http://dynamic-api:3001';
const SERVICE_LOGIN = process.env.SERVICE_LOGIN || 'service';
const SERVICE_PASSWORD = process.env.SERVICE_PASSWORD || 'ServiceInternal123!';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

export async function getServiceToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;

  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: SERVICE_LOGIN, password: SERVICE_PASSWORD }),
  });
  const json = (await res.json()) as { success: boolean; data?: { accessToken: string }; error?: string };
  if (!json.success || !json.data?.accessToken) {
    throw new Error(`Service login failed: ${json.error}`);
  }
  cachedToken = json.data.accessToken;
  tokenExpiresAt = Date.now() + 14 * 60 * 1000;
  return cachedToken;
}

export async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = await getServiceToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as { success: boolean; data?: T; error?: string };
  if (!json.success) {
    throw new Error(`${method} ${path}: ${json.error || res.statusText}`);
  }
  return json.data as T;
}

export async function findPostBySerial(serial: string): Promise<{ id: string; washId: string; postId?: string } | null> {
  const posts = await apiRequest<Array<{ id: string; serialNumber: string; washId: string }>>('GET', '/api/crm/posts?limit=500');
  const post = posts.find((p) => p.serialNumber === serial);
  return post ? { id: post.id, washId: post.washId } : null;
}

export async function findPostState(postId: string): Promise<{ id: string } | null> {
  const states = await apiRequest<Array<{ id: string; postId: string }>>('GET', '/api/crm/post-states?limit=500');
  const state = states.find((s) => s.postId === postId);
  return state ? { id: state.id } : null;
}

let cachedNotificationSettings: NotificationSettingsValue | null = null;
let notificationSettingsExpiresAt = 0;

async function loadNotificationSettings(): Promise<NotificationSettingsValue> {
  if (cachedNotificationSettings && Date.now() < notificationSettingsExpiresAt) {
    return cachedNotificationSettings;
  }
  try {
    const rows = await apiRequest<Array<{ key: string; value: unknown }>>('GET', '/api/crm/settings?limit=50');
    const row = rows.find((r) => r.key === 'notifications');
    cachedNotificationSettings = normalizeNotificationSettings(row?.value);
  } catch (err) {
    logger.warn({ err }, 'Failed to load notification settings, using defaults');
    cachedNotificationSettings = DEFAULT_NOTIFICATION_SETTINGS;
  }
  notificationSettingsExpiresAt = Date.now() + 60_000;
  return cachedNotificationSettings;
}

export async function createNotification(payload: {
  type: string;
  severity: string;
  washId?: string;
  postId?: string;
  message: string;
}): Promise<void> {
  const settings = await loadNotificationSettings();
  if (!isNotificationTypeEnabled(payload.type, settings)) {
    logger.debug({ type: payload.type }, 'Notification skipped (disabled in CRM settings)');
    return;
  }

  const channels = channelsFromSettings(settings);
  if (!channels.length) {
    logger.debug({ type: payload.type }, 'Notification skipped (no delivery channels enabled)');
    return;
  }

  await apiRequest('POST', '/api/crm/notifications', {
    ...payload,
    read: false,
    channels,
    createdAt: new Date().toISOString(),
  });
}

export { logger };
