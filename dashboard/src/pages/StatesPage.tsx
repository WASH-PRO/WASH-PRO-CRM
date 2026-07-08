import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiListBounded, apiListCatalog } from '../api/client';
import { PageHeader, Loading, ErrorMessage } from '../components/UI';
import { PostOnlineStatus } from '../components/PostOnlineStatus';
import { DataTable, type DataTableBulkAction, type DataTableColumn, type DataTableFilter } from '../components/DataTable';
import { usePolling } from '../hooks/usePolling';
import { useCurrency } from '../hooks/useCurrency';
import { useWorkModes } from '../hooks/useWorkModes';
import { LIVE_INTERVAL_FAST_MS } from '../constants/live';
import { formatPause, formatDateTime, formatMoney } from '../utils/format';
import { refId, resolveWashAddress } from '../utils/refs';
import { latestPostStateByPost, isPostOnline } from '../utils/statsAggregation';
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
  modeName?: string;
  lastMessageAt?: string;
  hasData: boolean;
  isOnline: boolean;
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
  const navigate = useNavigate();
  const { currency } = useCurrency();
  const { label: workModeLabel } = useWorkModes();

  const fetchData = useCallback(async (signal: AbortSignal) => {
    const [states, posts, washes, cards] = await Promise.all([
      apiListBounded<PostState>('/crm/post-states', signal, 5),
      apiListCatalog<Post>('/crm/posts?populate=washId', signal),
      apiListCatalog<Wash>('/crm/washes', signal),
      apiListBounded<Card>('/crm/cards', signal, 5),
    ]);
    const stateByPost = new Map(latestPostStateByPost(states).map((s) => [refId(s.postId), s]));
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
        modeName: state?.modeName || state?.mode,
        lastMessageAt: state?.lastMessageAt,
        hasData,
        isOnline: isPostOnline(state),
      };
    });

    return rows;
  }, []);

  const { data: rows, loading, error, lastUpdatedAt } = usePolling(fetchData, [], { intervalMs: LIVE_INTERVAL_FAST_MS });

  const filters: DataTableFilter<StateRow>[] = useMemo(
    () => [
      {
        id: 'status',
        label: 'Статус',
        options: [
          { value: 'online', label: 'Онлайн' },
          { value: 'offline', label: 'Офлайн' },
        ],
        match: (r, v) => (v === 'online' ? r.isOnline : !r.isOnline),
      },
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
        key: 'status',
        header: 'Статус',
        sortable: true,
        sortValue: (r) => (r.isOnline ? 1 : 0),
        searchValue: (r) => (r.isOnline ? 'онлайн' : 'оффлайн'),
        render: (r) => <PostOnlineStatus state={{ lastMessageAt: r.lastMessageAt }} />,
      },
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
        key: 'mode',
        header: 'Режим',
        searchValue: (r) => (r.hasData ? workModeLabel(r.modeName) : ''),
        sortValue: (r) => (r.hasData ? workModeLabel(r.modeName) : ''),
        render: (r) => (r.hasData ? workModeLabel(r.modeName) : '—'),
      },
      {
        key: 'lastMessageAt',
        header: 'Дата и время',
        sortable: true,
        sortValue: (r) => r.lastMessageAt || '',
        render: (r) => formatDateTime(r.lastMessageAt),
      },
    ],
    [currency, workModeLabel]
  );

  const bulkActions = useMemo((): DataTableBulkAction<StateRow>[] => [
    createExportBulkAction('post-states.csv', [
      { header: 'Статус', value: (r) => (r.isOnline ? 'Онлайн' : 'Офлайн') },
      { header: 'Адрес', value: (r) => r.address },
      { header: 'Пост', value: (r) => String(r.postNumber) },
      { header: 'Текущий баланс', value: (r) => String(r.balance ?? '') },
      { header: 'Бесплатная пауза', value: (r) => String(r.freePause ?? '') },
      { header: 'Сумма скидки', value: (r) => String(r.discount ?? '') },
      { header: 'Название режима', value: (r) => workModeLabel(r.modeName) },
      { header: 'Дата и время', value: (r) => r.lastMessageAt || '' },
    ]),
  ], [workModeLabel]);

  if (loading && !rows) return <Loading />;
  if (error && !rows) {
    return (
      <div>
        <PageHeader title="Текущее состояние постов" />
        <ErrorMessage message={error} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Текущее состояние постов"
        subtitle={`Все посты · ${rows?.length ?? 0} · обновлено ${lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString('ru') : '—'}`}
      />
      <DataTable
        tableId="states"
        columns={columns}
        data={rows || []}
        rowKey={(r) => r.postId}
        filters={filters}
        searchPlaceholder="Поиск по адресу или номеру поста…"
        bulkActions={bulkActions}
        onRowClick={(r) => navigate(`/posts/${r.postId}`)}
      />
    </div>
  );
}
