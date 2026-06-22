import { SystemSettings } from '../models';

export interface AppSettings {
  appName: string;
  version: string;
  defaultTheme: string;
  rateLimitMax: number;
  rateLimitWindowMs: number;
  authMaxAttempts: number;
  authLockoutDurationMs: number;
  logRetentionDays: number;
  logsPerPage: number;
  usersPerPage: number;
  endpointsPerPage: number;
  enableRegistration: boolean;
  jwtExpiresIn: string;
  jwtRefreshExpiresIn: string;
}

const DEFAULTS: AppSettings = {
  appName: 'Dynamic API Platform',
  version: '1.0.0',
  defaultTheme: 'dark',
  rateLimitMax: 1000,
  rateLimitWindowMs: 900000,
  authMaxAttempts: 5,
  authLockoutDurationMs: 900000,
  logRetentionDays: 30,
  logsPerPage: 50,
  usersPerPage: 20,
  endpointsPerPage: 50,
  enableRegistration: true,
  jwtExpiresIn: '15m',
  jwtRefreshExpiresIn: '7d',
};

const KEY_MAP: Record<keyof AppSettings, string> = {
  appName: 'app_name',
  version: 'version',
  defaultTheme: 'default_theme',
  rateLimitMax: 'rate_limit_max',
  rateLimitWindowMs: 'rate_limit_window_ms',
  authMaxAttempts: 'auth_max_attempts',
  authLockoutDurationMs: 'auth_lockout_duration_ms',
  logRetentionDays: 'log_retention_days',
  logsPerPage: 'logs_per_page',
  usersPerPage: 'users_per_page',
  endpointsPerPage: 'endpoints_per_page',
  enableRegistration: 'enable_registration',
  jwtExpiresIn: 'jwt_expires_in',
  jwtRefreshExpiresIn: 'jwt_refresh_expires_in',
};

const REVERSE_MAP = Object.fromEntries(
  Object.entries(KEY_MAP).map(([k, v]) => [v, k])
) as Record<string, keyof AppSettings>;

const DESCRIPTIONS: Record<string, string> = {
  app_name: 'Application name',
  version: 'Application version',
  default_theme: 'Default UI theme',
  rate_limit_max: 'Max API requests per window per IP',
  rate_limit_window_ms: 'API rate limit window in milliseconds',
  auth_max_attempts: 'Max failed login attempts before lockout',
  auth_lockout_duration_ms: 'Login lockout duration in milliseconds',
  log_retention_days: 'Days to keep audit logs',
  logs_per_page: 'Default logs per page',
  users_per_page: 'Default users per page',
  endpoints_per_page: 'Default endpoints per page',
  enable_registration: 'Allow public user registration',
  jwt_expires_in: 'JWT access token lifetime',
  jwt_refresh_expires_in: 'JWT refresh token lifetime',
};

export class SettingsService {
  private cache: AppSettings = { ...DEFAULTS };

  getCached(): AppSettings {
    return { ...this.cache };
  }

  async load(): Promise<AppSettings> {
    const docs = await SystemSettings.find();
    const settings = { ...DEFAULTS };

    for (const doc of docs) {
      const field = REVERSE_MAP[doc.key];
      if (field) {
        (settings as Record<string, unknown>)[field] = doc.value;
      }
    }

    this.cache = settings;
    return settings;
  }

  async getAll(): Promise<AppSettings> {
    return this.load();
  }

  async update(partial: Partial<AppSettings>): Promise<AppSettings> {
    for (const [field, value] of Object.entries(partial)) {
      const key = KEY_MAP[field as keyof AppSettings];
      if (!key || value === undefined) continue;

      await SystemSettings.findOneAndUpdate(
        { key },
        { key, value, description: DESCRIPTIONS[key] },
        { upsert: true, new: true }
      );
    }

    return this.load();
  }

  async seedDefaults(): Promise<void> {
    for (const [field, value] of Object.entries(DEFAULTS)) {
      const key = KEY_MAP[field as keyof AppSettings];
      const existing = await SystemSettings.findOne({ key });
      if (!existing) {
        await SystemSettings.create({ key, value, description: DESCRIPTIONS[key] });
      }
    }
    await this.load();
  }
}

export const settingsService = new SettingsService();
