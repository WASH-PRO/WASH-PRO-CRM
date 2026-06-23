const TOKEN_KEY = 'wash_crm_token';
const REFRESH_KEY = 'wash_crm_refresh';
const USER_KEY = 'wash_crm_user';
const PERMS_KEY = 'wash_crm_permissions';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(PERMS_KEY);
}

function decodeJwtPermissions(token: string): import('../types').Permission[] {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!)) as { permissions?: import('../types').Permission[] };
    return payload.permissions || [];
  } catch {
    return [];
  }
}

export function getStoredPermissions(): import('../types').Permission[] {
  const raw = localStorage.getItem(PERMS_KEY);
  if (raw) return JSON.parse(raw) as import('../types').Permission[];
  const token = getToken();
  return token ? decodeJwtPermissions(token) : [];
}

export function setStoredPermissions(perms: import('../types').Permission[]): void {
  localStorage.setItem(PERMS_KEY, JSON.stringify(perms));
}

export function getStoredUser<T>(): T | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as T) : null;
}

export function setStoredUser(user: unknown): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: { total: number; page: number; limit: number; totalPages: number };
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) return null;
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
  });
  const json = (await res.json()) as ApiResult<{ accessToken: string; refreshToken: string }>;
  if (json.success && json.data) {
    setTokens(json.data.accessToken, json.data.refreshToken);
    setStoredPermissions(decodeJwtPermissions(json.data.accessToken));
    return json.data.accessToken;
  }
  clearAuth();
  return null;
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res = await fetch(`/api${path}`, { ...options, headers });

  if (res.status === 401 && token) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.Authorization = `Bearer ${newToken}`;
      res = await fetch(`/api${path}`, { ...options, headers });
    }
  }

  const json = (await res.json()) as ApiResult<T>;
  if (!json.success) {
    throw new Error(json.error || `Ошибка запроса: ${res.status}`);
  }
  return json.data as T;
}

export async function apiList<T>(path: string): Promise<T[]> {
  const data = await api<T[] | { data: T[] }>(path);
  if (Array.isArray(data)) return data;
  return (data as { data: T[] }).data || [];
}

export async function login(login: string, password: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, password }),
  });
  const json = (await res.json()) as ApiResult<{
    accessToken: string;
    refreshToken: string;
    user: unknown & { permissions?: import('../types').Permission[] };
  }>;
  if (!json.success || !json.data) throw new Error(json.error || 'Ошибка входа');
  setTokens(json.data.accessToken, json.data.refreshToken);
  setStoredUser(json.data.user);
  setStoredPermissions(decodeJwtPermissions(json.data.accessToken));
  return { ...json.data, user: { ...(json.data.user as object), permissions: decodeJwtPermissions(json.data.accessToken) } };
}

export async function logout(): Promise<void> {
  try {
    await api('/auth/logout', { method: 'POST' });
  } finally {
    clearAuth();
  }
}

export async function getProfile() {
  return api<import('../types').User>('/profile');
}

export async function getSystemLogs(page = 1) {
  const res = await api<{ data: import('../types').LogEntry[] } | import('../types').LogEntry[]>(
    `/dashboard/logs?page=${page}&limit=50`
  );
  if (Array.isArray(res)) return res;
  return (res as { data: import('../types').LogEntry[] }).data || [];
}
