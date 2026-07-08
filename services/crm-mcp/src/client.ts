import type { CrmMcpConfig } from './config.js';

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
};

export class CrmApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown
  ) {
    super(message);
    this.name = 'CrmApiError';
  }
}

export class CrmApiClient {
  private accessToken = '';
  private refreshToken = '';

  constructor(private readonly config: CrmMcpConfig) {
    this.accessToken = config.token;
    this.refreshToken = config.refreshToken;
  }

  get hasAuth(): boolean {
    return Boolean(this.accessToken || this.config.apiKey);
  }

  async ensureAuth(): Promise<void> {
    if (this.config.apiKey) return;
    if (this.accessToken && !this.isTokenExpiringSoon(this.accessToken)) return;
    if (this.refreshToken) {
      try {
        await this.refresh();
        return;
      } catch {
        // fall through to login
      }
    }
    if (this.config.login && this.config.password) {
      await this.login(this.config.login, this.config.password);
      return;
    }
    if (!this.accessToken) {
      throw new CrmApiError('Not authenticated: set CRM_API_KEY or CRM_LOGIN/CRM_PASSWORD', 401);
    }
  }

  async login(login: string, password: string): Promise<Record<string, unknown>> {
    const data = await this.request<{
      accessToken: string;
      refreshToken?: string;
      user?: Record<string, unknown>;
    }>('/api/auth/login', {
      method: 'POST',
      body: { login, password },
      auth: false,
    });
    this.accessToken = data.accessToken;
    this.refreshToken = data.refreshToken || '';
    return data as unknown as Record<string, unknown>;
  }

  async refresh(): Promise<void> {
    if (!this.refreshToken) throw new CrmApiError('No refresh token', 401);
    const data = await this.request<{ accessToken: string; refreshToken?: string }>('/api/auth/refresh', {
      method: 'POST',
      body: { refreshToken: this.refreshToken },
      auth: false,
    });
    this.accessToken = data.accessToken;
    if (data.refreshToken) this.refreshToken = data.refreshToken;
  }

  async whoami(): Promise<Record<string, unknown>> {
    await this.ensureAuth();
    return this.request<Record<string, unknown>>('/api/profile');
  }

  async health(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/api/health', { auth: false });
  }

  async crmList<T = unknown>(
    path: string,
    query: Record<string, string | number | boolean | undefined> = {}
  ): Promise<T[]> {
    const items: T[] = [];
    let page = 1;
    const limit = Number(query.limit) || 100;
    for (;;) {
      const chunk = await this.crmPage<T>(path, { ...query, page, limit });
      items.push(...chunk);
      if (chunk.length < limit) break;
      page += 1;
      if (page > 100) break;
    }
    return items;
  }

  async crmPage<T = unknown>(
    path: string,
    query: Record<string, string | number | boolean | undefined> = {}
  ): Promise<T[]> {
    const data = await this.request<{ items?: T[]; data?: T[] } | T[]>(path, { query });
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.data)) return data.data;
    return [];
  }

  async crmGet<T = unknown>(path: string): Promise<T> {
    return this.request<T>(path);
  }

  async crmCreate<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: 'POST', body });
  }

  async crmUpdate<T = unknown>(path: string, body: unknown, method: 'PUT' | 'PATCH' = 'PUT'): Promise<T> {
    return this.request<T>(path, { method, body });
  }

  async crmDelete<T = unknown>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }

  async dashboardRequest<T = unknown>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      query?: Record<string, string | number | boolean | undefined>;
    } = {}
  ): Promise<T> {
    await this.ensureAuth();
    const url = new URL(path.startsWith('/') ? path : `/${path}`, `${this.config.dashboardUrl}/`);
    for (const [key, value] of Object.entries(options.query || {})) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    this.applyAuth(headers);

    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    return this.parseResponse<T>(res);
  }

  async mcpListTools(): Promise<Array<{ name: string; description?: string }>> {
    await this.ensureAuth();
    const result = await this.mcpRpc<{ tools: Array<{ name: string; description?: string }> }>('tools/list');
    return result.tools || [];
  }

  async mcpCallTool(name: string, arguments_: Record<string, unknown> = {}): Promise<unknown> {
    await this.ensureAuth();
    const result = await this.mcpRpc<{ content?: Array<{ type: string; text?: string }> } | unknown>(
      'tools/call',
      { name, arguments: arguments_ }
    );
    if (result && typeof result === 'object' && 'content' in (result as object)) {
      const content = (result as { content?: Array<{ type: string; text?: string }> }).content;
      const text = content?.find((c) => c.type === 'text')?.text;
      if (text) {
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      }
    }
    return result;
  }

  private async mcpRpc<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    this.applyAuth(headers);

    const res = await fetch(`${this.config.apiUrl}/api/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    });

    const json = (await res.json()) as {
      result?: T;
      error?: { message?: string; code?: number };
    };

    if (!res.ok || json.error) {
      throw new CrmApiError(json.error?.message || res.statusText || 'MCP request failed', res.status, json);
    }
    return json.result as T;
  }

  private async request<T>(
    path: string,
    options: {
      method?: string;
      body?: unknown;
      query?: Record<string, string | number | boolean | undefined>;
      auth?: boolean;
    } = {}
  ): Promise<T> {
    const useAuth = options.auth !== false;
    if (useAuth) await this.ensureAuth();

    const url = new URL(path.startsWith('/') ? path : `/${path}`, `${this.config.apiUrl}/`);
    for (const [key, value] of Object.entries(options.query || {})) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (useAuth) this.applyAuth(headers);

    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    return this.parseResponse<T>(res);
  }

  private applyAuth(headers: Record<string, string>): void {
    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
      return;
    }
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }
  }

  private async parseResponse<T>(res: Response): Promise<T> {
    const text = await res.text();
    let json: ApiEnvelope<T> | T | null = null;
    if (text) {
      try {
        json = JSON.parse(text) as ApiEnvelope<T> | T;
      } catch {
        if (!res.ok) throw new CrmApiError(text || res.statusText, res.status, text);
        return text as T;
      }
    }

    if (!res.ok) {
      const envelope = json as ApiEnvelope<T> | null;
      throw new CrmApiError(envelope?.error || envelope?.message || res.statusText || 'Request failed', res.status, json);
    }

    if (json && typeof json === 'object' && 'success' in json) {
      const envelope = json as ApiEnvelope<T>;
      if (envelope.success === false) {
        throw new CrmApiError(envelope.error || envelope.message || 'Request failed', res.status, envelope);
      }
      if (envelope.data !== undefined) return envelope.data;
    }

    return json as T;
  }

  private isTokenExpiringSoon(token: string): boolean {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8')) as {
        exp?: number;
      };
      if (!payload.exp) return false;
      return payload.exp * 1000 < Date.now() + 60_000;
    } catch {
      return false;
    }
  }
}
