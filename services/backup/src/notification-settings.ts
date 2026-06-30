type NotificationEventKey = 'connectionLost' | 'equipmentError' | 'queueOverflow' | 'backupError';

export interface NotificationSettingsValue {
  telegram: boolean;
  web: boolean;
  events: Partial<Record<NotificationEventKey, boolean>>;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettingsValue = {
  telegram: true,
  web: true,
  events: {
    connectionLost: true,
    equipmentError: true,
    queueOverflow: true,
    backupError: true,
  },
};

export const NOTIFICATION_TYPE_TO_EVENT: Record<string, NotificationEventKey> = {
  connection_lost: 'connectionLost',
  equipment_error: 'equipmentError',
  queue_overflow: 'queueOverflow',
  backup_error: 'backupError',
};

export function normalizeNotificationSettings(raw: unknown): NotificationSettingsValue {
  if (!raw || typeof raw !== 'object') return DEFAULT_NOTIFICATION_SETTINGS;
  const v = raw as Record<string, unknown>;
  const events = (v.events as Record<string, unknown>) ?? {};
  return {
    telegram: v.telegram !== false,
    web: v.web !== false,
    events: {
      connectionLost: events.connectionLost !== false,
      equipmentError: events.equipmentError !== false,
      queueOverflow: events.queueOverflow !== false,
      backupError: events.backupError !== false,
    },
  };
}

export function channelsFromSettings(settings: NotificationSettingsValue): string[] {
  const channels: string[] = [];
  if (settings.web) channels.push('web');
  if (settings.telegram) channels.push('telegram');
  return channels;
}

export function isNotificationTypeEnabled(type: string, settings: NotificationSettingsValue): boolean {
  const eventKey = NOTIFICATION_TYPE_TO_EVENT[type];
  if (!eventKey) return true;
  return settings.events[eventKey] !== false;
}
