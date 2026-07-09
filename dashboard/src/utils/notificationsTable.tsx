import { CheckCheck, Trash2 } from 'lucide-react';
import { apiListPage } from '../api/client';
import { Badge } from '../components/UI';
import type { DataTableBulkAction, DataTableColumn, DataTableFilter } from '../components/DataTable';
import { bulkDelete, bulkPatch } from './bulk';
import { createExportBulkAction } from './export';
import { formatDateTime } from './format';
import { getNotificationTypeLabels, isWebNotification } from './notificationSettings';
import type { Notification } from '../types';
import { tGlobal } from '../i18n/runtime';

const NOTIFICATION_TYPE_LABELS = getNotificationTypeLabels();

export const NOTIFICATIONS_PAGE_LIMIT = 150;
export const NOTIFICATIONS_DASHBOARD_LIMIT = 30;

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

export async function countUnreadWebNotifications(signal?: AbortSignal): Promise<number> {
  const { items } = await fetchRecentNotifications(NOTIFICATIONS_PAGE_LIMIT, signal);
  return items.filter((n) => !n.read).length;
}

export function notificationFilters(full = true): DataTableFilter<Notification>[] {
  const filters: DataTableFilter<Notification>[] = [
    {
      id: 'read',
      label: tGlobal('common.status'),
      options: [
        { value: 'unread', label: tGlobal('notificationsTable.unread') },
        { value: 'read', label: tGlobal('notificationsTable.read') },
      ],
      match: (n, v) => (v === 'read' ? n.read : !n.read),
    },
  ];

  if (!full) return filters;

  return [
    ...filters,
    {
      id: 'severity',
      label: tGlobal('notificationsTable.severity'),
      options: [
        { value: 'error', label: tGlobal('status.error') },
        { value: 'warning', label: tGlobal('notificationsTable.warning') },
        { value: 'info', label: tGlobal('notificationsTable.info') },
      ],
      match: (n, v) => n.severity === v,
    },
    {
      id: 'type',
      label: tGlobal('notificationsTable.type'),
      options: Object.entries(NOTIFICATION_TYPE_LABELS).map(([value, label]) => ({ value, label })),
      match: (n, v) => n.type === v,
    },
  ];
}

interface NotificationColumnOptions {
  onMarkRead: (id: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  compact?: boolean;
  canEdit?: boolean;
}

export function createNotificationColumns({
  onMarkRead,
  onDelete,
  compact = false,
  canEdit = true,
}: NotificationColumnOptions): DataTableColumn<Notification>[] {
  const columns: DataTableColumn<Notification>[] = [
    {
      key: 'type',
      header: tGlobal('notificationsTable.type'),
      sortable: true,
      searchValue: (n) => `${n.type} ${NOTIFICATION_TYPE_LABELS[n.type] ?? ''}`,
      sortValue: (n) => n.type,
      render: (n) => NOTIFICATION_TYPE_LABELS[n.type] ?? n.type,
    },
    {
      key: 'severity',
      header: tGlobal('notificationsTable.severity'),
      sortValue: (n) => n.severity,
      searchValue: (n) => n.severity,
      render: (n) => (
        <Badge variant={n.severity === 'error' ? 'error' : n.severity === 'warning' ? 'warning' : 'default'}>
          {n.severity}
        </Badge>
      ),
    },
    {
      key: 'message',
      header: tGlobal('notificationsTable.message'),
      searchValue: (n) => n.message,
      sortValue: (n) => n.message,
      render: (n) => (
        <span className={n.read ? 'opacity-60' : ''}>{n.message}</span>
      ),
    },
  ];

  if (!compact) {
    columns.push({
      key: 'channels',
      header: tGlobal('notificationsTable.channels'),
      searchValue: (n) => (n.channels || []).join(', '),
      render: (n) => <span className="text-xs">{(n.channels || []).join(', ')}</span>,
    });
  }

  columns.push({
    key: 'date',
    header: tGlobal('notificationsTable.dateTime'),
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
              title={tGlobal('notificationsTable.markRead')}
              aria-label={tGlobal('notificationsTable.markRead')}
              onClick={() => onMarkRead(n.id)}
            >
              <CheckCheck size={14} />
            </button>
          )}
          <button
            type="button"
            className="btn-icon !h-8 !w-8 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            title={tGlobal('common.delete')}
            aria-label={tGlobal('notificationsTable.deleteNotification')}
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

export function createNotificationBulkActions(refresh: () => void, canEdit = true): DataTableBulkAction<Notification>[] {
  const actions: DataTableBulkAction<Notification>[] = [
    createExportBulkAction('notifications.csv', [
      { header: tGlobal('notificationsTable.type'), value: (n) => n.type },
      { header: tGlobal('notificationsTable.severity'), value: (n) => n.severity || '' },
      { header: tGlobal('notificationsTable.message'), value: (n) => n.message },
      { header: tGlobal('notificationsTable.channels'), value: (n) => (n.channels || []).join(', ') },
      { header: tGlobal('notificationsTable.readStatus'), value: (n) => (n.read ? tGlobal('common.yes') : tGlobal('common.no')) },
      { header: tGlobal('notificationsTable.dateTime'), value: (n) => n.createdAt || '' },
    ]),
  ];

  if (canEdit) {
    actions.push(
      {
        id: 'mark-read',
        label: tGlobal('notificationsTable.markReadMany'),
        confirmMessage: (_rows, ids) => tGlobal('notificationsTable.confirmMarkRead', { count: ids.length }),
        disabled: (rows) => rows.every((n) => n.read),
        onAction: async (rows) => {
          const unread = rows.filter((n) => !n.read);
          await bulkPatch('/crm/notifications', unread, (n) => n.id, { read: true });
          refresh();
        },
      },
      {
        id: 'delete',
        label: tGlobal('common.delete'),
        variant: 'danger',
        confirmMessage: (_rows, ids) => tGlobal('notificationsTable.confirmDelete', { count: ids.length }),
        onAction: async (_rows, ids) => {
          await bulkDelete('/crm/notifications', ids);
          refresh();
        },
      }
    );
  }

  return actions;
}
