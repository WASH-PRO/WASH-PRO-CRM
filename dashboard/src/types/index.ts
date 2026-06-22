export type Permission =
  | 'view'
  | 'create'
  | 'update'
  | 'delete'
  | 'manage_users'
  | 'manage_api'
  | 'view_logs';

export interface User {
  id: string;
  login: string;
  email: string;
  name: string;
  groupIds: string[];
  permissions?: Permission[];
}

export interface Wash {
  id: string;
  name: string;
  description?: string;
  address: string;
  registeredAt?: string;
  cloudEnabled?: boolean;
}

export interface Post {
  id: string;
  washId: string;
  postNumber: number;
  name: string;
  serialNumber: string;
  status: 'online' | 'offline' | 'error' | 'maintenance';
  settings?: Record<string, unknown>;
}

export interface PostState {
  id: string;
  postId: string;
  washId: string;
  mode?: string;
  modeName?: string;
  modeNumber?: number;
  freePause?: number;
  paidPause?: number;
  modeTime?: number;
  equipmentState?: Record<string, unknown>;
  lastMessageAt?: string;
  connected?: boolean;
}

export interface Card {
  id: string;
  cardNumber: string;
  cardType: 'regular' | 'unlimited' | 'service';
  balance: number;
  discount: number;
  status: string;
  washId?: string;
  postId?: string;
}

export interface UsageStat {
  id: string;
  washId: string;
  postId?: string;
  period: 'before_collection' | 'after_collection';
  category: 'regular' | 'unlimited' | 'service';
  launchCount: number;
  usageTime: number;
  avgWashTime: number;
  clientCount: number;
  recordedAt?: string;
}

export interface FinanceStat {
  id: string;
  washId: string;
  postId?: string;
  period: 'before_collection' | 'after_collection';
  cash: number;
  cashless: number;
  discountOps: number;
  totalRevenue: number;
  avgCheck: number;
  recordedAt?: string;
}

export interface CrmSetting {
  id: string;
  key: string;
  value: Record<string, unknown>;
}

export interface Notification {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'error';
  washId?: string;
  postId?: string;
  message: string;
  read: boolean;
  channels?: string[];
  createdAt?: string;
}

export interface BackupRecord {
  id: string;
  filename: string;
  size?: number;
  type: 'manual' | 'auto';
  status: 'completed' | 'failed' | 'in_progress';
  createdAt?: string;
  error?: string;
}

export interface ArchiveLog {
  id: string;
  action: string;
  recordsAffected: number;
  policyDays: number;
  createdAt?: string;
  details?: Record<string, unknown>;
}

export interface Paginated<T> {
  data: T[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface LogEntry {
  id: string;
  action: string;
  message: string;
  statusCode?: number;
  createdAt: string;
  ip?: string;
}
