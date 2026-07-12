import type { NotificationSettings } from '../types';
import { tGlobal, type TranslateParams } from '../i18n/runtime';

export type TranslateFn = (key: string, params?: TranslateParams) => string;

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
    softwareUpdateStarted: false,
    softwareUpdateSuccess: true,
    softwareUpdateFailed: true,
    moduleInstalled: true,
    moduleUninstalled: true,
    moduleStarted: true,
    moduleStopped: true,
    moduleUpdated: true,
    moduleError: true,
  },
};

export function getNotificationEventGroups(t: TranslateFn = tGlobal): {
  title: string;
  items: { key: keyof NonNullable<NotificationSettings['events']>; label: string }[];
}[] {
  return [
    {
      title: t('notifications.groups.system'),
      items: [
        { key: 'backupSuccess', label: t('notifications.events.backupSuccess') },
        { key: 'backupError', label: t('notifications.events.backupError') },
        { key: 'archiveSuccess', label: t('notifications.events.archiveSuccess') },
        { key: 'archiveError', label: t('notifications.events.archiveError') },
        { key: 'autoTask', label: t('notifications.events.autoTask') },
        { key: 'queueOverflow', label: t('notifications.events.queueOverflow') },
        { key: 'telegramBotCreated', label: t('notifications.events.telegramBotCreated') },
        { key: 'telegramBotError', label: t('notifications.events.telegramBotError') },
      ],
    },
    {
      title: t('notifications.groups.users'),
      items: [
        { key: 'userLogin', label: t('notifications.events.userLogin') },
        { key: 'userLogout', label: t('notifications.events.userLogout') },
        { key: 'userPasswordChanged', label: t('notifications.events.userPasswordChanged') },
        { key: 'userCreated', label: t('notifications.events.userCreated') },
        { key: 'userUpdated', label: t('notifications.events.userUpdated') },
        { key: 'userDeleted', label: t('notifications.events.userDeleted') },
      ],
    },
    {
      title: t('notifications.groups.references'),
      items: [
        { key: 'washCreated', label: t('notifications.events.washCreated') },
        { key: 'washUpdated', label: t('notifications.events.washUpdated') },
        { key: 'washDeleted', label: t('notifications.events.washDeleted') },
        { key: 'postCreated', label: t('notifications.events.postCreated') },
        { key: 'postUpdated', label: t('notifications.events.postUpdated') },
        { key: 'postDeleted', label: t('notifications.events.postDeleted') },
        { key: 'settingsUpdated', label: t('notifications.events.settingsUpdated') },
        { key: 'currencyCreated', label: t('notifications.events.currencyCreated') },
        { key: 'currencyUpdated', label: t('notifications.events.currencyUpdated') },
        { key: 'currencyDeleted', label: t('notifications.events.currencyDeleted') },
        { key: 'discountTypeUpdated', label: t('notifications.events.discountTypeUpdated') },
        { key: 'workModeUpdated', label: t('notifications.events.workModeUpdated') },
        { key: 'cardCreated', label: t('notifications.events.cardCreated') },
        { key: 'cardUpdated', label: t('notifications.events.cardUpdated') },
        { key: 'cardDeleted', label: t('notifications.events.cardDeleted') },
      ],
    },
    {
      title: t('notifications.groups.posts'),
      items: [
        { key: 'connectionLost', label: t('notifications.events.connectionLost') },
        { key: 'equipmentError', label: t('notifications.events.equipmentError') },
        { key: 'mqttCredit', label: t('notifications.events.mqttCredit') },
        { key: 'mqttCollection', label: t('notifications.events.mqttCollection') },
      ],
    },
    {
      title: t('notifications.groups.softwareUpdates'),
      items: [
        { key: 'softwareUpdateStarted', label: t('notifications.events.softwareUpdateStarted') },
        { key: 'softwareUpdateSuccess', label: t('notifications.events.softwareUpdateSuccess') },
        { key: 'softwareUpdateFailed', label: t('notifications.events.softwareUpdateFailed') },
      ],
    },
    {
      title: t('notifications.groups.modules'),
      items: [
        { key: 'moduleInstalled', label: t('notifications.events.moduleInstalled') },
        { key: 'moduleUninstalled', label: t('notifications.events.moduleUninstalled') },
        { key: 'moduleStarted', label: t('notifications.events.moduleStarted') },
        { key: 'moduleStopped', label: t('notifications.events.moduleStopped') },
        { key: 'moduleUpdated', label: t('notifications.events.moduleUpdated') },
        { key: 'moduleError', label: t('notifications.events.moduleError') },
      ],
    },
  ];
}

export function getNotificationTypeLabels(t: TranslateFn = tGlobal): Record<string, string> {
  return {
    connection_lost: t('notifications.types.connectionLost'),
    equipment_error: t('notifications.types.equipmentError'),
    queue_overflow: t('notifications.types.queueOverflow'),
    backup_success: t('notifications.types.backupSuccess'),
    backup_error: t('notifications.types.backupError'),
    archive_success: t('notifications.types.archiveSuccess'),
    archive_error: t('notifications.types.archiveError'),
    telegram_bot_created: t('notifications.types.telegramBotCreated'),
    telegram_bot_error: t('notifications.types.telegramBotError'),
    user_login: t('notifications.types.userLogin'),
    user_logout: t('notifications.types.userLogout'),
    user_password_changed: t('notifications.types.userPasswordChanged'),
    user_created: t('notifications.types.userCreated'),
    user_updated: t('notifications.types.userUpdated'),
    user_deleted: t('notifications.types.userDeleted'),
    wash_created: t('notifications.types.washCreated'),
    wash_updated: t('notifications.types.washUpdated'),
    wash_deleted: t('notifications.types.washDeleted'),
    post_created: t('notifications.types.postCreated'),
    post_updated: t('notifications.types.postUpdated'),
    post_deleted: t('notifications.types.postDeleted'),
    settings_updated: t('notifications.types.settingsUpdated'),
    currency_created: t('notifications.types.currencyCreated'),
    currency_updated: t('notifications.types.currencyUpdated'),
    currency_deleted: t('notifications.types.currencyDeleted'),
    discount_type_updated: t('notifications.types.discountTypeUpdated'),
    work_mode_updated: t('notifications.types.workModeUpdated'),
    card_created: t('notifications.types.cardCreated'),
    card_updated: t('notifications.types.cardUpdated'),
    card_deleted: t('notifications.types.cardDeleted'),
    mqtt_credit: t('notifications.types.mqttCredit'),
    mqtt_collection: t('notifications.types.mqttCollection'),
    auto_backup: t('notifications.types.autoBackup'),
    auto_archive: t('notifications.types.autoArchive'),
    software_update_started: t('notifications.types.softwareUpdateStarted'),
    software_update_success: t('notifications.types.softwareUpdateSuccess'),
    software_update_failed: t('notifications.types.softwareUpdateFailed'),
    module_installed: t('notifications.types.moduleInstalled'),
    module_uninstalled: t('notifications.types.moduleUninstalled'),
    module_started: t('notifications.types.moduleStarted'),
    module_stopped: t('notifications.types.moduleStopped'),
    module_updated: t('notifications.types.moduleUpdated'),
    module_error: t('notifications.types.moduleError'),
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
