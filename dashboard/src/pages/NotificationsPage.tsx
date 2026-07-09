import { useCallback, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
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
  deleteAllNotifications,
  fetchRecentNotifications,
  notificationFilters,
} from '../utils/notificationsTable';
import { useLocale } from '../i18n/LocaleContext';

export function NotificationsPage() {
  const { t } = useLocale();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('update');
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);

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

  const deleteAll = async () => {
    if (!canEdit || deletingAll) return;
    const total = totalCount ?? items?.length ?? 0;
    if (total === 0) return;
    if (!confirm(t('pages.notifications.confirmDeleteAll', { count: total }))) return;
    setDeletingAll(true);
    try {
      await deleteAllNotifications();
      setTotalCount(0);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : t('pages.notifications.deleteAllFailed'));
    } finally {
      setDeletingAll(false);
    }
  };

  const columns = useMemo(
    () => createNotificationColumns({ onMarkRead: markRead, onDelete: deleteOne, canEdit, t }),
    [refresh, canEdit, t]
  );

  const bulkActions = useMemo(() => createNotificationBulkActions(refresh, canEdit, t), [refresh, canEdit, t]);

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
        actions={
          canEdit && (totalCount ?? items?.length ?? 0) > 0 ? (
            <button
              type="button"
              className="btn-secondary inline-flex items-center gap-2 text-red-600 dark:text-red-400"
              disabled={deletingAll}
              onClick={() => void deleteAll()}
            >
              <Trash2 size={16} />
              {deletingAll ? t('pages.notifications.deletingAll') : t('pages.notifications.deleteAll')}
            </button>
          ) : undefined
        }
      />
      <DataTable
        tableId="notifications"
        columns={columns}
        data={items || []}
        rowKey={(n) => n.id}
        filters={notificationFilters(t, true)}
        searchPlaceholder={t('pages.notifications.searchPlaceholder')}
        defaultSortKey="date"
        defaultSortDir="desc"
        bulkActions={bulkActions}
      />
    </div>
  );
}
