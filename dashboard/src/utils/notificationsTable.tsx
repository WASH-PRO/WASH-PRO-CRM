import { CheckCheck, Trash2 } from 'lucide-react';
import { apiListPage } from '../api/client';
import { Badge } from '../components/UI';
import type { DataTableBulkAction, DataTableColumn, DataTableFilter } from '../components/DataTable';
import { bulkDelete, bulkPatch } from './bulk';
import { createExportBulkAction } from './export';
import { formatDateTime } from './format';
import { NOTIFICATION_TYPE_LABELS, isWebNotification } from './notificationSettings';
import type { Notification } from '../types';

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
      label: 'Статус',
      options: [
        { value: 'unread', label: 'Непрочитанные' },
        { value: 'read', label: 'Прочитанные' },
      ],
      match: (n, v) => (v === 'read' ? n.read : !n.read),
    },
  ];

  if (!full) return filters;

  return [
    ...filters,
    {
      id: 'severity',
      label: 'Важность',
      options: [
        { value: 'error', label: 'Ошибка' },
        { value: 'warning', label: 'Предупреждение' },
        { value: 'info', label: 'Информация' },
      ],
      match: (n, v) => n.severity === v,
    },
    {
      id: 'type',
      label: 'Тип',
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
      header: 'Тип',
      sortable: true,
      searchValue: (n) => `${n.type} ${NOTIFICATION_TYPE_LABELS[n.type] ?? ''}`,
      sortValue: (n) => n.type,
      render: (n) => NOTIFICATION_TYPE_LABELS[n.type] ?? n.type,
    },
    {
      key: 'severity',
      header: 'Важность',
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
      header: 'Сообщение',
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
      header: 'Каналы',
      searchValue: (n) => (n.channels || []).join(', '),
      render: (n) => <span className="text-xs">{(n.channels || []).join(', ')}</span>,
    });
  }

  columns.push({
    key: 'date',
    header: 'Дата и время',
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
              title="Прочитано"
              aria-label="Отметить как прочитанное"
              onClick={() => onMarkRead(n.id)}
            >
              <CheckCheck size={14} />
            </button>
          )}
          <button
            type="button"
            className="btn-icon !h-8 !w-8 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            title="Удалить"
            aria-label="Удалить уведомление"
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
      { header: 'Тип', value: (n) => n.type },
      { header: 'Важность', value: (n) => n.severity || '' },
      { header: 'Сообщение', value: (n) => n.message },
      { header: 'Каналы', value: (n) => (n.channels || []).join(', ') },
      { header: 'Прочитано', value: (n) => (n.read ? 'да' : 'нет') },
      { header: 'Дата и время', value: (n) => n.createdAt || '' },
    ]),
  ];

  if (canEdit) {
    actions.push(
      {
        id: 'mark-read',
        label: 'Отметить прочитанными',
        confirmMessage: (_rows, ids) => `Отметить ${ids.length} уведомлений как прочитанные?`,
        disabled: (rows) => rows.every((n) => n.read),
        onAction: async (rows) => {
          const unread = rows.filter((n) => !n.read);
          await bulkPatch('/crm/notifications', unread, (n) => n.id, { read: true });
          refresh();
        },
      },
      {
        id: 'delete',
        label: 'Удалить',
        variant: 'danger',
        confirmMessage: (_rows, ids) => `Удалить ${ids.length} уведомлений? Это действие необратимо.`,
        onAction: async (_rows, ids) => {
          await bulkDelete('/crm/notifications', ids);
          refresh();
        },
      }
    );
  }

  return actions;
}
