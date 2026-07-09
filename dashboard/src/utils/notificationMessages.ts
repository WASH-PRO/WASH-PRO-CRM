import type { Notification } from '../types';
import type { TranslateParams } from '../i18n/runtime';
import { getNotificationTypeLabels } from './notificationSettings';

export type TranslateFn = (key: string, params?: TranslateParams) => string;

const RU_ENTITY_TO_KEY: Record<string, string> = {
  автомойка: 'wash',
  пост: 'post',
  настройки: 'settings',
  валюта: 'currency',
  'тип скидки': 'discountType',
  'режим работы': 'workMode',
  карта: 'card',
  'резервная копия': 'backup',
  архивирование: 'archive',
  'запись crm': 'crmRecord',
};

const RU_ACTION_TO_KEY: Record<string, string> = {
  'создан(а)': 'created',
  'изменён(а)': 'updated',
  'удалён(а)': 'deleted',
};

const RU_ARCHIVE_GROUP_TO_KEY: Record<string, string> = {
  карты: 'cards',
  'состояния постов': 'postStates',
  'статистика использования': 'usageStats',
  'финансовая статистика': 'financeStats',
};

const RU_CREDIT_METHOD_TO_KEY: Record<string, string> = {
  наличные: 'cash',
  безнал: 'cashless',
  скидка: 'discount',
};

const EN_CREDIT_METHOD_TO_KEY: Record<string, string> = {
  cash: 'cash',
  cashless: 'cashless',
  discount: 'discount',
};

const MUTATION_TYPES = new Set([
  'wash_created',
  'wash_updated',
  'wash_deleted',
  'post_created',
  'post_updated',
  'post_deleted',
  'settings_updated',
  'currency_created',
  'currency_updated',
  'currency_deleted',
  'discount_type_updated',
  'work_mode_updated',
  'card_created',
  'card_updated',
  'card_deleted',
  'archive_success',
  'backup_success',
]);

function localizedEntity(t: TranslateFn, entityKey: string): string {
  const key = `notifications.entities.${entityKey}`;
  const label = t(key);
  return label === key ? entityKey : label;
}

function localizedAction(t: TranslateFn, actionKey: string): string {
  const key = `notifications.actions.${actionKey}`;
  const label = t(key);
  return label === key ? actionKey : label;
}

function localizedCreditMethod(t: TranslateFn, methodKey: string, raw?: string): string {
  if (methodKey === 'unknown' && raw) {
    const match = raw.match(/тип\s+(\d+)/i) || raw.match(/type\s+(\d+)/i);
    if (match) return t('notifications.creditMethods.unknown', { type: match[1] });
    return raw;
  }
  if (methodKey) {
    const key = `notifications.creditMethods.${methodKey}`;
    const label = t(key);
    if (label !== key) return label;
  }
  return raw ?? '';
}

function localizedArchiveGroup(t: TranslateFn, groupKey: string, raw?: string): string {
  const key = `notifications.archiveGroups.${groupKey}`;
  const label = t(key);
  return label === key ? (raw ?? groupKey) : label;
}

function localizedActor(t: TranslateFn, actor: string): string {
  if (actor === 'Система' || actor.toLowerCase() === 'system') {
    return t('notifications.actors.system');
  }
  return actor;
}

function formatEmailPart(email?: string): string {
  return email ? ` (${email})` : '';
}

function parseMutation(message: string): {
  entityKey: string;
  actionKey: string;
  actor: string;
  detail: string;
} | null {
  const ru = message.match(/^(.+?)\s+(создан\(а\)|изменён\(а\)|удалён\(а\))\s+\((.+)\)$/i);
  if (ru) {
    const entityKey = RU_ENTITY_TO_KEY[ru[1].trim().toLowerCase()] ?? 'crmRecord';
    const actionKey = RU_ACTION_TO_KEY[ru[2].trim().toLowerCase()] ?? 'updated';
    const inner = ru[3].trim();
    const actorDetail = inner.match(/^([^:,]+?)(?::\s*(.+))?$/);
    const actor = actorDetail?.[1]?.trim() ?? inner;
    const detail = actorDetail?.[2] ? `: ${actorDetail[2].trim()}` : '';
    return { entityKey, actionKey, actor, detail };
  }

  const en = message.match(/^(\w[\w\s-]*?)\s+(created|updated|deleted)\s+\((.+)\)$/i);
  if (en) {
    const entityName = en[1].trim().toLowerCase();
    const entityKey =
      entityName === 'user'
        ? 'user'
        : entityName === 'car wash' || entityName === 'wash'
          ? 'wash'
          : entityName === 'post'
            ? 'post'
            : 'crmRecord';
    return {
      entityKey,
      actionKey: en[2].toLowerCase(),
      actor: en[3].trim(),
      detail: '',
    };
  }

  return null;
}

