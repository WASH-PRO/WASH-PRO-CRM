import { CheckCheck, Trash2 } from 'lucide-react';
import { api, apiListPage } from '../api/client';
import { Badge } from '../components/UI';
import type { DataTableBulkAction, DataTableColumn, DataTableFilter } from '../components/DataTable';
import { bulkDelete, bulkPatch } from './bulk';
import { createExportBulkAction } from './export';
import { formatDateTime } from './format';
import { formatNotificationMessage, getNotificationSeverityLabel, type TranslateFn } from './notificationMessages';
import { getNotificationTypeLabels, isWebNotification } from './notificationSettings';
import type { Notification } from '../types';
import { tGlobal } from '../i18n/runtime';

export const NOTIFICATIONS_PAGE_LIMIT = 100;
export const NOTIFICATIONS_DASHBOARD_LIMIT = 30;

export async function fetchNotificationsPages(
  pages: number,
  pageSize: number,
  signal?: AbortSignal
): Promise<{ items: Notification[]; total: number; hasMore: boolean }> {
  const all: Notification[] = [];
  let totalPages = 1;
  let total = 0;

  for (let page = 1; page <= pages; page++) {
    const { data, pagination } = await apiListPage<Notification>('/crm/notifications', page, pageSize, signal);
    all.push(...data.filter(isWebNotification));
    totalPages = pagination.totalPages;
    total = pagination.total;
  }

  const items = all.sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  return { items, total, hasMore: pages < totalPages };
}

export async function fetchRecentNotifications(
  limit: number,
  signal?: AbortSignal
): Promise<{ items: Notification[]; total: number }> {
  const { data, pagination } = await apiListPage<Notification>('/crm/notifications', 1, limit, signal);
  const items = [...data]
    .filter(isWebNotification)
    .sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  return { items, total: pagination.total };
}

export async function deleteAllNotifications(): Promise<number> {
  const result = await api<{ deleted: number }>('/crm/notifications', { method: 'DELETE' });
  return result.deleted ?? 0;
}

export async function countUnreadWebNotifications(signal?: AbortSignal): Promise<number> {
  const { items } = await fetchRecentNotifications(NOTIFICATIONS_PAGE_LIMIT, signal);
  return items.filter((n) => !n.read).length;
}

export function notificationFilters(t: TranslateFn = tGlobal, full = true): DataTableFilter<Notification>[] {
  const typeLabels = getNotificationTypeLabels(t);
  const filters: DataTableFilter<Notification>[] = [
    {
      id: 'read',
      label: t('common.status'),
      options: [
        { value: 'unread', label: t('notificationsTable.unread') },
        { value: 'read', label: t('notificationsTable.read') },
      ],
      match: (n, v) => (v === 'read' ? n.read : !n.read),
    },
  ];

  if (!full) return filters;

  return [
    ...filters,
    {
      id: 'severity',
      label: t('notificationsTable.severity'),
      options: [
        { value: 'error', label: t('status.error') },
        { value: 'warning', label: t('notificationsTable.warning') },
        { value: 'info', label: t('notificationsTable.info') },
      ],
      match: (n, v) => n.severity === v,
    },
    {
      id: 'type',
      label: t('notificationsTable.type'),
      options: Object.entries(typeLabels).map(([value, label]) => ({ value, label })),
      match: (n, v) => n.type === v,
    },
  ];
}

