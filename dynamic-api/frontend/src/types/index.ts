export interface User {
  _id: string;
  login: string;
  email: string;
  name: string;
  status: 'active' | 'inactive' | 'suspended';
  groupIds: Group[];
  lastLoginAt?: string;
  createdAt: string;
}

export interface Group {
  _id: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
}

export interface EndpointGroup {
  _id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  order: number;
}

export interface SchemaField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  defaultValue?: unknown;
  order: number;
  children?: SchemaField[];
}

export interface Endpoint {
  _id: string;
  name: string;
  description?: string;
  slug: string;
  path: string;
  method: string;
  groupId?: EndpointGroup;
  fields: SchemaField[];
  accessType: 'public' | 'authenticated' | 'group';
  allowedGroupIds: string[];
  handlers: { name: string; type: string; code?: string; enabled: boolean }[];
  isSystem: boolean;
  enabled: boolean;
  callCount: number;
  createdAt: string;
}

export interface DashboardStats {
  users: number;
  endpoints: number;
  requests: number;
  errors: number;
  groups: number;
  activeUsers: number;
  requestsOverTime: { date: string; count: number }[];
  errorsOverTime: { date: string; count: number }[];
  userActivity: { date: string; count: number }[];
}

export interface LogEntry {
  _id: string;
  action: string;
  message: string;
  userId?: { login: string; name: string };
  endpointId?: { name: string; path: string; method: string };
  statusCode?: number;
  responseTime?: number;
  createdAt: string;
}

export interface TestResult {
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: unknown;
    params?: Record<string, string>;
  };
  response: {
    statusCode: number;
    headers: Record<string, string>;
    body: unknown;
    responseTime: number;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SystemInfo {
  hostname: string;
  platform: string;
  osType: string;
  osRelease: string;
  osVersion: string;
  architecture: string;
  cpuModel: string;
  cpuCores: number;
  cpuSpeed: number;
  totalMemory: number;
  freeMemory: number;
  usedMemory: number;
  memoryUsagePercent: number;
  uptime: number;
  nodeVersion: string;
  appVersion: string;
  appName: string;
  environment: string;
  disk: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
    mount: string;
  };
  files: {
    appFiles: number;
    logFiles: number;
    totalProjectFiles: number;
  };
  network: {
    interfaces: { name: string; address: string; family: string }[];
  };
  loadAverage: number[];
  timestamp: string;
}

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

export interface SettingsResponse {
  settings: AppSettings;
  logsCount: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
