import fetch from 'node-fetch';
import { endpointDataRepository, endpointRepository } from '../repositories';
import { getCollectionPath } from '../utils';
import type { JwtPayload } from '../types';

type NotifySeverity = 'info' | 'warning' | 'error';

interface NotifyInput {
  type: string;
  severity: NotifySeverity;
  message: string;
  washId?: string;
  postId?: string;
}

interface NotificationSettings {
  telegram: boolean;
  web: boolean;
  events: Record<string, boolean>;
}

const TYPE_TO_EVENT: Record<string, string> = {
  connection_lost: 'connectionLost',
  equipment_error: 'equipmentError',
  queue_overflow: 'queueOverflow',
  backup_success: 'backupSuccess',
  backup_error: 'backupError',
  archive_success: 'archiveSuccess',
  archive_error: 'archiveError',
  telegram_bot_created: 'telegramBotCreated',
  telegram_bot_error: 'telegramBotError',
  user_login: 'userLogin',
  user_logout: 'userLogout',
  user_password_changed: 'userPasswordChanged',
  user_created: 'userCreated',
  user_updated: 'userUpdated',
  user_deleted: 'userDeleted',
  wash_created: 'washCreated',
  wash_updated: 'washUpdated',
  wash_deleted: 'washDeleted',
  post_created: 'postCreated',
  post_updated: 'postUpdated',
  post_deleted: 'postDeleted',
  settings_updated: 'settingsUpdated',
  currency_created: 'currencyCreated',
  currency_updated: 'currencyUpdated',
  currency_deleted: 'currencyDeleted',
  discount_type_updated: 'discountTypeUpdated',
  work_mode_updated: 'workModeUpdated',
  card_created: 'cardCreated',
  card_updated: 'cardUpdated',
  card_deleted: 'cardDeleted',
  auto_backup: 'autoTask',
  auto_archive: 'autoTask',
  mqtt_credit: 'mqttCredit',
  mqtt_collection: 'mqttCollection',
};

const DEFAULT_EVENTS: Record<string, boolean> = {
  connectionLost: false,
  equipmentError: false,
  queueOverflow: true,
  backupSuccess: true,
  backupError: true,
  archiveSuccess: true,
  archiveError: true,
  telegramBotCreated: true,
  telegramBotError: true,
  userLogin: true,
  userLogout: true,
  userPasswordChanged: true,
  userCreated: true,
  userUpdated: true,
  userDeleted: true,
  washCreated: true,
  washUpdated: true,
  washDeleted: true,
  postCreated: true,
  postUpdated: true,
  postDeleted: true,
  settingsUpdated: true,
  currencyCreated: true,
  currencyUpdated: true,
  currencyDeleted: true,
  discountTypeUpdated: true,
  workModeUpdated: true,
  cardCreated: true,
  cardUpdated: true,
  cardDeleted: true,
  autoTask: true,
  mqttCredit: false,
  mqttCollection: false,
};

const EXCLUDED_NOTIFY_PREFIXES = [
  '/api/crm/telemetry',
  '/api/crm/post-states',
  '/api/crm/usage-stats',
  '/api/crm/finance-stats',
  '/api/crm/notifications',
];

function normalizeSettings(raw: unknown): NotificationSettings {
  if (!raw || typeof raw !== 'object') {
    return { telegram: true, web: true, events: { ...DEFAULT_EVENTS } };
  }
  const v = raw as Record<string, unknown>;
  const eventsRaw = (v.events as Record<string, unknown>) ?? {};
  const events: Record<string, boolean> = { ...DEFAULT_EVENTS };
  for (const key of Object.keys(DEFAULT_EVENTS)) {
    if (eventsRaw[key] !== undefined) events[key] = eventsRaw[key] !== false;
  }
  return {
    telegram: v.telegram !== false,
    web: v.web !== false,
    events,
  };
}

async function loadNotificationSettings(): Promise<NotificationSettings> {
  const page = await endpointDataRepository.findByPath('/api/crm/settings', 1, 50);
  const row = page.data.find((item) => item.data?.key === 'notifications');
  return normalizeSettings(row?.data?.value);
}

