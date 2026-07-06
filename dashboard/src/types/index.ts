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
  _id?: string;
  login: string;
  email: string;
  name: string;
  groupIds: string[];
  permissions?: Permission[];
}

export interface DapUser {
  id?: string;
  _id?: string;
  login: string;
  email: string;
  name: string;
  status: 'active' | 'inactive' | 'suspended';
  groupIds: string[];
  createdAt?: string;
  lastLoginAt?: string;
}

export interface DapGroup {
  id?: string;
  _id?: string;
  name: string;
  description?: string;
  permissions: Permission[];
  isSystem?: boolean;
}

export interface Wash {
  id: string;
  name: string;
  description?: string;
  address: string;
  registeredAt?: string;
  createdAt?: string;
  cloudEnabled?: boolean;
}

export type WashRef = string | Wash;

export interface PostRef {
  id?: string;
  _id?: string;
  postNumber?: number;
  name?: string;
  washId?: WashRef;
}

export type PostIdRef = string | PostRef;

export interface Post {
  id: string;
  washId: WashRef;
  postNumber: number;
  name: string;
  serialNumber: string;
  settings?: PostSettings;
  createdAt?: string;
}

export interface PostSettings {
  firmwareVersion?: string;
  warrantyUntil?: string;
  maintenance?: string;
  features?: string;
  /** Префикс MQTT топика (dt_pref), по умолчанию washpro */
  mqttPrefix?: string;
  /** Логин MQTT для панели (rm_login) */
  mqttLogin?: string;
  /** Пароль MQTT для панели (rm_pass) */
  mqttPassword?: string;
  /** Цены режимов: ключ — код режима (0–9) */
  modePrices?: Record<string, number>;
  pricesUpdatedAt?: string;
  pricesSyncedAt?: string;
  lastCommand?: string;
  lastCommandAt?: string;
}

export interface PostState {
  id: string;
  postId?: PostIdRef;
  recordedAt?: string;
  lastMessageAt?: string;
  createdAt?: string;
  washId?: WashRef;
  mode?: string;
  modeName?: string;
  modeNumber?: number;
  freePause?: number;
  paidPause?: number;
  balance?: number;
  discount?: number;
  modeTime?: number;
  equipmentState?: Record<string, unknown>;
  connected?: boolean;
}

export type CardStatus = 'success' | 'rejected';

export interface Card {
  id: string;
  cardNumber: string;
  cardType: 'regular' | 'unlimited' | 'service' | 'collection';
  balance: number;
  discount: number;
  discountType?: string;
  status: CardStatus;
  washId?: WashRef;
  postId?: PostIdRef;
  createdAt?: string;
  validFrom?: string;
  validUntil?: string;
}

export interface ArchiveGroupSettings {
  enabled: boolean;
  autoRun: boolean;
  saveArchive: boolean;
  deleteAfter: boolean;
  retentionDays: number;
  policy: string;
}

export interface ArchiveSettings {
  retentionDays?: number;
  autoArchive?: boolean;
  autoDelete?: boolean;
  cards?: ArchiveGroupSettings;
  postStates?: ArchiveGroupSettings;
  usageStats?: ArchiveGroupSettings;
  financeStats?: ArchiveGroupSettings;
}

export interface UsageStat {
  id: string;
  washId: WashRef | string;
  postId?: PostIdRef | string;
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
  washId: WashRef | string;
  postId?: PostIdRef | string;
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

export interface BackupSettings {
  enabled: boolean;
  cron: string;
  retentionCount: number;
  storagePath?: string;
}

export interface TelegramCrmSettings {
  token: string;
  adminIds: number[];
  allowedCommands: string[];
  enabled: boolean;
}

export interface NotificationSettings {
  telegram: boolean;
  web: boolean;
  events: {
    connectionLost?: boolean;
    equipmentError?: boolean;
    queueOverflow?: boolean;
    backupSuccess?: boolean;
    backupError?: boolean;
    archiveSuccess?: boolean;
    archiveError?: boolean;
    telegramBotCreated?: boolean;
    telegramBotError?: boolean;
    userLogin?: boolean;
    userLogout?: boolean;
    userPasswordChanged?: boolean;
    userCreated?: boolean;
    userUpdated?: boolean;
    userDeleted?: boolean;
    washCreated?: boolean;
    washUpdated?: boolean;
    washDeleted?: boolean;
    postCreated?: boolean;
    postUpdated?: boolean;
    postDeleted?: boolean;
    settingsUpdated?: boolean;
    currencyCreated?: boolean;
    currencyUpdated?: boolean;
    currencyDeleted?: boolean;
    discountTypeUpdated?: boolean;
    workModeUpdated?: boolean;
    cardCreated?: boolean;
    cardUpdated?: boolean;
    cardDeleted?: boolean;
    autoTask?: boolean;
  };
}

export interface PyOrchestratorCrmSettings {
  email: string;
  password: string;
  panelPort: number;
}

export interface DynamicApiCrmSettings {
  serviceLogin: string;
  servicePassword: string;
  apiBaseUrl: string;
}

export interface Currency {
  id: string;
  code: string;
  name: string;
  symbol: string;
  isDefault: boolean;
  createdAt?: string;
}

export type DiscountTypeStatus = 'active' | 'inactive';

export interface DiscountType {
  id: string;
  code: string;
  name: string;
  status?: DiscountTypeStatus;
  createdAt?: string;
}

export type WorkModeStatus = 'active' | 'inactive';
export type WorkModeType = 'system' | 'user';

export interface WorkMode {
  id: string;
  code: string;
  name: string;
  modeType?: WorkModeType;
  status?: WorkModeStatus;
  createdAt?: string;
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
  filename?: string;
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
  source?: string;
}
