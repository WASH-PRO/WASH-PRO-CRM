import { useCallback, useMemo } from 'react';
import { api, apiListBounded, apiListCatalog } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, StatCard, Loading, ErrorMessage } from '../components/UI';
import { DataTable } from '../components/DataTable';
import { DashboardCharts } from '../components/DashboardCharts';
import { LIVE_INTERVAL_DASHBOARD_MS } from '../constants/live';
import { usePolling } from '../hooks/usePolling';
import { useCurrency } from '../hooks/useCurrency';
import { formatMoney } from '../utils/format';
import { bulkDelete } from '../utils/bulk';
import {
  NOTIFICATIONS_DASHBOARD_LIMIT,
  createNotificationBulkActions,
  createNotificationColumns,
  fetchRecentNotifications,
  notificationFilters,
} from '../utils/notificationsTable';
import { refId } from '../utils/refs';
import { latestFinanceByPost, latestPostStateByPost, isPostOnline } from '../utils/statsAggregation';
import type { Wash, Post, PostState, Notification, UsageStat, FinanceStat } from '../types';

interface DashboardData {
  washes: Wash[];
  posts: Post[];
  states: PostState[];
  notifications: Notification[];
  notificationTotal: number;
  usageStats: UsageStat[];
  financeStats: FinanceStat[];
}

export function DashboardPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('update');
  const { currency } = useCurrency();

  const fetchData = useCallback(async (signal: AbortSignal): Promise<DashboardData> => {
    const [washes, posts, states, notificationPage, usageStats, financeStats] = await Promise.all([
      apiListCatalog<Wash>('/crm/washes', signal),
      apiListCatalog<Post>('/crm/posts', signal),
      apiListBounded<PostState>('/crm/post-states', signal, 5),
      fetchRecentNotifications(NOTIFICATIONS_DASHBOARD_LIMIT, signal),
      apiListBounded<UsageStat>('/crm/usage-stats', signal, 10),
      apiListBounded<FinanceStat>('/crm/finance-stats', signal, 10),
    ]);
    return {
      washes,
      posts,
      states,
      notifications: notificationPage.items,
      notificationTotal: notificationPage.total,
      usageStats,
      financeStats,
    };
  }, []);

  const { data, loading, error, refresh } = usePolling(fetchData, [], { intervalMs: LIVE_INTERVAL_DASHBOARD_MS });

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
    if (!confirm('Удалить уведомление?')) return;
    await bulkDelete('/crm/notifications', [id]);
    refresh();
  };

  const notificationColumns = useMemo(
    () => createNotificationColumns({ onMarkRead: markRead, onDelete: deleteOne, compact: true, canEdit }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [refresh, canEdit]
  );

  const notificationBulkActions = useMemo(() => createNotificationBulkActions(refresh, canEdit), [refresh, canEdit]);

  const finance = useMemo(() => {
    if (!data) return { cash: 0, cashless: 0, revenue: 0, discounts: 0 };
    const current = data.financeStats.filter((s) => s.period === 'before_collection');
    const latest = latestFinanceByPost(current);
    return {
      cash: latest.reduce((s, x) => s + (x.cash || 0), 0),
      cashless: latest.reduce((s, x) => s + (x.cashless || 0), 0),
      revenue: latest.reduce((s, x) => s + (x.totalRevenue || 0), 0),
      discounts: latest.reduce((s, x) => s + (x.discountOps || 0), 0),
    };
  }, [data]);

  const beforeUsageStats = useMemo(
    () => (data?.usageStats || []).filter((s) => s.period === 'before_collection'),
    [data?.usageStats]
  );

  const beforeFinanceStats = useMemo(
    () => (data?.financeStats || []).filter((s) => s.period === 'before_collection'),
    [data?.financeStats]
  );

  const postCounts = useMemo(() => {
    if (!data) return { online: 0, offline: 0, maintenance: 0, errors: 0 };
    const stateByPost = new Map(latestPostStateByPost(data.states).map((s) => [refId(s.postId), s]));
    let online = 0;
    let offline = 0;
    let maintenance = 0;
    let errors = 0;

    for (const post of data.posts) {
      const state = stateByPost.get(post.id);
      const equipment = state?.equipmentState as Record<string, unknown> | undefined;
      const hasError = Boolean(equipment?.error || equipment?.hasError);
      const isMaintenance = Boolean(equipment?.maintenance);

      if (hasError) errors += 1;
      else if (isMaintenance) maintenance += 1;
      else if (isPostOnline(state)) online += 1;
      else offline += 1;
    }

    return { online, offline, maintenance, errors };
  }, [data]);

  if (loading && !data) return <Loading />;
  if (error && !data) {
    return (
      <div>
        <PageHeader title="Обзор" />
        <ErrorMessage message={error} />
        <button type="button" className="btn-secondary mt-4" onClick={() => void refresh()}>
          Повторить
        </button>
      </div>
    );
  }
  if (!data) return <Loading />;

  const notificationHint =
    data.notificationTotal > NOTIFICATIONS_DASHBOARD_LIMIT
      ? ` · последние ${NOTIFICATIONS_DASHBOARD_LIMIT} из ${data.notificationTotal}`
      : '';

  return (
    <div>
      <PageHeader title="Обзор" subtitle={`До инкассации · ${data.posts.length} постов · ${data.washes.length} автомоек`} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Наличная выручка" value={formatMoney(finance.cash, currency)} hint="До инкассации" />
        <StatCard label="Безналичная выручка" value={formatMoney(finance.cashless, currency)} hint="До инкассации" />
        <StatCard label="Общая выручка" value={formatMoney(finance.revenue, currency)} hint="До инкассации" />
        <StatCard label="Сумма скидок" value={formatMoney(finance.discounts, currency)} hint="До инкассации" />
      </div>

      <DashboardCharts
        posts={data.posts}
        usageStats={beforeUsageStats}
        financeStats={beforeFinanceStats}
        currency={currency}
        online={postCounts.online}
        offline={postCounts.offline}
        maintenanceCount={postCounts.maintenance}
        errorCount={postCounts.errors}
      />

      <div className="card">
        <h2 className="mb-1 font-semibold text-panel-ink dark:text-panel-ink-dark">Последние уведомления</h2>
        {notificationHint && (
          <p className="field-hint mb-4">Показаны{notificationHint}</p>
        )}
        {!notificationHint && <div className="mb-4" />}
        <DataTable
          tableId="dashboard-notifications"
          columns={notificationColumns}
          data={data.notifications}
          rowKey={(n) => n.id}
          filters={notificationFilters(false)}
          searchPlaceholder="Поиск уведомлений…"
          pageSize={10}
          emptyMessage="Нет уведомлений"
          defaultSortKey="date"
          defaultSortDir="desc"
          bulkActions={notificationBulkActions}
        />
      </div>
    </div>
  );
}
