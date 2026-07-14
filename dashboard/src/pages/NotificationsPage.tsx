import { useCallback, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Loading } from '../components/UI';
import { DataTable } from '../components/DataTable';
import { LIVE_INTERVAL_FAST_MS } from '../constants/live';
import { usePolling } from '../hooks/usePolling';
import { bulkDelete } from '../utils/bulk';
import {
  NOTIFICATIONS_PAGE_LIMIT,
  createNotificationBulkActions,
  createNotificationColumns,
  deleteAllNotifications,
  fetchNotificationsPages,
  notificationFilters,
} from '../utils/notificationsTable';
import { useLocale } from '../i18n/LocaleContext';

export function NotificationsPage() {
  const { t, locale } = useLocale();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('update');
  const [pages, setPages] = useState(1);
  const [totalRows, setTotalRows] = useState<number | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);

  const fetchData = useCallback(
    async (signal: AbortSignal) => {
      const { items, total, hasMore } = await fetchNotificationsPages(pages, NOTIFICATIONS_PAGE_LIMIT, signal);
      setTotalRows(total);
      return { rows: items, hasMore };
    },
    [pages]
  );

  const { data, loading, refresh, lastUpdatedAt } = usePolling(fetchData, [pages], {
    intervalMs: LIVE_INTERVAL_FAST_MS,
  });
  const rows = data?.rows;
  const hasMore = data?.hasMore ?? false;

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
    const total = totalRows ?? rows?.length ?? 0;
    if (total === 0) return;
    if (!confirm(t('pages.notifications.confirmDeleteAll', { count: total }))) return;
    setDeletingAll(true);
    try {
      await deleteAllNotifications();
      setTotalRows(0);
      setPages(1);
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

  if (loading && !rows) return <Loading />;

  const subtitle = `${t('pages.notifications.subtitleBase')}${t('pages.notifications.subtitleShown', { shown: rows?.length ?? 0 })}${
    totalRows != null ? t('pages.mqtt.subtitleOfTotal', { total: totalRows }) : ''
  }${t('pages.mqtt.subtitleUpdated', {
    updatedAt: lastUpdatedAt
      ? new Date(lastUpdatedAt).toLocaleTimeString(locale === 'ru' ? 'ru-RU' : 'en-US')
      : t('common.notAvailable'),
  })}${!canEdit ? t('pages.notifications.readonlySuffix') : ''}`;

  return (
    <div>
      <PageHeader
        title={t('pages.notifications.title')}
        subtitle={subtitle}
        actions={
          canEdit && (totalRows ?? rows?.length ?? 0) > 0 ? (
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
      {hasMore && (
        <div className="mb-4">
          <button type="button" className="btn-secondary btn-sm" onClick={() => setPages((p) => p + 1)}>
            {t('pages.mqtt.loadMore', { count: NOTIFICATIONS_PAGE_LIMIT })}
          </button>
        </div>
      )}
      <DataTable
        tableId="notifications"
        columns={columns}
        data={rows || []}
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
