import {
  DashboardStats,
  PaginatedResponse,
  User,
  Group,
  Endpoint,
  EndpointGroup,
  TestResult,
  LogEntry,
  SystemInfo,
  AppSettings,
  SettingsResponse,
  UpdateSettings,
  UpdateStatus,
  UpdateJob,
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || '';

export class UnauthorizedError extends Error {
  constructor(message = 'Session expired') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

type UnauthorizedListener = () => void;

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private unauthorizedListeners = new Set<UnauthorizedListener>();

  constructor() {
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  onUnauthorized(listener: UnauthorizedListener) {
    this.unauthorizedListeners.add(listener);
    return () => {
      this.unauthorizedListeners.delete(listener);
    };
  }

  private shouldHandleUnauthorized(path: string) {
    return !path.startsWith('/api/auth/login') && !path.startsWith('/api/auth/register');
  }

  private forceLogout(message = 'Session expired'): never {
    this.clearTokens();
    this.unauthorizedListeners.forEach((listener) => listener());
    throw new UnauthorizedError(message);
  }

  setTokens(access: string, refresh: string) {
    this.accessToken = access;
    this.refreshToken = refresh;
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  get isAuthenticated() {
    return !!this.accessToken;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${API_URL}${path}`, { ...options, headers });

    if (response.status === 401 && this.shouldHandleUnauthorized(path)) {
      if (this.refreshToken) {
        const refreshed = await this.tryRefresh();
        if (refreshed) {
          headers['Authorization'] = `Bearer ${this.accessToken}`;
          const retry = await fetch(`${API_URL}${path}`, { ...options, headers });
          if (retry.status === 401) {
            this.forceLogout();
          }
          return this.handleResponse<T>(retry);
        }
      }
      this.forceLogout();
    }

    return this.handleResponse<T>(response);
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    let data: { error?: string; message?: string };
    try {
      data = await response.json();
    } catch {
      if (!response.ok) {
        const hint = response.status === 502
          ? 'API unavailable (502). Restart dynamic-api-panel or check dynamic-api.'
          : `Request failed (${response.status})`;
        throw new Error(hint);
      }
      throw new Error('Invalid API response (expected JSON)');
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Request failed');
    }
    return data as T;
  }

  private async tryRefresh(): Promise<boolean> {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      this.accessToken = data.data.accessToken;
      localStorage.setItem('accessToken', data.data.accessToken);
      return true;
    } catch {
      return false;
    }
  }

  async login(login: string, password: string) {
    const res = await this.request<{ success: boolean; data: { accessToken: string; refreshToken: string; user: unknown } }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ login, password }) }
    );
    this.setTokens(res.data.accessToken, res.data.refreshToken);
    return res.data;
  }

  async logout() {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } finally {
      this.clearTokens();
    }
  }

  async getProfile() {
    const res = await this.request<{ success: boolean; data: unknown }>('/api/profile');
    return res.data;
  }

  async getDashboardStats() {
    const res = await this.request<{ success: boolean; data: DashboardStats }>('/api/dashboard/stats');
    return res.data;
  }

  async getSystemInfo() {
    const res = await this.request<{ success: boolean; data: SystemInfo }>('/api/dashboard/system');
    return res.data;
  }

  async getUsers(page = 1, limit = 20, search?: string) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search?.trim()) params.set('search', search.trim());
    const res = await this.request<{ success: boolean; data: PaginatedResponse<User> }>(
      `/api/users?${params}`
    );
    return res.data;
  }

  async createUser(data: Record<string, unknown>) {
    const res = await this.request<{ success: boolean; data: User }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async updateUser(id: string, data: Record<string, unknown>) {
    const res = await this.request<{ success: boolean; data: User }>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async deleteUser(id: string) {
    await this.request(`/api/users/${id}`, { method: 'DELETE' });
  }

  async getGroups() {
    const res = await this.request<{ success: boolean; data: Group[] }>('/api/groups');
    return res.data;
  }

  async createGroup(data: Record<string, unknown>) {
    const res = await this.request<{ success: boolean; data: Group }>('/api/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async updateGroup(id: string, data: Record<string, unknown>) {
    const res = await this.request<{ success: boolean; data: Group }>(`/api/groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async deleteGroup(id: string) {
    await this.request(`/api/groups/${id}`, { method: 'DELETE' });
  }

  async getEndpoints(page = 1, limit = 50) {
    const res = await this.request<{ success: boolean; data: PaginatedResponse<Endpoint> }>(
      `/api/endpoints?page=${page}&limit=${limit}`
    );
    return res.data;
  }

  async getEndpoint(id: string) {
    const res = await this.request<{ success: boolean; data: Endpoint }>(`/api/endpoints/${id}`);
    return res.data;
  }

  async createEndpoint(data: Record<string, unknown>) {
    const res = await this.request<{ success: boolean; data: Endpoint }>('/api/endpoints', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async updateEndpoint(id: string, data: Record<string, unknown>) {
    const res = await this.request<{ success: boolean; data: Endpoint }>(`/api/endpoints/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async deleteEndpoint(id: string) {
    await this.request(`/api/endpoints/${id}`, { method: 'DELETE' });
  }

  async getEndpointGroups() {
    const res = await this.request<{ success: boolean; data: EndpointGroup[] }>('/api/endpoints/groups');
    return res.data;
  }

  async createEndpointGroup(data: Record<string, unknown>) {
    const res = await this.request<{ success: boolean; data: EndpointGroup }>('/api/endpoints/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async updateEndpointGroup(id: string, data: Record<string, unknown>) {
    const res = await this.request<{ success: boolean; data: EndpointGroup }>(`/api/endpoints/groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async deleteEndpointGroup(id: string) {
    await this.request(`/api/endpoints/groups/${id}`, { method: 'DELETE' });
  }

  async getEndpointExamples(id: string) {
    const res = await this.request<{ success: boolean; data: { request: Record<string, unknown>; response: Record<string, unknown> } }>(
      `/api/endpoints/${id}/examples`
    );
    return res.data;
  }

  async getEndpointDocs(id: string) {
    const res = await this.request<{ success: boolean; data: unknown }>(`/api/endpoints/${id}/docs`);
    return res.data;
  }

  async testEndpoint(id: string, data: Record<string, unknown>) {
    const res = await this.request<{ success: boolean; data: TestResult }>(`/api/endpoints/${id}/test`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async getLogs(page = 1, limit = 50, action?: string, search?: string) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (action) params.set('action', action);
    if (search?.trim()) params.set('search', search.trim());
    const res = await this.request<{ success: boolean; data: PaginatedResponse<LogEntry> }>(
      `/api/dashboard/logs?${params}`
    );
    return res.data;
  }

  async getSettings() {
    const res = await this.request<{ success: boolean; data: SettingsResponse }>('/api/settings');
    return res.data;
  }

  async updateSettings(data: Partial<AppSettings>) {
    const res = await this.request<{ success: boolean; data: AppSettings }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async clearAllLogs() {
    const res = await this.request<{ success: boolean; data: { deleted: number }; message: string }>(
      '/api/settings/logs',
      { method: 'DELETE' }
    );
    return res;
  }

  async clearOldLogs() {
    const res = await this.request<{ success: boolean; data: { deleted: number }; message: string }>(
      '/api/settings/logs/old',
      { method: 'DELETE' }
    );
    return res;
  }

  async getDbCollections() {
    const res = await this.request<{ success: boolean; data: import('../types').DbCollectionInfo[] }>(
      '/api/database/collections'
    );
    return res.data;
  }

  async getDbDocuments(collection: string, page = 1, limit = 20, search?: string) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search?.trim()) params.set('search', search.trim());
    const res = await this.request<{ success: boolean; data: import('../types').DbDocumentPage }>(
      `/api/database/collections/${encodeURIComponent(collection)}?${params}`
    );
    return res.data;
  }

  async getDbDocument(collection: string, id: string) {
    const res = await this.request<{ success: boolean; data: Record<string, unknown> }>(
      `/api/database/collections/${encodeURIComponent(collection)}/${id}`
    );
    return res.data;
  }

  async createDbDocument(collection: string, data: Record<string, unknown>) {
    const res = await this.request<{ success: boolean; data: Record<string, unknown> }>(
      `/api/database/collections/${encodeURIComponent(collection)}`,
      { method: 'POST', body: JSON.stringify(data) }
    );
    return res.data;
  }

  async updateDbDocument(collection: string, id: string, data: Record<string, unknown>) {
    const res = await this.request<{ success: boolean; data: Record<string, unknown> }>(
      `/api/database/collections/${encodeURIComponent(collection)}/${id}`,
      { method: 'PUT', body: JSON.stringify(data) }
    );
    return res.data;
  }

  async deleteDbDocument(collection: string, id: string) {
    await this.request(`/api/database/collections/${encodeURIComponent(collection)}/${id}`, {
      method: 'DELETE',
    });
  }

  async clearDbCollection(collection: string) {
    const res = await this.request<{ success: boolean; data: { deletedCount: number } }>(
      `/api/database/collections/${encodeURIComponent(collection)}`,
      { method: 'DELETE' }
    );
    return res.data;
  }

  async callDynamicApi(path: string, method: string, body?: unknown) {
    const options: RequestInit = { method };
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }
    return this.request(path, options);
  }

  async exportProject(options?: { includeData?: boolean; includeSettings?: boolean }) {
    const params = new URLSearchParams();
    if (options?.includeData) params.set('includeData', 'true');
    if (options?.includeSettings) params.set('includeSettings', 'true');
    const res = await this.request<{ success: boolean; data: Record<string, unknown> }>(
      `/api/project/export?${params}`
    );
    return res.data;
  }

  async importProject(
    bundle: Record<string, unknown>,
    options?: { mode?: 'merge' | 'replace'; includeData?: boolean }
  ) {
    const res = await this.request<{
      success: boolean;
      data: { groupsCreated: number; endpointsCreated: number; endpointsUpdated: number; recordsImported: number };
      message: string;
    }>('/api/project/import', {
      method: 'POST',
      body: JSON.stringify({ bundle, ...options }),
    });
    return res;
  }

  async getCronJobs() {
    const res = await this.request<{ success: boolean; data: unknown[] }>('/api/cron');
    return res.data;
  }

  async createCronJob(data: Record<string, unknown>) {
    const res = await this.request<{ success: boolean; data: unknown }>('/api/cron', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async deleteCronJob(id: string) {
    await this.request(`/api/cron/${id}`, { method: 'DELETE' });
  }

  async runCronJob(id: string) {
    const res = await this.request<{ success: boolean; data: { success: boolean; message: string } }>(
      `/api/cron/${id}/run`,
      { method: 'POST' }
    );
    return res.data;
  }

  async getWebhooks() {
    const res = await this.request<{ success: boolean; data: unknown[] }>('/api/webhooks');
    return res.data;
  }

  async createWebhook(data: Record<string, unknown>) {
    const res = await this.request<{ success: boolean; data: unknown }>('/api/webhooks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async deleteWebhook(id: string) {
    await this.request(`/api/webhooks/${id}`, { method: 'DELETE' });
  }

  async testWebhook(id: string) {
    await this.request(`/api/webhooks/${id}/test`, { method: 'POST' });
  }

  async getApiKeys() {
    const res = await this.request<{ success: boolean; data: unknown[] }>('/api/api-keys');
    return res.data;
  }

  async createApiKey(data: { name: string; permissions: string[] }) {
    const res = await this.request<{ success: boolean; data: { apiKey: string } }>('/api/api-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data;
  }

  async deleteApiKey(id: string) {
    await this.request(`/api/api-keys/${id}`, { method: 'DELETE' });
  }

  async getMcpTools() {
    const res = await this.request<{ success: boolean; data: unknown[] }>('/api/mcp/tools');
    return res.data;
  }

  async getUpdateStatus() {
    const res = await this.request<{ success: boolean; data: UpdateStatus }>('/api/updates/status');
    return res.data;
  }

  async checkForUpdates() {
    const res = await this.request<{ success: boolean; data: UpdateStatus & { updateAvailable?: boolean } }>(
      '/api/updates/check',
      { method: 'POST' }
    );
    return res.data;
  }

  async getUpdateSettings() {
    const res = await this.request<{ success: boolean; data: UpdateSettings }>('/api/updates/settings');
    return res.data;
  }

  async updateUpdateSettings(settings: Partial<UpdateSettings>) {
    const res = await this.request<{ success: boolean; data: UpdateSettings }>('/api/updates/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
    return res.data;
  }

  async applyUpdate(targetVersion?: string) {
    const res = await this.request<{ success: boolean; data: UpdateJob; message: string }>('/api/updates/apply', {
      method: 'POST',
      body: JSON.stringify(targetVersion ? { targetVersion } : {}),
    });
    return res;
  }

  async dismissUpdate(version: string) {
    await this.request('/api/updates/dismiss', {
      method: 'POST',
      body: JSON.stringify({ version }),
    });
  }

  async rollbackUpdate(jobId: string) {
    const res = await this.request<{ success: boolean; data: UpdateJob; message: string }>(
      `/api/updates/jobs/${jobId}/rollback`,
      { method: 'POST' }
    );
    return res;
  }

  async cancelUpdate(jobId: string) {
    const res = await this.request<{ success: boolean; data: UpdateJob; message: string }>(
      `/api/updates/jobs/${jobId}/cancel`,
      { method: 'POST' }
    );
    return res;
  }
}

export const api = new ApiClient();
