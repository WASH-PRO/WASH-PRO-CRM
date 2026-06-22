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
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || '';

class ApiClient {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
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

    if (response.status === 401 && this.refreshToken) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        const retry = await fetch(`${API_URL}${path}`, { ...options, headers });
        return this.handleResponse<T>(retry);
      }
      this.clearTokens();
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    return this.handleResponse<T>(response);
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || 'Request failed');
    }
    return data;
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

  async callDynamicApi(path: string, method: string, body?: unknown) {
    const options: RequestInit = { method };
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }
    return this.request(path, options);
  }
}

export const api = new ApiClient();
