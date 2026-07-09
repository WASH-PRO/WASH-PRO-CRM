import { useCallback, useMemo } from 'react';
import { X } from 'lucide-react';
import { apiListBounded, apiListCatalog } from '../api/client';
import { PageHeader, Loading, StatCard, getPeriodLabelMap, getCategoryLabelMap } from '../components/UI';
import { DataTable, type DataTableBulkAction, type DataTableColumn, type DataTableFilter } from '../components/DataTable';
import { DEFAULT_LIVE_INTERVAL_MS } from '../constants/live';
import { usePolling } from '../hooks/usePolling';
import { statsScopeHint, useStatsScopeFilter } from '../hooks/useStatsScopeFilter';
import { formatDurationHuman, formatDateTime } from '../utils/format';
import { createExportBulkAction } from '../utils/export';
import {
  latestUsageByPostAndCategory,
  resolvePostNumber,
  resolveStatPostId,
  resolveStatWashAddress,
  resolveCategoryUsageSeconds,
  resolveUsageSeconds,
} from '../utils/statsAggregation';
import type { Post, UsageStat, Wash } from '../types';
import { useLocale } from '../i18n/LocaleContext';

const USAGE_CATEGORIES = ['regular', 'service', 'unlimited'] as const;

function getUsageCategoryLabelMap(t: (key: string) => string): Record<string, string> {
  return {
    ...getCategoryLabelMap(),
    regular: t('pages.usage.categories.regularClients'),
  };
}

interface UsagePageData {
  stats: UsageStat[];
  posts: Post[];
  washes: Wash[];
}

function PeriodUsageSection({
  tableId,
  title,
  stats,
  postById,
  washById,
  t,
}: {
  tableId: string;
  title: string;
  stats: UsageStat[];
  postById: Map<string, Post>;
  washById: Map<string, Wash>;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const usageCategoryLabel = useMemo(() => getUsageCategoryLabelMap(t), [t]);
  const latest = useMemo(() => latestUsageByPostAndCategory(stats), [stats]);

  const postNumber = useCallback(
    (s: UsageStat) => resolvePostNumber(s.postId, postById),
    [postById]
  );

  const address = useCallback(
    (s: UsageStat) => resolveStatWashAddress(s.washId, s.postId, postById, washById),
    [postById, washById]
  );

  const postId = useCallback((s: UsageStat) => resolveStatPostId(s.postId), []);

  const {
    washFilter,
    postFilter,
    filtered,
    washOptions,
    hasScope,
    onWashFilterChange,
    onPostSelect,
    clearScope,
  } = useStatsScopeFilter({
    rows: latest,
    getWashAddress: address,
    getPostId: postId,
  });

  const totals = useMemo(() => {
    const result: Record<string, number> = { regular: 0, service: 0, unlimited: 0 };
    (['regular', 'service', 'unlimited'] as const).forEach((category) => {
      result[category] = resolveCategoryUsageSeconds(filtered, category);
    });
    return result;
  }, [filtered]);

  const scopeHint = useMemo(() => {
    const postLabel = postFilter
      ? postNumber(filtered.find((s) => postId(s) === postFilter) || filtered[0]!)
      : undefined;
    return statsScopeHint(washFilter, postFilter, postLabel !== '—' ? postLabel : undefined);
  }, [washFilter, postFilter, filtered, postNumber, postId]);

  const addressFilter: DataTableFilter<UsageStat> = useMemo(
    () => ({
      id: 'address',
      label: t('common.wash'),
      options: washOptions.map((a) => ({ value: a, label: a })),
      match: (s, v) => address(s) === v,
    }),
    [washOptions, address, t]
  );

  const categoryFilter: DataTableFilter<UsageStat> = useMemo(
    () => ({
      id: 'category',
      label: t('common.category'),
      options: [
        { value: 'regular', label: usageCategoryLabel.regular },
        { value: 'service', label: usageCategoryLabel.service },
        { value: 'unlimited', label: usageCategoryLabel.unlimited },
      ],
      match: (s, v) => s.category === v,
    }),
    [t, usageCategoryLabel]
  );

  const columns: DataTableColumn<UsageStat>[] = useMemo(
    () => [
      {
        key: 'post',
        header: t('refs.post'),
        sortable: true,
        sortValue: (s) => Number(postNumber(s)) || 0,
        searchValue: (s) => postNumber(s),
        render: (s) => <span className="font-mono">{postNumber(s)}</span>,
      },
      {
        key: 'address',
        header: t('pages.usage.columns.washAddress'),
        sortable: true,
        sortValue: (s) => address(s),
        searchValue: (s) => address(s),
        render: (s) => address(s),
      },
      {
        key: 'category',
        header: t('common.category'),
        sortable: true,
        searchValue: (s) => usageCategoryLabel[s.category] || s.category,
        sortValue: (s) => s.category,
        render: (s) => usageCategoryLabel[s.category] || s.category,
      },
      {
        key: 'usageTime',
        header: t('pages.usage.columns.usageTime'),
        sortable: true,
        sortValue: (s) => resolveUsageSeconds(s),
        render: (s) => formatDurationHuman(resolveUsageSeconds(s)),
      },
      {
        key: 'launchCount',
        header: t('pages.usage.columns.launches'),
        sortable: true,
        sortValue: (s) => s.launchCount,
        render: (s) => s.launchCount,
      },
      {
        key: 'clientCount',
        header: t('pages.usage.columns.clients'),
        sortable: true,
        sortValue: (s) => s.clientCount,
        render: (s) => s.clientCount,
      },
      {
        key: 'recordedAt',
        header: t('notificationsTable.dateTime'),
        sortable: true,
        sortValue: (s) => s.recordedAt || '',
        render: (s) => formatDateTime(s.recordedAt),
      },
    ],
    [postNumber, address, t, usageCategoryLabel]
  );

  const bulkActions = useMemo((): DataTableBulkAction<UsageStat>[] => [
    createExportBulkAction(`usage-${title}.csv`, [
      { header: t('refs.post'), value: (s) => postNumber(s) },
      { header: t('pages.usage.columns.washAddress'), value: (s) => address(s) },
      { header: t('common.category'), value: (s) => usageCategoryLabel[s.category] || s.category },
      { header: t('pages.usage.export.usageSeconds'), value: (s) => String(resolveUsageSeconds(s)) },
      { header: t('pages.usage.columns.launches'), value: (s) => String(s.launchCount ?? 0) },
      { header: t('pages.usage.columns.clients'), value: (s) => String(s.clientCount ?? 0) },
      { header: t('notificationsTable.dateTime'), value: (s) => s.recordedAt || '' },
    ]),
  ], [title, postNumber, address, t, usageCategoryLabel]);

  const handleFilterChange = useCallback(
    (id: string, value: string) => {
      if (id === 'address') onWashFilterChange(value);
    },
    [onWashFilterChange]
  );

  return (
    <section className="mb-8">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      <div className="mb-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        {USAGE_CATEGORIES.map((cat) => (
          <StatCard
            key={cat}
            label={usageCategoryLabel[cat]}
            value={formatDurationHuman(totals[cat])}
            hint={scopeHint}
          />
        ))}
      </div>
      {hasScope && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-panel-muted dark:text-panel-muted-dark">{t('pages.usage.scope.filterLabel')}</span>
          <span className="max-w-full truncate rounded-full bg-brand-500/10 px-3 py-1 font-medium text-brand-800 dark:text-brand-300">
            {scopeHint}
          </span>
          <button
            type="button"
            className="btn-secondary !px-2 !py-1"
            onClick={clearScope}
            title={t('pages.usage.scope.clear')}
          >
            <X size={14} />
          </button>
        </div>
      )}
      <DataTable
        tableId={tableId}
        columns={columns}
        data={filtered}
        rowKey={(s) => s.id}
        filters={[addressFilter, categoryFilter]}
        filterValues={{ address: washFilter }}
        onFilterChange={handleFilterChange}
        onRowClick={onPostSelect}
        isRowActive={(s) => Boolean(postFilter && postId(s) === postFilter)}
        emptyMessage={t('pages.usage.empty')}
        searchPlaceholder={t('pages.usage.searchPlaceholder')}
        bulkActions={bulkActions}
      />
    </section>
  );
}