function isTypeEnabled(type: string, settings: NotificationSettings): boolean {
  const eventKey = TYPE_TO_EVENT[type];
  if (!eventKey) return false;
  return settings.events[eventKey] !== false;
}

function channels(settings: NotificationSettings): string[] {
  const result: string[] = [];
  if (settings.web) result.push('web');
  if (settings.telegram) result.push('telegram');
  return result;
}

async function loadTelegramSettings(): Promise<{ token: string; adminIds: number[]; enabled: boolean }> {
  const page = await endpointDataRepository.findByPath('/api/crm/settings', 1, 50);
  const row = page.data.find((item) => item.data?.key === 'telegram');
  const value = (row?.data?.value ?? {}) as Record<string, unknown>;
  return {
    token: String(value.token ?? ''),
    adminIds: Array.isArray(value.adminIds) ? value.adminIds.map((id) => Number(id)).filter((id) => !Number.isNaN(id)) : [],
    enabled: value.enabled === true,
  };
}

export async function dispatchTelegram(message: string): Promise<void> {
  const telegram = await loadTelegramSettings();
  if (!telegram.enabled || !telegram.token || telegram.adminIds.length === 0) return;

  const text = message.length > 4000 ? `${message.slice(0, 3997)}...` : message;
  for (const chatId of telegram.adminIds) {
    try {
      await fetch(`https://api.telegram.org/bot${telegram.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      });
    } catch {
      // best effort
    }
  }
}

async function findNotificationsEndpointId(): Promise<string | null> {
  const endpoint = await endpointRepository.findByPathAndMethod('/api/crm/notifications', 'POST');
  return endpoint?._id.toString() ?? null;
}

export async function createWashNotification(input: NotifyInput): Promise<void> {
  const settings = await loadNotificationSettings();
  if (!isTypeEnabled(input.type, settings)) return;

  const deliveryChannels = channels(settings);
  if (!deliveryChannels.length) return;

  if (deliveryChannels.includes('web')) {
    const endpointId = await findNotificationsEndpointId();
    if (!endpointId) return;

    await endpointDataRepository.create(
      endpointId,
      '/api/crm/notifications',
      {
        type: input.type,
        severity: input.severity,
        message: input.message,
        washId: input.washId,
        postId: input.postId,
        read: false,
        channels: deliveryChannels,
        createdAt: new Date().toISOString(),
      }
    );
  }

  if (deliveryChannels.includes('telegram')) {
    const prefix = input.severity === 'error' ? '🔴' : input.severity === 'warning' ? '🟡' : 'ℹ️';
    await dispatchTelegram(`${prefix} ${input.message}`);
  }
}

export function shouldNotifyCrmMutation(method: string, path: string): boolean {
  if (method === 'GET') return false;
  const normalized = path.replace(/\/[a-f0-9]{24}$/i, '');
  if (!normalized.startsWith('/api/crm/')) return false;
  if (normalized === '/api/crm/backups' || normalized.startsWith('/api/crm/backups/')) return false;
  return !EXCLUDED_NOTIFY_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

function actorLabel(user?: JwtPayload): string {
  if (!user?.login) return 'Система';
  return user.login;
}

function entityLabel(path: string): string {
  if (path.includes('/washes')) return 'автомойка';
  if (path.includes('/posts')) return 'пост';
  if (path.includes('/settings')) return 'настройки';
  if (path.includes('/currencies')) return 'валюта';
  if (path.includes('/discount-types')) return 'тип скидки';
  if (path.includes('/work-modes')) return 'режим работы';
  if (path.includes('/cards')) return 'карта';
  if (path.includes('/backups')) return 'резервная копия';
  if (path.includes('/archive-logs')) return 'архивирование';
  return 'запись CRM';
}

function actionVerb(method: string): string {
  if (method === 'POST') return 'создан(а)';
  if (method === 'PUT' || method === 'PATCH') return 'изменён(а)';
  if (method === 'DELETE') return 'удалён(а)';
  return 'изменён(а)';
}

function resolveNotifyType(method: string, path: string): string {
  const base = getCollectionPath(path);
  const map: Record<string, Record<string, string>> = {
    '/api/crm/washes': { POST: 'wash_created', PUT: 'wash_updated', PATCH: 'wash_updated', DELETE: 'wash_deleted' },
    '/api/crm/posts': { POST: 'post_created', PUT: 'post_updated', PATCH: 'post_updated', DELETE: 'post_deleted' },
    '/api/crm/settings': { PUT: 'settings_updated', PATCH: 'settings_updated' },
    '/api/crm/currencies': { POST: 'currency_created', PUT: 'currency_updated', PATCH: 'currency_updated', DELETE: 'currency_deleted' },
    '/api/crm/discount-types': { PUT: 'discount_type_updated', PATCH: 'discount_type_updated' },
    '/api/crm/work-modes': { PUT: 'work_mode_updated', PATCH: 'work_mode_updated' },
    '/api/crm/cards': { POST: 'card_created', PUT: 'card_updated', PATCH: 'card_updated', DELETE: 'card_deleted' },
    '/api/crm/backups': { POST: 'backup_success', PATCH: 'backup_success' },
    '/api/crm/archive-logs': { POST: 'archive_success' },
  };
  return map[base]?.[method] ?? 'settings_updated';
}

function buildMutationMessage(
  method: string,
  path: string,
  user?: JwtPayload,
  body?: unknown
): { type: string; severity: NotifySeverity; message: string } | null {
  const entity = entityLabel(path);
  const verb = actionVerb(method);
  const data = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  let detail = '';

  if (entity === 'автомойка' && typeof data.name === 'string') detail = `: ${data.name}`;
  if (entity === 'пост' && (data.name || data.serialNumber)) {
    detail = `: ${data.name ?? data.serialNumber}`;
  }
  if (entity === 'валюта' && typeof data.code === 'string') detail = `: ${data.code}`;
  if (entity === 'настройки' && typeof data.key === 'string') detail = `: ${data.key}`;
  if (entity === 'резервная копия' && typeof data.filename === 'string') detail = `: ${data.filename}`;
  if (entity === 'архивирование') {
    const affected = data.recordsAffected;
    const filename = data.filename;
    detail = typeof affected === 'number' ? `, записей: ${affected}` : '';
    if (typeof filename === 'string' && filename) detail += `, файл: ${filename}`;
  }

  const type = resolveNotifyType(method, path);
  const severity: NotifySeverity = type.includes('error') ? 'error' : 'info';

  if (type === 'backup_success' && data.status === 'failed') {
    return {
      type: 'backup_error',
      severity: 'error',
      message: `Ошибка резервного копирования${detail}: ${data.error ?? 'неизвестная ошибка'}`,
    };
  }

  if (type === 'backup_success' && data.status && data.status !== 'completed') {
    if (data.status === 'in_progress') {
      return null;
    }
    return {
      type: 'backup_success',
      severity: 'info',
      message: `Резервное копирование: статус ${String(data.status)}${detail}`,
    };
  }

  return {
    type,
    severity,
    message: `${entity.charAt(0).toUpperCase()}${entity.slice(1)} ${verb} (${actorLabel(user)}${detail})`,
  };
}

const INTERNAL_SERVICE_LOGINS = new Set(['service']);

export async function notifyCrmMutation(
  method: string,
  path: string,
  user?: JwtPayload,
  body?: unknown
): Promise<void> {
  if (!shouldNotifyCrmMutation(method, path)) return;
  if (user?.login && INTERNAL_SERVICE_LOGINS.has(user.login)) return;

  const base = getCollectionPath(path);
  if (base === '/api/crm/archive-logs' && method === 'POST') {
    const data = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const details = (data.details as Record<string, unknown> | undefined) ?? {};
    if (details.manual !== true) return;
  }

  const payload = buildMutationMessage(method, path, user, body);
  if (!payload) return;
  await createWashNotification(payload);
}

export async function notifyAuthEvent(
  type: 'user_login' | 'user_logout' | 'user_password_changed' | 'user_created' | 'user_updated' | 'user_deleted',
  message: string,
  severity: NotifySeverity = 'info'
): Promise<void> {
  await createWashNotification({ type, severity, message });
}
