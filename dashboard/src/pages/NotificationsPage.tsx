import { useCallback, useMemo } from 'react';
import { api, apiList } from '../api/client';
import { PageHeader, Loading, Badge } from '../components/UI';
import { DataTable, type DataTableBulkAction, type DataTableColumn, type DataTableFilter } from '../components/DataTable';
import { DEFAULT_LIVE_INTERVAL_MS } from '../constants/live';
import { usePolling } from '../hooks/usePolling';
import { bulkPatch } from '../utils/bulk';
import { createExportBulkAction } from '../utils/export';
import { formatDateTime } from '../utils/format';
import { NOTIFICATION_TYPE_LABELS } from '../utils/notificationSettings';
import type { Notification } from '../types';

export function NotificationsPage() {
  const fetchItems = useCallback(() => apiList<Notification>('/crm/notifications'), []);
  const { data: items, loading, refresh } = usePolling(fetchItems, [], { intervalMs: DEFAULT_LIVE_INTERVAL_MS });

  const markRead = async (id: string) => {
    await api(`/crm/notifications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ read: true }),
    });
    refresh();
  };

  const filters: DataTableFilter<Notification>[] = useMemo(
    () => [
      {
        id: 'read',
        label: 'Статус',
        options: [
          { value: 'unread', label: 'Непрочитанные' },
          { value: 'read', label: 'Прочитанные' },
        ],
        match: (n, v) => (v === 'read' ? n.read : !n.read),
      },
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
    ],
    []
  );

  const columns: DataTableColumn<Notification>[] = useMemo(
    () => [
      {
        key: 'type',
        header: 'Тип',
        searchValue: (n) => n.type,
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
        render: (n) => <span className={n.read ? 'opacity-60' : ''}>{n.message}</span>,
      },
      {
        key: 'channels',
        header: 'Каналы',
        searchValue: (n) => (n.channels || []).join(', '),
        render: (n) => <span className="text-xs">{(n.channels || []).join(', ')}</span>,
      },
      {
        key: 'date',
        header: 'Дата и время',
        sortValue: (n) => n.createdAt || '',
        render: (n) => formatDateTime(n.createdAt),
      },
      {
        key: 'actions',
        header: '',
        render: (n) =>
          !n.read ? (
            <button type="button" className="btn-secondary text-xs" onClick={() => markRead(n.id)}>
              Прочитано
            </button>
          ) : null,
      },
    ],
    []
  );

  const bulkActions = useMemo((): DataTableBulkAction<Notification>[] => [
    createExportBulkAction('notifications.csv', [
      { header: 'Тип', value: (n) => n.type },
      { header: 'Важность', value: (n) => n.severity || '' },
      { header: 'Сообщение', value: (n) => n.message },
      { header: 'Каналы', value: (n) => (n.channels || []).join(', ') },
      { header: 'Прочитано', value: (n) => (n.read ? 'да' : 'нет') },
      { header: 'Дата и время', value: (n) => n.createdAt || '' },
    ]),
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
  ], [refresh]);

  if (loading && !items) return <Loading />;

  return (
    <div>
      <PageHeader title="Уведомления" subtitle="Telegram и Web Notifications" />
      <DataTable
        tableId="notifications"
        columns={columns}
        data={items || []}
        rowKey={(n) => n.id}
        filters={filters}
        searchPlaceholder="Поиск уведомлений…"
        bulkActions={bulkActions}
      />
    </div>
  );
}
