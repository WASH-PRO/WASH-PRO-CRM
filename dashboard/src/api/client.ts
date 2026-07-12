import { tGlobal } from '../i18n/runtime';

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

function decodeBase64Url(part: string): string {
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
  return atob(padded);
}

function decodeJwtPermissions(token: string): import('../types').Permission[] {
  try {
    const part = token.split('.')[1];
    if (!part) return [];
    const payload = JSON.parse(decodeBase64Url(part)) as { permissions?: import('../types').Permission[] };
    return payload.permissions || [];
  } catch {
    return [];
  }
}

function decodeJwtExp(token: string): number | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const payload = JSON.parse(decodeBase64Url(part)) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

type AuthExpiredListener = () => void;
const authExpiredListeners = new Set<AuthExpiredListener>();

export function onAuthExpired(listener: AuthExpiredListener): () => void {
  authExpiredListeners.add(listener);
  return () => {
    authExpiredListeners.delete(listener);
  };
}

export function notifyAuthExpired(): void {
  clearAuth();
  for (const listener of authExpiredListeners) {
    listener();
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

async function fetchApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> {
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

  if (res.status === 401) {
    notifyAuthExpired();
    throw new Error(tGlobal('errors.sessionExpired'));
  }

  const text = await res.text();
  if (!text.trim()) {
    if (!res.ok) throw new Error(tGlobal('errors.requestFailed', { status: res.status }));
    return { success: true };
  }

  let json: ApiResult<T>;
  try {
    json = JSON.parse(text) as ApiResult<T>;
  } catch {
    throw new Error(
      res.ok ? tGlobal('errors.invalidServerResponse') : text.slice(0, 200) || tGlobal('errors.requestFailed', { status: res.status })
    );
  }

  if (!json.success) {
    throw new Error(json.error || tGlobal('errors.requestFailed', { status: res.status }));
  }
  return json as ApiResult<T> & Record<string, unknown>;
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const json = await fetchApi<T>(path, options);
  return json.data as T;
}

/** Одна страница списка Dynamic API. */
export async function apiListPage<T>(
  path: string,
  page = 1,
  limit = 100,
  signal?: AbortSignal
): Promise<{ data: T[]; pagination: NonNullable<ApiResult<T[]>['pagination']> }> {
  const [basePath, queryString] = path.split('?');
  const params = new URLSearchParams(queryString || '');
  params.set('page', String(page));
  params.set('limit', String(limit));
  const json = await fetchApi<T[]>(`${basePath}?${params.toString()}`, { signal });
  const data = Array.isArray(json.data) ? json.data : [];
  const pagination = json.pagination ?? { total: data.length, page, limit, totalPages: 1 };
  return { data, pagination };
}

/** Загружает все страницы списка (Dynamic API по умолчанию limit=20). */
export async function apiListAll<T>(
  path: string,
  pageSize = 100,
  maxPages?: number,
  signal?: AbortSignal
): Promise<T[]> {
  const [basePath, queryString] = path.split('?');
  const params = new URLSearchParams(queryString || '');
  const all: T[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (maxPages != null && page > maxPages) break;
    params.set('page', String(page));
    params.set('limit', String(pageSize));
    const json = await fetchApi<T[]>(`${basePath}?${params.toString()}`, { signal });
    const chunk = Array.isArray(json.data) ? json.data : [];
    all.push(...chunk);
    totalPages = json.pagination?.totalPages ?? 1;
    if (chunk.length === 0) break;
    page += 1;
  }

  return all;
}

/** Одна страница — для небольших справочников. */
export async function apiListDictionary<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  const { data } = await apiListPage<T>(path, 1, 200, signal);
  return data;
}

const catalogCache = new Map<string, { expires: number; data: unknown[] }>();
const CATALOG_CACHE_MS = 45_000;

function normalizeCatalogCachePrefix(pathPrefix: string): string {
  return pathPrefix.replace(/^\/api(?=\/)/, '');
}

export function clearCatalogCache(pathPrefix?: string): void {
  if (!pathPrefix) {
    catalogCache.clear();
    return;
  }
  const normalized = normalizeCatalogCachePrefix(pathPrefix);
  for (const key of catalogCache.keys()) {
    if (key === normalized || key.startsWith(`${normalized}?`)) {
      catalogCache.delete(key);
    }
  }
}

export interface WashDeleteResult {
  success: boolean;
  message?: string;
  deletedPosts?: number;
  deletedRelated?: number;
}

export function clearWashCatalogCaches(): void {
  for (const path of ['/crm/washes', '/crm/posts', '/crm/post-states', '/crm/cards']) {
    clearCatalogCache(path);
  }
}

export function formatWashDeleteSummary(
  results: WashDeleteResult[],
  options?: { objectLabel?: string }
): string {
  const objects = results.length;
  const posts = results.reduce((sum, row) => sum + (row.deletedPosts ?? 0), 0);
  const related = results.reduce((sum, row) => sum + (row.deletedRelated ?? 0), 0);
  const label = options?.objectLabel ?? tGlobal('api.objectLabel');
  return tGlobal('api.deleteSummary', { objects, label, posts, related });
}

export async function deleteWash(id: string): Promise<WashDeleteResult> {
  const json = (await fetchApi(`/crm/washes/${id}`, { method: 'DELETE' })) as WashDeleteResult;
  clearWashCatalogCaches();
  return {
    success: true,
    message: json.message,
    deletedPosts: json.deletedPosts,
    deletedRelated: json.deletedRelated,
  };
}

export async function bulkDeleteWashes(
  ids: string[],
  onProgress?: (current: number, total: number) => void
): Promise<WashDeleteResult[]> {
  const results: WashDeleteResult[] = [];
  for (let index = 0; index < ids.length; index++) {
    onProgress?.(index + 1, ids.length);
    results.push(await deleteWash(ids[index]!));
  }
  return results;
}

/** Справочники (мойки, посты, настройки) — одна страница + краткий кэш в сессии. */
export async function apiListCatalog<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  const cacheKey = path.split('?')[0]!;
  const hit = catalogCache.get(cacheKey);
  if (hit && Date.now() < hit.expires) {
    return hit.data as T[];
  }
  const data = await apiListDictionary<T>(path, signal);
  catalogCache.set(cacheKey, { data, expires: Date.now() + CATALOG_CACHE_MS });
  return data;
}

