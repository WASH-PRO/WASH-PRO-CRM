import { useCallback, useMemo } from 'react';
import { apiList } from '../api/client';
import { PageHeader, StatCard, Loading, Badge } from '../components/UI';
import { DataTable, type DataTableBulkAction, type DataTableColumn, type DataTableFilter } from '../components/DataTable';
import { DashboardCharts } from '../components/DashboardCharts';
import { LIVE_INTERVAL_DASHBOARD_MS } from '../constants/live';
import { usePolling } from '../hooks/usePolling';
import { useCurrency } from '../hooks/useCurrency';
import { formatMoney } from '../utils/format';
import { bulkPatch } from '../utils/bulk';
import { createExportBulkAction } from '../utils/export';
import { refId } from '../utils/refs';
import { latestFinanceByPost } from '../utils/statsAggregation';
import type { Wash, Post, PostState, Notification, UsageStat, FinanceStat } from '../types';

interface DashboardData {
  washes: Wash[];
  posts: Post[];
  states: PostState[];
  notifications: Notification[];
  usageStats: UsageStat[];
  financeStats: FinanceStat[];
}

export function DashboardPage() {
  const { currency } = useCurrency();

  const fetchData = useCallback(async (): Promise<DashboardData> => {
    const [washes, posts, states, notifications, usageStats, financeStats] = await Promise.all([
      apiList<Wash>('/crm/washes'),
      apiList<Post>('/crm/posts'),
      apiList<PostState>('/crm/post-states'),
      apiList<Notification>('/crm/notifications'),
      apiList<UsageStat>('/crm/usage-stats'),
      apiList<FinanceStat>('/crm/finance-stats'),
    ]);
    return { washes, posts, states, notifications, usageStats, financeStats };
  }, []);

  const { data, loading, refresh } = usePolling(fetchData, [], { intervalMs: LIVE_INTERVAL_DASHBOARD_MS });

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
    const stateByPost = new Map(data.states.map((s) => [refId(s.postId), s]));
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
      else if (state?.connected === true) online += 1;
      else offline += 1;
    }

    return { online, offline, maintenance, errors };
  }, [data]);

  const notificationFilters: DataTableFilter<Notification>[] = useMemo(
    () => [
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
        id: 'read',
        label: 'Статус',
        options: [
          { value: 'unread', label: 'Непрочитанные' },
          { value: 'read', label: 'Прочитанные' },
        ],
        match: (n, v) => (v === 'read' ? n.read : !n.read),
      },
    ],
    []
  );

  const notificationColumns: DataTableColumn<Notification>[] = useMemo(
    () => [
      {
        key: 'type',
        header: 'Тип',
        sortable: true,
        searchValue: (n) => n.type,
        sortValue: (n) => n.type,
        render: (n) => (
          <Badge variant={n.severity === 'error' ? 'error' : n.severity === 'warning' ? 'warning' : 'default'}>
            {n.type}
          </Badge>
        ),
      },
      {
        key: 'message',
        header: 'Сообщение',
        sortable: true,
        searchValue: (n) => n.message,
        sortValue: (n) => n.message,
        render: (n) => <span className="text-sm">{n.message}</span>,
      },
      {
        key: 'date',
        header: 'Дата',
        sortable: true,
        sortValue: (n) => n.createdAt || '',
        render: (n) => (
          <span className="text-sm text-panel-muted dark:text-panel-muted-dark">
            {n.createdAt ? new Date(n.createdAt).toLocaleString('ru') : '—'}
          </span>
        ),
      },
    ],
    []
  );

  const notificationBulkActions = useMemo((): DataTableBulkAction<Notification>[] => [
    createExportBulkAction('notifications.csv', [
      { header: 'Тип', value: (n) => n.type },
      { header: 'Важность', value: (n) => n.severity || '' },
      { header: 'Сообщение', value: (n) => n.message },
      { header: 'Дата', value: (n) => n.createdAt || '' },
    ]),
    {
      id: 'mark-read',
      label: 'Отметить прочитанными',
      disabled: (rows) => rows.every((n) => n.read),
      onAction: async (rows) => {
        const unread = rows.filter((n) => !n.read);
        await bulkPatch('/crm/notifications', unread, (n) => n.id, { read: true });
        refresh();
      },
    },
  ], [refresh]);

  if (loading && !data) return <Loading />;
  if (!data) return <Loading />;

  const recentNotifications = [...data.notifications]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 50);

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
        <h2 className="mb-4 font-semibold">Последние уведомления</h2>
        <DataTable
          columns={notificationColumns}
          data={recentNotifications}
          rowKey={(n) => n.id}
          filters={notificationFilters}
          searchPlaceholder="Поиск уведомлений…"
          pageSize={10}
          emptyMessage="Нет уведомлений"
          bulkActions={notificationBulkActions}
        />
      </div>
    </div>
  );
}