function parseCreditMethod(raw: string): { methodKey: string; label: string } {
  const normalized = raw.trim().toLowerCase();
  const ruKey = RU_CREDIT_METHOD_TO_KEY[normalized];
  if (ruKey) return { methodKey: ruKey, label: raw };
  const enKey = EN_CREDIT_METHOD_TO_KEY[normalized];
  if (enKey) return { methodKey: enKey, label: raw };
  const typeMatch = normalized.match(/^тип\s+(\d+)$/);
  if (typeMatch) return { methodKey: 'unknown', label: raw };
  return { methodKey: '', label: raw };
}

interface ParsedMessage {
  template: string;
  params?: TranslateParams;
}

function parseNotificationMessage(notification: Notification): ParsedMessage | null {
  const { type, message } = notification;
  const msg = (message ?? '').trim();
  if (!msg) return null;

  switch (type) {
    case 'connection_lost':
      return { template: 'connectionLost' };
    case 'queue_overflow':
      return { template: 'queueOverflow' };
    case 'equipment_error':
      return { template: 'equipmentError', params: { details: msg } };
    case 'mqtt_credit': {
      const ru = msg.match(/^Зачисление\s+([\d.,]+)\s*₽?\s*\((.+)\)$/i);
      if (ru) {
        const method = parseCreditMethod(ru[2]);
        return { template: 'mqttCredit', params: { amount: ru[1], methodKey: method.methodKey, methodRaw: method.label } };
      }
      const en = msg.match(/^Credit\s+([\d.,]+)\s*\((.+)\)$/i);
      if (en) {
        const method = parseCreditMethod(en[2]);
        return { template: 'mqttCredit', params: { amount: en[1], methodKey: method.methodKey, methodRaw: method.label } };
      }
      return { template: 'mqttCredit', params: { amount: msg, methodKey: '', methodRaw: '' } };
    }
    case 'mqtt_collection': {
      const withCard = msg.match(/^Инкассация на посте\s*\(карта\s+(.+)\)$/i);
      if (withCard) return { template: 'mqttCollectionWithCard', params: { card: withCard[1] } };
      if (/инкассация/i.test(msg) || /collection/i.test(msg)) {
        return { template: 'mqttCollection' };
      }
      return null;
    }
    case 'user_login': {
      const ru = msg.match(/^Вход в систему:\s*(.+?)(?:\s*\((.+)\))?$/);
      if (ru) return { template: 'userLogin', params: { login: ru[1].trim(), email: ru[2]?.trim() ?? '' } };
      const en = msg.match(/^User\s+(.+?)\s+logged in$/i);
      if (en) return { template: 'userLogin', params: { login: en[1].trim(), email: '' } };
      return null;
    }
    case 'user_logout': {
      const ru = msg.match(/^Выход из системы\s*\(userId:\s*(.+)\)$/i);
      if (ru) return { template: 'userLogout', params: { userId: ru[1].trim() } };
      if (/logged out/i.test(msg)) return { template: 'userLogout', params: { userId: '' } };
      return null;
    }
    case 'user_password_changed': {
      const ru = msg.match(/^Изменён пароль пользователя:\s*(.+)$/i);
      if (ru) return { template: 'userPasswordChanged', params: { login: ru[1].trim() } };
      return null;
    }
    case 'user_created': {
      const ru = msg.match(/^Создан пользователь:\s*(.+?)(?:\s*\((.+)\))?$/i);
      if (ru) return { template: 'userCreated', params: { login: ru[1].trim(), email: ru[2]?.trim() ?? '' } };
      const en = msg.match(/^User\s+(.+?)\s+created$/i);
      if (en) return { template: 'userCreated', params: { login: en[1].trim(), email: '' } };
      return null;
    }
    case 'user_updated': {
      const ru = msg.match(/^Изменён пользователь:\s*(.+)$/i);
      if (ru) return { template: 'userUpdated', params: { login: ru[1].trim() } };
      const en = msg.match(/^User\s+(.+?)\s+updated$/i);
      if (en) return { template: 'userUpdated', params: { login: en[1].trim() } };
      return null;
    }
    case 'user_deleted': {
      const ru = msg.match(/^Удалён пользователь:\s*(.+)$/i);
      if (ru) return { template: 'userDeleted', params: { login: ru[1].trim() } };
      const en = msg.match(/^User\s+(.+?)\s+deleted$/i);
      if (en) return { template: 'userDeleted', params: { login: en[1].trim() } };
      return null;
    }
    case 'backup_success': {
      const completed = msg.match(
        /^(?:Резервное копирование выполнено|Backup completed):\s*(.+?)\s*\((\d+)\s*(?:байт|bytes)\)$/i
      );
      if (completed) {
        return { template: 'backupCompleted', params: { filename: completed[1], size: completed[2] } };
      }
      const status = msg.match(/^Резервное копирование:\s*статус\s+(.+?)(?::\s*(.+))?$/i);
      if (status) {
        return {
          template: 'backupStatus',
          params: { status: status[1].trim(), detail: status[2] ? `: ${status[2].trim()}` : '' },
        };
      }
      return null;
    }
    case 'auto_backup': {
      const auto = msg.match(
        /^(?:Автоматическое резервное копирование выполнено|Automatic backup completed):\s*(.+?)\s*\((\d+)\s*(?:байт|bytes)\)$/i
      );
      if (auto) return { template: 'autoBackupCompleted', params: { filename: auto[1], size: auto[2] } };
      return null;
    }
    case 'backup_error': {
      const ru = msg.match(/^Ошибка резервного копирования(?::\s*(.+?))?:\s*(.+)$/i);
      if (ru) {
        return {
          template: 'backupError',
          params: { detail: ru[1] ? `: ${ru[1].trim()}` : '', error: ru[2].trim() },
        };
      }
      const en = msg.match(/^Backup error(?::\s*(.+?))?:\s*(.+)$/i);
      if (en) {
        return {
          template: 'backupError',
          params: { detail: en[1] ? `: ${en[1].trim()}` : '', error: en[2].trim() },
        };
      }
      return { template: 'backupError', params: { detail: '', error: msg } };
    }
    case 'auto_archive': {
      const telemetry = msg.match(
        /^Автоархивирование:\s*удалено\s*(\d+)\s*записей телеметрии\s*\(политика\s*(\d+)\s*дн\.\)$/i
      );
      if (telemetry) {
        return { template: 'archiveTelemetry', params: { count: telemetry[1], days: telemetry[2] } };
      }
      const group = msg.match(/^Автоархивирование\s*\((.+?)\):\s*(\d+)\s*записей(.*)$/i);
      if (group) {
        const groupKey = RU_ARCHIVE_GROUP_TO_KEY[group[1].trim().toLowerCase()] ?? '';
        const tail = group[3] ?? '';
        const filename = tail.match(/,\s*файл\s+([^,]+)/i)?.[1]?.trim() ?? '';
        const deleted = /исходные данные удалены/i.test(tail);
        return {
          template: 'archiveGroup',
          params: {
            groupKey,
            groupRaw: group[1].trim(),
            count: group[2],
            filename,
            deleted: deleted ? '1' : '0',
          },
        };
      }
      return null;
    }
    case 'archive_error': {
      const ru = msg.match(/^Ошибка автоархивирования(?:\s*\((.+?)\))?:\s*(.+)$/i);
      if (ru) {
        const groupKey = ru[1] ? RU_ARCHIVE_GROUP_TO_KEY[ru[1].trim().toLowerCase()] ?? '' : '';
        return {
          template: 'archiveError',
          params: { groupKey, groupRaw: ru[1]?.trim() ?? '', error: ru[2].trim() },
        };
      }
      return { template: 'archiveError', params: { groupKey: '', groupRaw: '', error: msg } };
    }
    case 'telegram_bot_created': {
      const ru = msg.match(/^Создан Telegram-бот:\s*(.+)$/i);
      if (ru) return { template: 'telegramBotCreated', params: { name: ru[1].trim() } };
      const en = msg.match(/^Telegram bot created:\s*(.+)$/i);
      if (en) return { template: 'telegramBotCreated', params: { name: en[1].trim() } };
      return null;
    }
    case 'telegram_bot_error': {
      const ru = msg.match(/^Ошибка создания Telegram-бота:\s*(.+)$/i);
      if (ru) return { template: 'telegramBotError', params: { error: ru[1].trim() } };
      const en = msg.match(/^Telegram bot creation error:\s*(.+)$/i);
      if (en) return { template: 'telegramBotError', params: { error: en[1].trim() } };
      return { template: 'telegramBotError', params: { error: msg } };
    }
    default:
      break;
  }

  if (MUTATION_TYPES.has(type)) {
    const mutation = parseMutation(msg);
    if (mutation) {
      return {
        template: 'mutation',
        params: {
          entityKey: mutation.entityKey,
          actionKey: mutation.actionKey,
          actor: mutation.actor,
          detail: mutation.detail,
        },
      };
    }
  }

  return null;
}