interface NotificationColumnOptions {
  onMarkRead: (id: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  compact?: boolean;
  canEdit?: boolean;
  t?: TranslateFn;
}

export function createNotificationColumns({
  onMarkRead,
  onDelete,
  compact = false,
  canEdit = true,
  t = tGlobal,
}: NotificationColumnOptions): DataTableColumn<Notification>[] {
  const typeLabels = getNotificationTypeLabels(t);
  const messageText = (n: Notification) => formatNotificationMessage(n, t);

  const columns: DataTableColumn<Notification>[] = [
    {
      key: 'type',
      header: t('notificationsTable.type'),
      sortable: true,
      searchValue: (n) => `${n.type} ${typeLabels[n.type] ?? ''}`,
      sortValue: (n) => n.type,
      render: (n) => typeLabels[n.type] ?? n.type,
    },
    {
      key: 'severity',
      header: t('notificationsTable.severity'),
      sortValue: (n) => n.severity,
      searchValue: (n) => getNotificationSeverityLabel(n.severity, t),
      render: (n) => (
        <Badge variant={n.severity === 'error' ? 'error' : n.severity === 'warning' ? 'warning' : 'default'}>
          {getNotificationSeverityLabel(n.severity, t)}
        </Badge>
      ),
    },
    {
      key: 'message',
      header: t('notificationsTable.message'),
      searchValue: messageText,
      sortValue: messageText,
      render: (n) => (
        <span className={n.read ? 'opacity-60' : ''}>{messageText(n)}</span>
      ),
    },
  ];

  if (!compact) {
    columns.push({
      key: 'channels',
      header: t('notificationsTable.channels'),
      searchValue: (n) => (n.channels || []).join(', '),
      render: (n) => <span className="text-xs">{(n.channels || []).join(', ')}</span>,
    });
  }

  columns.push({
    key: 'date',
    header: t('notificationsTable.dateTime'),
    className: 'table-cell-nowrap',
    sortValue: (n) => n.createdAt || '',
    render: (n) => formatDateTime(n.createdAt),
  });

  if (canEdit) {
    columns.push({
      key: 'actions',
      header: '',
      className: 'w-0 whitespace-nowrap',
      render: (n) => (
        <div className="flex items-center justify-end gap-1.5">
          {!n.read && (
            <button
              type="button"
              className="btn-icon !h-8 !w-8 text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
              title={t('notificationsTable.markRead')}
              aria-label={t('notificationsTable.markRead')}
              onClick={() => onMarkRead(n.id)}
            >
              <CheckCheck size={14} />
            </button>
          )}
          <button
            type="button"
            className="btn-icon !h-8 !w-8 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            title={t('common.delete')}
            aria-label={t('notificationsTable.deleteNotification')}
            onClick={() => onDelete(n.id)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    });
  }

  return columns;
}

export function createNotificationBulkActions(
  refresh: () => void,
  canEdit = true,
  t: TranslateFn = tGlobal
): DataTableBulkAction<Notification>[] {
  const actions: DataTableBulkAction<Notification>[] = [
    createExportBulkAction('notifications.csv', [
      { header: t('notificationsTable.type'), value: (n) => n.type },
      { header: t('notificationsTable.severity'), value: (n) => n.severity || '' },
      { header: t('notificationsTable.message'), value: (n) => formatNotificationMessage(n, t) },
      { header: t('notificationsTable.channels'), value: (n) => (n.channels || []).join(', ') },
      { header: t('notificationsTable.readStatus'), value: (n) => (n.read ? t('common.yes') : t('common.no')) },
      { header: t('notificationsTable.dateTime'), value: (n) => n.createdAt || '' },
    ]),
  ];

  if (canEdit) {
    actions.push(
      {
        id: 'mark-read',
        label: t('notificationsTable.markReadMany'),
        confirmMessage: (_rows, ids) => t('notificationsTable.confirmMarkRead', { count: ids.length }),
        disabled: (rows) => rows.every((n) => n.read),
        onAction: async (rows) => {
          const unread = rows.filter((n) => !n.read);
          await bulkPatch('/crm/notifications', unread, (n) => n.id, { read: true });
          refresh();
        },
      },
      {
        id: 'delete',
        label: t('common.delete'),
        variant: 'danger',
        confirmMessage: (_rows, ids) => t('notificationsTable.confirmDelete', { count: ids.length }),
        onAction: async (_rows, ids) => {
          await bulkDelete('/crm/notifications', ids);
          refresh();
        },
      }
    );
  }

  return actions;
}
