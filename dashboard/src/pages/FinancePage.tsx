import { useCallback, useMemo } from 'react';
import { X } from 'lucide-react';
import { apiList } from '../api/client';
import { PageHeader, Loading, StatCard, periodLabel } from '../components/UI';
import { DataTable, type DataTableBulkAction, type DataTableColumn, type DataTableFilter } from '../components/DataTable';
import { DEFAULT_LIVE_INTERVAL_MS } from '../constants/live';
import { usePolling } from '../hooks/usePolling';
import { useCurrency } from '../hooks/useCurrency';
import { statsScopeHint, useStatsScopeFilter } from '../hooks/useStatsScopeFilter';
import { formatMoney, formatDateTime } from '../utils/format';
import { createExportBulkAction } from '../utils/export';
import {
  latestFinanceByPost,
  resolvePostNumber,
  resolveStatPostId,
  resolveStatWashAddress,
} from '../utils/statsAggregation';
import type { FinanceStat, Post, Wash } from '../types';

interface FinancePageData {
  stats: FinanceStat[];
  posts: Post[];
  washes: Wash[];
}

function PeriodSection({
  tableId,
  title,
  stats,
  currency,
  postById,
  washById,
}: {
  tableId: string;
  title: string;
  stats: FinanceStat[];
  currency: { code: string; symbol?: string };
  postById: Map<string, Post>;
  washById: Map<string, Wash>;
}) {
  const latest = useMemo(() => latestFinanceByPost(stats), [stats]);

  const postNumber = useCallback(
    (s: FinanceStat) => resolvePostNumber(s.postId, postById),
    [postById]
  );

  const address = useCallback(
    (s: FinanceStat) => resolveStatWashAddress(s.washId, s.postId, postById, washById),
    [postById, washById]
  );

  const postId = useCallback((s: FinanceStat) => resolveStatPostId(s.postId), []);

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

  const totals = useMemo(
    () => ({
      cash: filtered.reduce((s, x) => s + (x.cash || 0), 0),
      cashless: filtered.reduce((s, x) => s + (x.cashless || 0), 0),
      discount: filtered.reduce((s, x) => s + (x.discountOps || 0), 0),
    }),
    [filtered]
  );

  const scopeHint = useMemo(() => {
    const postLabel = postFilter
      ? postNumber(filtered.find((s) => postId(s) === postFilter) || filtered[0]!)
      : undefined;
    return statsScopeHint(washFilter, postFilter, postLabel !== '—' ? postLabel : undefined);
  }, [washFilter, postFilter, filtered, postNumber, postId]);

  const addressFilter: DataTableFilter<FinanceStat> = useMemo(
    () => ({
      id: 'address',
      label: 'Объект',
      options: washOptions.map((a) => ({ value: a, label: a })),
      match: (s, v) => address(s) === v,
    }),
    [washOptions, address]
  );

  const columns: DataTableColumn<FinanceStat>[] = useMemo(
    () => [
      {
        key: 'post',
        header: 'Пост',
        sortable: true,
        sortValue: (s) => Number(postNumber(s)) || 0,
        searchValue: (s) => postNumber(s),
        render: (s) => <span className="font-mono">{postNumber(s)}</span>,
      },
      {
        key: 'address',
        header: 'Адрес объекта',
        sortable: true,
        sortValue: (s) => address(s),
        searchValue: (s) => address(s),
        render: (s) => address(s),
      },
      {
        key: 'cash',
        header: 'Наличные',
        sortable: true,
        sortValue: (s) => s.cash,
        render: (s) => formatMoney(s.cash, currency),
      },
      {
        key: 'cashless',
        header: 'Внешние (безнал)',
        sortable: true,
        sortValue: (s) => s.cashless,
        render: (s) => formatMoney(s.cashless, currency),
      },
      {
        key: 'discountOps',
        header: 'Скидочные средства',
        sortable: true,
        sortValue: (s) => s.discountOps,
        render: (s) => formatMoney(s.discountOps, currency),
      },
      {
        key: 'totalRevenue',
        header: 'Выручка',
        sortable: true,
        sortValue: (s) => s.totalRevenue,
        render: (s) => <span className="font-medium">{formatMoney(s.totalRevenue, currency)}</span>,
      },
      {
        key: 'recordedAt',
        header: 'Дата и время',
        sortable: true,
        sortValue: (s) => s.recordedAt || '',
        render: (s) => formatDateTime(s.recordedAt),
      },
    ],
    [currency, postNumber, address]
  );

  const bulkActions = useMemo((): DataTableBulkAction<FinanceStat>[] => [
    createExportBulkAction(`finance-${title}.csv`, [
      { header: 'Пост', value: (s) => postNumber(s) },
      { header: 'Адрес объекта', value: (s) => address(s) },
      { header: 'Наличные', value: (s) => String(s.cash ?? 0) },
      { header: 'Безнал', value: (s) => String(s.cashless ?? 0) },
      { header: 'Скидки', value: (s) => String(s.discountOps ?? 0) },
      { header: 'Выручка', value: (s) => String(s.totalRevenue ?? 0) },
      { header: 'Дата и время', value: (s) => s.recordedAt || '' },
    ]),
  ], [title, postNumber, address]);

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
        <StatCard label="Наличные средства" value={formatMoney(totals.cash, currency)} hint={scopeHint} />
        <StatCard label="Внешние средства" value={formatMoney(totals.cashless, currency)} hint={scopeHint} />
        <StatCard label="Скидочные средства" value={formatMoney(totals.discount, currency)} hint={scopeHint} />
      </div>
      {hasScope && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-panel-muted dark:text-panel-muted-dark">Фильтр KPI и таблицы:</span>
          <span className="max-w-full truncate rounded-full bg-brand-500/10 px-3 py-1 font-medium text-brand-800 dark:text-brand-300">
            {scopeHint}
          </span>
          <button
            type="button"
            className="btn-secondary !px-2 !py-1"
            onClick={clearScope}
            title="Сбросить фильтр"
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
        filters={addressFilter.options.length ? [addressFilter] : []}
        filterValues={{ address: washFilter }}
        onFilterChange={handleFilterChange}
        onRowClick={onPostSelect}
        isRowActive={(s) => Boolean(postFilter && postId(s) === postFilter)}
        pageSize={10}
        emptyMessage="Нет записей"
        searchPlaceholder="Поиск…"
        bulkActions={bulkActions}
      />
    </section>
  );
}

export function FinancePage() {
  const { currency } = useCurrency();

  const fetchData = useCallback(async (): Promise<FinancePageData> => {
    const [stats, posts, washes] = await Promise.all([
      apiList<FinanceStat>('/crm/finance-stats'),
      apiList<Post>('/crm/posts'),
      apiList<Wash>('/crm/washes'),
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
      <PageHeader title="Финансовая статистика" subtitle="До и после инкассации · клик по строке — фильтр по посту" />
      <PeriodSection tableId="finance-before" title={periodLabel.before_collection} stats={before} currency={currency} postById={postById} washById={washById} />
      <PeriodSection tableId="finance-after" title={periodLabel.after_collection} stats={after} currency={currency} postById={postById} washById={washById} />
    </div>
  );
}
