export type NotificationEventKey =
  | 'connectionLost'
  | 'equipmentError'
  | 'queueOverflow'
  | 'backupSuccess'
  | 'backupError'
  | 'archiveSuccess'
  | 'archiveError'
  | 'telegramBotCreated'
  | 'telegramBotError'
  | 'userLogin'
  | 'userLogout'
  | 'userPasswordChanged'
  | 'userCreated'
  | 'userUpdated'
  | 'userDeleted'
  | 'washCreated'
  | 'washUpdated'
  | 'washDeleted'
  | 'postCreated'
  | 'postUpdated'
  | 'postDeleted'
  | 'settingsUpdated'
  | 'currencyCreated'
  | 'currencyUpdated'
  | 'currencyDeleted'
  | 'discountTypeUpdated'
  | 'workModeUpdated'
  | 'cardCreated'
  | 'cardUpdated'
  | 'cardDeleted'
  | 'autoTask'
  | 'mqttCredit'
  | 'mqttCollection';

export interface NotificationSettingsValue {
  telegram: boolean;
  web: boolean;
  events: Partial<Record<NotificationEventKey, boolean>>;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettingsValue = {
  telegram: true,
  web: true,
  events: {
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
  },
};

export const NOTIFICATION_TYPE_TO_EVENT: Record<string, NotificationEventKey> = {
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

export function normalizeNotificationSettings(raw: unknown): NotificationSettingsValue {
  if (!raw || typeof raw !== 'object') return DEFAULT_NOTIFICATION_SETTINGS;
  const v = raw as Record<string, unknown>;
  const events = (v.events as Record<string, unknown>) ?? {};
  const merged: Partial<Record<NotificationEventKey, boolean>> = {
    ...DEFAULT_NOTIFICATION_SETTINGS.events,
  };
  for (const key of Object.keys(DEFAULT_NOTIFICATION_SETTINGS.events) as NotificationEventKey[]) {
    if (events[key] !== undefined) merged[key] = events[key] !== false;
  }
  return {
    telegram: v.telegram !== false,
    web: v.web !== false,
    events: merged,
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
  if (!eventKey) return false;
  return settings.events[eventKey] !== false;
}