/** Крупные коллекции — ограниченное число страниц вместо полного обхода. */
export async function apiListBounded<T>(
  path: string,
  signal?: AbortSignal,
  maxPages = 15
): Promise<T[]> {
  return apiListAll<T>(path, 100, maxPages, signal);
}

export async function apiList<T>(path: string, signal?: AbortSignal): Promise<T[]> {
  return apiListAll<T>(path, 100, 100, signal);
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) return null;
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
  });
  const json = (await res.json()) as ApiResult<{ accessToken: string; refreshToken?: string }>;
  if (json.success && json.data) {
    setTokens(json.data.accessToken, json.data.refreshToken ?? refresh);
    setStoredPermissions(decodeJwtPermissions(json.data.accessToken));
    return json.data.accessToken;
  }
  notifyAuthExpired();
  return null;
}

function authHeaders(token: string | null, extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** fetch с Bearer-токеном и автоматическим refresh при 401 */
export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  let token = getToken();
  let res = await fetch(url, {
    ...options,
    headers: authHeaders(token, options.headers as Record<string, string>),
  });

  if (res.status === 401 && token) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await fetch(url, {
        ...options,
        headers: authHeaders(newToken, options.headers as Record<string, string>),
      });
    }
  }

  if (res.status === 401) {
    notifyAuthExpired();
  }

  return res;
}

/** Периодическая проверка JWT и refresh при простое (без API-запросов). */
export function startSessionWatch(): () => void {
  const tick = async () => {
    const refresh = localStorage.getItem(REFRESH_KEY);
    const access = getToken();
    if (!refresh && !access) return;

    const refreshExp = refresh ? decodeJwtExp(refresh) : null;
    if (refreshExp && Date.now() >= refreshExp * 1000) {
      notifyAuthExpired();
      return;
    }

    if (!access) {
      notifyAuthExpired();
      return;
    }

    const accessExp = decodeJwtExp(access);
    if (accessExp && Date.now() >= accessExp * 1000) {
      const newToken = await refreshAccessToken();
      if (!newToken) notifyAuthExpired();
    }
  };

  void tick();
  const intervalId = window.setInterval(() => void tick(), 30_000);
  const onVisible = () => {
    if (document.visibilityState === 'visible') void tick();
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    clearInterval(intervalId);
    document.removeEventListener('visibilitychange', onVisible);
  };
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
  if (!json.success || !json.data) throw new Error(json.error || tGlobal('errors.loginFailed'));
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
  const profile = await api<import('../types').User>('/profile');
  return {
    ...profile,
    id: profile.id || String((profile as { _id?: string })._id ?? ''),
    groupIds: Array.isArray(profile.groupIds) ? profile.groupIds : [],
  };
}

export async function updateProfile(body: {
  name?: string;
  email?: string;
  password?: string;
}): Promise<import('../types').User> {
  return api<import('../types').User>('/profile', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function getSystemLogs(query = 'page=1&limit=50') {
  const res = await api<{ data: import('../types').LogEntry[] } | import('../types').LogEntry[]>(
    `/dashboard/logs?${query}`
  );
  if (Array.isArray(res)) return res;
  return (res as { data: import('../types').LogEntry[] }).data || [];
}
