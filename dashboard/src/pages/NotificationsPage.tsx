import { useCallback, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Loading } from '../components/UI';
import { DataTable } from '../components/DataTable';
import { DEFAULT_LIVE_INTERVAL_MS } from '../constants/live';
import { usePolling } from '../hooks/usePolling';
import { bulkDelete } from '../utils/bulk';
import {
  NOTIFICATIONS_PAGE_LIMIT,
  createNotificationBulkActions,
  createNotificationColumns,
  fetchRecentNotifications,
  notificationFilters,
} from '../utils/notificationsTable';
import { useLocale } from '../i18n/LocaleContext';

export function NotificationsPage() {
  const { t } = useLocale();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('update');
  const [totalCount, setTotalCount] = useState<number | null>(null);

  const fetchItems = useCallback(async (signal: AbortSignal) => {
    const { items, total } = await fetchRecentNotifications(NOTIFICATIONS_PAGE_LIMIT, signal);
    setTotalCount(total);
    return items;
  }, []);

  const { data: items, loading, refresh } = usePolling(fetchItems, [], { intervalMs: DEFAULT_LIVE_INTERVAL_MS });

  const markRead = async (id: string) => {
    if (!canEdit) return;
    await api(`/crm/notifications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ read: true }),
    });
    refresh();
  };

  const deleteOne = async (id: string) => {
    if (!canEdit) return;
    if (!confirm(t('pages.notifications.confirmDeleteOne'))) return;
    await bulkDelete('/crm/notifications', [id]);
    refresh();
  };

  const columns = useMemo(
    () => createNotificationColumns({ onMarkRead: markRead, onDelete: deleteOne, canEdit }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [refresh, canEdit]
  );

  const bulkActions = useMemo(() => createNotificationBulkActions(refresh, canEdit), [refresh, canEdit]);

  const limitHint =
    totalCount != null && totalCount > NOTIFICATIONS_PAGE_LIMIT
      ? t('pages.notifications.limitHint.shownLatest', { limit: NOTIFICATIONS_PAGE_LIMIT, total: totalCount })
      : totalCount != null
        ? t('pages.notifications.limitHint.total', { total: totalCount })
        : '';

  if (loading && !items) return <Loading />;

  return (
    <div>
      <PageHeader
        title={t('pages.notifications.title')}
        subtitle={`${t('pages.notifications.subtitleBase')}${limitHint}${!canEdit ? t('pages.notifications.readonlySuffix') : ''}`}
      />
      <DataTable
        tableId="notifications"
        columns={columns}
        data={items || []}
        rowKey={(n) => n.id}
        filters={notificationFilters(true)}
        searchPlaceholder={t('pages.notifications.searchPlaceholder')}
        defaultSortKey="date"
        defaultSortDir="desc"
        bulkActions={bulkActions}
      />
    </div>
  );
}
