import fetch from 'node-fetch';
import { pino } from 'pino';

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

export async function createNotification(payload: {
  type: string;
  severity: string;
  washId?: string;
  postId?: string;
  message: string;
}): Promise<void> {
  await apiRequest('POST', '/api/crm/notifications', {
    ...payload,
    read: false,
    channels: ['telegram', 'web'],
    createdAt: new Date().toISOString(),
  });
}

export { logger };
