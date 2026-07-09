import type { NotificationSettings } from '../types';
import { tGlobal } from '../i18n/runtime';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
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

export function getNotificationEventGroups(): {
  title: string;
  items: { key: keyof NonNullable<NotificationSettings['events']>; label: string }[];
}[] {
  return [
    {
      title: tGlobal('notifications.groups.system'),
      items: [
        { key: 'backupSuccess', label: tGlobal('notifications.events.backupSuccess') },
        { key: 'backupError', label: tGlobal('notifications.events.backupError') },
        { key: 'archiveSuccess', label: tGlobal('notifications.events.archiveSuccess') },
        { key: 'archiveError', label: tGlobal('notifications.events.archiveError') },
        { key: 'autoTask', label: tGlobal('notifications.events.autoTask') },
        { key: 'queueOverflow', label: tGlobal('notifications.events.queueOverflow') },
        { key: 'telegramBotCreated', label: tGlobal('notifications.events.telegramBotCreated') },
        { key: 'telegramBotError', label: tGlobal('notifications.events.telegramBotError') },
      ],
    },
    {
      title: tGlobal('notifications.groups.users'),
      items: [
        { key: 'userLogin', label: tGlobal('notifications.events.userLogin') },
        { key: 'userLogout', label: tGlobal('notifications.events.userLogout') },
        { key: 'userPasswordChanged', label: tGlobal('notifications.events.userPasswordChanged') },
        { key: 'userCreated', label: tGlobal('notifications.events.userCreated') },
        { key: 'userUpdated', label: tGlobal('notifications.events.userUpdated') },
        { key: 'userDeleted', label: tGlobal('notifications.events.userDeleted') },
      ],
    },
    {
      title: tGlobal('notifications.groups.references'),
      items: [
        { key: 'washCreated', label: tGlobal('notifications.events.washCreated') },
        { key: 'washUpdated', label: tGlobal('notifications.events.washUpdated') },
        { key: 'washDeleted', label: tGlobal('notifications.events.washDeleted') },
        { key: 'postCreated', label: tGlobal('notifications.events.postCreated') },
        { key: 'postUpdated', label: tGlobal('notifications.events.postUpdated') },
        { key: 'postDeleted', label: tGlobal('notifications.events.postDeleted') },
        { key: 'settingsUpdated', label: tGlobal('notifications.events.settingsUpdated') },
        { key: 'currencyCreated', label: tGlobal('notifications.events.currencyCreated') },
        { key: 'currencyUpdated', label: tGlobal('notifications.events.currencyUpdated') },
        { key: 'currencyDeleted', label: tGlobal('notifications.events.currencyDeleted') },
        { key: 'discountTypeUpdated', label: tGlobal('notifications.events.discountTypeUpdated') },
        { key: 'workModeUpdated', label: tGlobal('notifications.events.workModeUpdated') },
        { key: 'cardCreated', label: tGlobal('notifications.events.cardCreated') },
        { key: 'cardUpdated', label: tGlobal('notifications.events.cardUpdated') },
        { key: 'cardDeleted', label: tGlobal('notifications.events.cardDeleted') },
      ],
    },
    {
      title: tGlobal('notifications.groups.posts'),
      items: [
        { key: 'connectionLost', label: tGlobal('notifications.events.connectionLost') },
        { key: 'equipmentError', label: tGlobal('notifications.events.equipmentError') },
        { key: 'mqttCredit', label: tGlobal('notifications.events.mqttCredit') },
        { key: 'mqttCollection', label: tGlobal('notifications.events.mqttCollection') },
      ],
    },
  ];
}

export function getNotificationTypeLabels(): Record<string, string> {
  return {
    connection_lost: tGlobal('notifications.types.connectionLost'),
    equipment_error: tGlobal('notifications.types.equipmentError'),
    queue_overflow: tGlobal('notifications.types.queueOverflow'),
    backup_success: tGlobal('notifications.types.backupSuccess'),
    backup_error: tGlobal('notifications.types.backupError'),
    archive_success: tGlobal('notifications.types.archiveSuccess'),
    archive_error: tGlobal('notifications.types.archiveError'),
    telegram_bot_created: tGlobal('notifications.types.telegramBotCreated'),
    telegram_bot_error: tGlobal('notifications.types.telegramBotError'),
    user_login: tGlobal('notifications.types.userLogin'),
    user_logout: tGlobal('notifications.types.userLogout'),
    user_password_changed: tGlobal('notifications.types.userPasswordChanged'),
    user_created: tGlobal('notifications.types.userCreated'),
    user_updated: tGlobal('notifications.types.userUpdated'),
    user_deleted: tGlobal('notifications.types.userDeleted'),
    wash_created: tGlobal('notifications.types.washCreated'),
    wash_updated: tGlobal('notifications.types.washUpdated'),
    wash_deleted: tGlobal('notifications.types.washDeleted'),
    post_created: tGlobal('notifications.types.postCreated'),
    post_updated: tGlobal('notifications.types.postUpdated'),
    post_deleted: tGlobal('notifications.types.postDeleted'),
    settings_updated: tGlobal('notifications.types.settingsUpdated'),
    currency_created: tGlobal('notifications.types.currencyCreated'),
    currency_updated: tGlobal('notifications.types.currencyUpdated'),
    currency_deleted: tGlobal('notifications.types.currencyDeleted'),
    discount_type_updated: tGlobal('notifications.types.discountTypeUpdated'),
    work_mode_updated: tGlobal('notifications.types.workModeUpdated'),
    card_created: tGlobal('notifications.types.cardCreated'),
    card_updated: tGlobal('notifications.types.cardUpdated'),
    card_deleted: tGlobal('notifications.types.cardDeleted'),
    mqtt_credit: tGlobal('notifications.types.mqttCredit'),
    mqtt_collection: tGlobal('notifications.types.mqttCollection'),
    auto_backup: tGlobal('notifications.types.autoBackup'),
    auto_archive: tGlobal('notifications.types.autoArchive'),
  };
}

export function isWebNotification(notification: { channels?: string[] }): boolean {
  if (!notification.channels?.length) return true;
  return notification.channels.includes('web');
}

export function parseNotificationSettings(raw: Record<string, unknown>): NotificationSettings {
  const events = (raw.events as Record<string, unknown>) ?? {};
  const merged = { ...DEFAULT_NOTIFICATION_SETTINGS.events };
  for (const key of Object.keys(merged) as (keyof typeof merged)[]) {
    if (events[key] !== undefined) merged[key] = events[key] !== false;
  }
  return {
    telegram: raw.telegram !== false,
    web: raw.web !== false,
    events: merged,
  };
}