export function UsagePage() {
  const { t } = useLocale();
  const periodLabel = getPeriodLabelMap();
  const fetchData = useCallback(async (): Promise<UsagePageData> => {
    const [stats, posts, washes] = await Promise.all([
      apiListBounded<UsageStat>('/crm/usage-stats'),
      apiListCatalog<Post>('/crm/posts'),
      apiListCatalog<Wash>('/crm/washes'),
    ]);
    return { stats, posts, washes };
  }, []);

  const { data, loading } = usePolling(fetchData, [], { intervalMs: DEFAULT_LIVE_INTERVAL_MS });

  const postById = useMemo(
    () => new Map((data?.posts || []).map((p) => [p.id, p])),
    [data?.posts]
  );
  const washById = useMemo(
    () => new Map((data?.washes || []).map((w) => [w.id, w])),
    [data?.washes]
  );

  const before = useMemo(
    () => (data?.stats || []).filter((s) => s.period === 'before_collection'),
    [data?.stats]
  );
  const after = useMemo(
    () => (data?.stats || []).filter((s) => s.period === 'after_collection'),
    [data?.stats]
  );

  if (loading && !data) return <Loading />;

  return (
    <div>
      <PageHeader title={t('pages.usage.title')} subtitle={t('pages.usage.subtitle')} />
      <PeriodUsageSection tableId="usage-before" title={periodLabel.before_collection} stats={before} postById={postById} washById={washById} t={t} />
      <PeriodUsageSection tableId="usage-after" title={periodLabel.after_collection} stats={after} postById={postById} washById={washById} t={t} />
    </div>
  );
}
