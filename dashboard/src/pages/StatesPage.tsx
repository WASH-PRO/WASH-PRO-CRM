import { useCallback, useMemo } from 'react';
import { apiList } from '../api/client';
import { PageHeader, Loading } from '../components/UI';
import { PostStatesChart } from '../components/PostStatesChart';
import { DataTable, type DataTableBulkAction, type DataTableColumn, type DataTableFilter } from '../components/DataTable';
import { LiveModeTimer } from '../components/LiveModeTimer';
import { usePolling } from '../hooks/usePolling';
import { useCurrency } from '../hooks/useCurrency';
import { LIVE_INTERVAL_FAST_MS } from '../constants/live';
import { formatPause, formatDateTime, formatMoney } from '../utils/format';
import { refId, resolveWashAddress } from '../utils/refs';
import { createExportBulkAction } from '../utils/export';
import type { PostState, Post, Wash, Card } from '../types';

interface StateRow {
  id: string;
  postId: string;
  washId: string;
  address: string;
  postNumber: number;
  balance?: number;
  discount?: number;
  freePause?: number;
  modeTime?: number;
  modeName?: string;
  lastMessageAt?: string;
  hasData: boolean;
  fetchedAt: number;
}

function latestCardByPost(cards: Card[]): Map<string, Card> {
  const byPost = new Map<string, Card>();
  for (const card of cards) {
    const postKey = refId(card.postId);
    if (!postKey) continue;
    const prev = byPost.get(postKey);
    const cardTime = new Date(card.createdAt || 0).getTime();
    const prevTime = prev ? new Date(prev.createdAt || 0).getTime() : -1;
    if (!prev || cardTime >= prevTime) {
      byPost.set(postKey, card);
    }
  }
  return byPost;
}

export function StatesPage() {
  const { currency } = useCurrency();

  const fetchData = useCallback(async () => {
    const [states, posts, washes, cards] = await Promise.all([
      apiList<PostState>('/crm/post-states'),
      apiList<Post>('/crm/posts?populate=washId'),
      apiList<Wash>('/crm/washes'),
      apiList<Card>('/crm/cards'),
    ]);
    const fetchedAt = Date.now();
    const stateByPost = new Map(states.map((s) => [refId(s.postId), s]));
    const washById = new Map(washes.map((w) => [w.id, w]));
    const cardByPost = latestCardByPost(cards);

    const rows: StateRow[] = posts.map((post) => {
      const state = stateByPost.get(post.id);
      const card = cardByPost.get(post.id);
      const hasData = !!(state?.lastMessageAt || state?.modeTime != null || state?.mode);
      return {
        id: state?.id || post.id,
        postId: post.id,
        washId: refId(post.washId),
        address: resolveWashAddress(post.washId, washById),
        postNumber: post.postNumber,
        balance: state?.balance ?? card?.balance,
        discount: state?.discount ?? card?.discount,
        freePause: state?.freePause,
        modeTime: state?.modeTime,
        modeName: state?.modeName || state?.mode,
        lastMessageAt: state?.lastMessageAt,
        hasData,
        fetchedAt,
      };
    });

    return rows;
  }, []);

  const { data: rows, loading } = usePolling(fetchData, [], { intervalMs: LIVE_INTERVAL_FAST_MS });

  const filters: DataTableFilter<StateRow>[] = useMemo(
    () => [
      {
        id: 'hasData',
        label: 'Данные',
        options: [
          { value: 'yes', label: 'Есть данные' },
          { value: 'no', label: 'Ожидание' },
        ],
        match: (r, v) => (v === 'yes' ? r.hasData : !r.hasData),
      },
    ],
    []
  );

  const columns: DataTableColumn<StateRow>[] = useMemo(
    () => [
      {
        key: 'address',
        header: 'Адрес объекта',
        sortable: true,
        searchValue: (r) => r.address,
        sortValue: (r) => r.address,
        render: (r) => r.address,
      },
      {
        key: 'postNumber',
        header: 'Номер поста',
        sortable: true,
        searchValue: (r) => String(r.postNumber),
        sortValue: (r) => r.postNumber,
        render: (r) => <span className="font-mono">{r.postNumber}</span>,
      },
      {
        key: 'balance',
        header: 'Текущий баланс',
        sortable: true,
        searchValue: (r) => String(r.balance ?? ''),
        sortValue: (r) => r.balance ?? -1,
        render: (r) =>
          r.hasData && r.balance != null ? (
            <span className="font-mono">{formatMoney(r.balance, currency)}</span>
          ) : (
            '—'
          ),
      },
      {
        key: 'freePause',
        header: 'Бесплатная пауза',
        sortValue: (r) => r.freePause ?? -1,
        render: (r) => (r.hasData ? formatPause(r.freePause) : '—'),
      },
      {
        key: 'discount',
        header: 'Сумма скидки',
        sortable: true,
        searchValue: (r) => String(r.discount ?? ''),
        sortValue: (r) => r.discount ?? -1,
        render: (r) =>
          r.hasData && r.discount != null ? (
            <span className="font-mono">{formatMoney(r.discount, currency)}</span>
          ) : (
            '—'
          ),
      },
      {
        key: 'modeTime',
        header: 'Время режима',
        sortValue: (r) => r.modeTime ?? -1,
        render: (r) => (
          <LiveModeTimer
            baseSeconds={r.modeTime}
            fetchedAt={r.fetchedAt}
            waiting={!r.hasData}
          />
        ),
      },
      {
        key: 'mode',
        header: 'Режим',
        searchValue: (r) => r.modeName || '',
        sortValue: (r) => r.modeName || '',
        render: (r) => (r.hasData ? r.modeName || '—' : '—'),
      },
      {
        key: 'lastMessageAt',
        header: 'Дата и время',
        sortable: true,
        sortValue: (r) => r.lastMessageAt || '',
        render: (r) => formatDateTime(r.lastMessageAt),
      },
    ],
    [currency]
  );

  const bulkActions = useMemo((): DataTableBulkAction<StateRow>[] => [
    createExportBulkAction('post-states.csv', [
      { header: 'Адрес', value: (r) => r.address },
      { header: 'Пост', value: (r) => String(r.postNumber) },
      { header: 'Текущий баланс', value: (r) => String(r.balance ?? '') },
      { header: 'Бесплатная пауза', value: (r) => String(r.freePause ?? '') },
      { header: 'Сумма скидки', value: (r) => String(r.discount ?? '') },
      { header: 'Время режима', value: (r) => String(r.modeTime ?? '') },
      { header: 'Название режима', value: (r) => r.modeName || '' },
      { header: 'Дата и время', value: (r) => r.lastMessageAt || '' },
    ]),
  ], []);

  if (loading && !rows) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Текущее состояние постов"
        subtitle={`Все посты всех объектов · ${rows?.length ?? 0} постов`}
      />
      <PostStatesChart rows={rows ?? []} currency={currency} />
      <DataTable
        columns={columns}
        data={rows || []}
        rowKey={(r) => r.postId}
        filters={filters}
        searchPlaceholder="Поиск по адресу или номеру поста…"
        pageSize={20}
        bulkActions={bulkActions}
      />
    </div>
  );
}
