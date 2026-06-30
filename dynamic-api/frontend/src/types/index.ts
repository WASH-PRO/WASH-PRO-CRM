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
  networkAccess?: NetworkAccessRules;
}

export interface NetworkAccessRules {
  enabled: boolean;
  allowedDomains: string[];
  allowedIpRanges: string[];
}

export interface SchemaField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  defaultValue?: unknown;
  order: number;
  children?: SchemaField[];
  refEndpointId?: string;
}

export interface Endpoint {
  _id: string;
  name: string;
  description?: string;
  slug: string;
  path: string;
  method: string;
  apiVersion?: string;
  groupId?: EndpointGroup;
  fields: SchemaField[];
  accessType: 'public' | 'authenticated' | 'group';
  allowedGroupIds: string[];
  networkAccess?: NetworkAccessRules;
  inheritGroupNetworkAccess?: boolean;
  handlers: { name: string; type: string; code?: string; enabled: boolean }[];
  isSystem: boolean;
  enabled: boolean;
  callCount: number;
  dataRetentionDays?: number;
  createdAt: string;
}

export interface DashboardStats {
  users: number;
  endpoints: number;
  requests: number;
  errors: number;
  groups: number;
  activeUsers: number;
  cronJobs: number;
  cronJobsEnabled: number;
  webhooks: number;
  webhooksEnabled: number;
  apiKeys: number;
  mcpTools: number;
  requestsOverTime: { date: string; count: number }[];
  errorsOverTime: { date: string; count: number }[];
  loginsOverTime: { date: string; count: number }[];
  webhooksOverTime: { date: string; success: number; error: number }[];
  cronRunsOverTime: { date: string; success: number; error: number }[];
  trafficBySource: { direct: number; mcp: number; cron: number; api_key: number };
  trafficBySourceOverTime: { date: string; direct: number; mcp: number; cron: number; api_key: number }[];
  automationHealth: {
    cronErrors: { id: string; name: string; message?: string }[];
    webhookErrors: { id: string; name: string; url: string }[];
    unusedApiKeys: { id: string; name: string; keyPrefix: string }[];
  };
}

export interface LogEntry {
  _id: string;
  action: string;
  source?: string;
  message: string;
  userId?: { login: string; name: string };
  endpointId?: { name: string; path: string; method: string };
  statusCode?: number;
  responseTime?: number;
  userAgent?: string;
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
  cronJobsActive: number;
  cronJobsTotal: number;
  deployMode: string;
  updateExecutorReady: boolean;
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

export interface UpdateSettings {
  checkEnabled: boolean;
  notifyEnabled: boolean;
  autoUpdateEnabled: boolean;
  checkIntervalHours: number;
  autoUpdateIntervalHours: number;
  githubRepo: string;
  includePrerelease: boolean;
  lastCheckAt: string | null;
  lastKnownLatestVersion: string | null;
  lastNotifiedVersion: string | null;
  dismissedVersion: string | null;
  lastAppliedVersion: string | null;
}

export type UpdateJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'rolling_back'
  | 'rolled_back';

export interface UpdateStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  message?: string;
  at?: string;
}

export interface UpdateJob {
  _id: string;
  status: UpdateJobStatus;
  fromVersion: string;
  targetVersion: string;
  targetTag: string;
  releaseUrl?: string;
  releaseNotes?: string;
  steps: UpdateStep[];
  error?: string;
  trigger: 'manual' | 'auto' | 'scheduled';
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
}

export interface UpdateStatus {
  currentVersion: string;
  latestVersion: string | null;
  latestTag: string | null;
  updateAvailable: boolean;
  releaseUrl: string | null;
  releaseNotes: string | null;
  publishedAt: string | null;
  checkedAt: string;
  executorAvailable: boolean;
  executorReason: string | null;
  deployMode: string;
  settings: UpdateSettings;
  activeJob: UpdateJob | null;
  recentJobs: UpdateJob[];
  showNotification: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface DbCollectionInfo {
  name: string;
  label: string;
  count: number;
  clearable?: boolean;
}

export interface DbDocumentPage {
  data: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