function renderParsedMessage(parsed: ParsedMessage, t: TranslateFn): string {
  const { template, params = {} } = parsed;

  switch (template) {
    case 'mqttCredit':
      return t('notifications.messages.mqttCredit', {
        amount: String(params.amount ?? ''),
        method: localizedCreditMethod(t, String(params.methodKey ?? ''), String(params.methodRaw ?? '')),
      });
    case 'mutation':
      return t('notifications.messages.mutation', {
        entity: localizedEntity(t, String(params.entityKey ?? 'crmRecord')),
        action: localizedAction(t, String(params.actionKey ?? 'updated')),
        actor: localizedActor(t, String(params.actor ?? '')),
        detail: String(params.detail ?? ''),
      });
    case 'userLogin':
      return t('notifications.messages.userLogin', {
        login: String(params.login ?? ''),
        emailPart: formatEmailPart(String(params.email ?? '')),
      });
    case 'userCreated':
      return t('notifications.messages.userCreated', {
        login: String(params.login ?? ''),
        emailPart: formatEmailPart(String(params.email ?? '')),
      });
    case 'userLogout':
      return t('notifications.messages.userLogout', {
        userIdPart: params.userId ? ` (userId: ${String(params.userId)})` : '',
      });
    case 'archiveGroup': {
      const filePart = params.filename
        ? t('notifications.messages.archiveGroupFilePart', { filename: String(params.filename) })
        : '';
      const deletePart =
        params.deleted === '1' ? t('notifications.messages.archiveGroupDeletePart') : '';
      return t('notifications.messages.archiveGroup', {
        group: localizedArchiveGroup(t, String(params.groupKey ?? ''), String(params.groupRaw ?? '')),
        count: String(params.count ?? ''),
        filePart,
        deletePart,
      });
    }
    case 'archiveError': {
      const groupPart = params.groupRaw
        ? t('notifications.messages.archiveErrorGroupPart', {
            group: localizedArchiveGroup(t, String(params.groupKey ?? ''), String(params.groupRaw ?? '')),
          })
        : '';
      return t('notifications.messages.archiveError', {
        groupPart,
        error: String(params.error ?? ''),
      });
    }
    case 'backupError':
      return t('notifications.messages.backupError', {
        detail: String(params.detail ?? ''),
        error: String(params.error ?? ''),
      });
    default:
      return t(`notifications.messages.${template}`, params as TranslateParams);
  }
}

export function formatNotificationMessage(notification: Notification, t: TranslateFn): string {
  const parsed = parseNotificationMessage(notification);
  if (parsed) {
    const rendered = renderParsedMessage(parsed, t);
    const key = `notifications.messages.${parsed.template}`;
    if (rendered !== key) return rendered;
  }

  const typeKey = `notifications.messages.${notification.type}`;
  const byType = t(typeKey);
  if (byType !== typeKey) return byType;

  const typeLabels = getNotificationTypeLabels(t);
  return typeLabels[notification.type] ?? notification.type;
}

export function getNotificationSeverityLabel(severity: string | undefined, t: TranslateFn): string {
  switch (severity) {
    case 'error':
      return t('status.error');
    case 'warning':
      return t('notificationsTable.warning');
    case 'info':
      return t('notificationsTable.info');
    default:
      return severity ?? '';
  }
}
