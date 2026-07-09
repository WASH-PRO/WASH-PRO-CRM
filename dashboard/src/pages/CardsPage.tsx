import { useCallback, useMemo, useState, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { apiListCatalog, apiListPage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Loading, Badge, ErrorMessage } from '../components/UI';
import { TabNav } from '../components/TabNav';
import { DataTable, type DataTableBulkAction, type DataTableColumn, type DataTableFilter } from '../components/DataTable';
import { DEFAULT_LIVE_INTERVAL_MS } from '../constants/live';
import { usePolling } from '../hooks/usePolling';
import { formatMoney, formatDateTime } from '../utils/format';
import { useCurrency } from '../hooks/useCurrency';
import { useDiscountTypes } from '../hooks/useDiscountTypes';
import { bulkPut } from '../utils/bulk';
import { createExportBulkAction } from '../utils/export';
import { refId } from '../utils/refs';
import { resolvePostNumber, resolveStatWashAddress } from '../utils/statsAggregation';
import {
  getCardStatusLabels,
  getCardStatusBadgeVariant,
  getCardStatusLabel,
  normalizeCardStatus,
} from '../utils/cards';
import type { Card, Post, Wash } from '../types';
import { useLocale } from '../i18n/LocaleContext';

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

interface CardsColumnContext {
  currency: { code: string; symbol?: string };
  address: (c: Card) => string;
  postNumber: (c: Card) => string;
  discountTypeLabel: (c: Card) => string;
}

function addressColumn(ctx: CardsColumnContext, t: TranslateFn): DataTableColumn<Card> {
  return {
    key: 'address',
    header: t('pages.cards.columns.washAddress'),
    sortable: true,
    searchValue: (c) => ctx.address(c),
    sortValue: (c) => ctx.address(c),
    render: (c) => ctx.address(c),
  };
}

function postNumberColumn(ctx: CardsColumnContext, t: TranslateFn): DataTableColumn<Card> {
  return {
    key: 'postNumber',
    header: t('pages.cards.columns.postNumber'),
    sortable: true,
    searchValue: (c) => ctx.postNumber(c),
    sortValue: (c) => Number(ctx.postNumber(c)) || 0,
    render: (c) => <span className="font-mono">{ctx.postNumber(c)}</span>,
  };
}

function statusColumn(t: TranslateFn): DataTableColumn<Card> {
  return {
    key: 'status',
    header: t('common.status'),
    sortable: true,
    sortValue: (c) => c.status,
    render: (c) => (
      <Badge variant={getCardStatusBadgeVariant(c.status)}>
        {getCardStatusLabel(c.status)}
      </Badge>
    ),
  };
}

function datetimeColumn(t: TranslateFn): DataTableColumn<Card> {
  return {
    key: 'createdAt',
    header: t('notificationsTable.dateTime'),
    sortable: true,
    sortValue: (c) => c.createdAt || '',
    render: (c) => formatDateTime(c.createdAt),
  };
}

function discountColumns(ctx: CardsColumnContext, t: TranslateFn): DataTableColumn<Card>[] {
  return [
    {
      key: 'cardNumber',
      header: t('pages.cards.columns.cardNumber'),
      sortable: true,
      searchValue: (c) => c.cardNumber,
      sortValue: (c) => c.cardNumber,
      render: (c) => <span className="font-mono">{c.cardNumber}</span>,
    },
    {
      key: 'discountType',
      header: t('pages.cards.columns.discountType'),
      sortable: true,
      searchValue: (c) => ctx.discountTypeLabel(c),
      sortValue: (c) => ctx.discountTypeLabel(c),
      render: (c) => ctx.discountTypeLabel(c),
    },
    {
      key: 'balance',
      header: t('postStatesChart.balance'),
      sortable: true,
      sortValue: (c) => c.balance,
      render: (c) => formatMoney(c.balance, ctx.currency),
    },
    {
      key: 'discount',
      header: t('pages.cards.columns.discountAmount'),
      sortable: true,
      sortValue: (c) => c.discount,
      render: (c) => formatMoney(c.discount, ctx.currency),
    },
    addressColumn(ctx, t),
    postNumberColumn(ctx, t),
    statusColumn(t),
    datetimeColumn(t),
  ];
}

function collectionColumns(ctx: CardsColumnContext, t: TranslateFn): DataTableColumn<Card>[] {
  return [
    {
      key: 'cardNumber',
      header: t('pages.cards.columns.cardNumber'),
      sortable: true,
      searchValue: (c) => c.cardNumber,
      sortValue: (c) => c.cardNumber,
      render: (c) => <span className="font-mono">{c.cardNumber}</span>,
    },
    addressColumn(ctx, t),
    postNumberColumn(ctx, t),
    statusColumn(t),
    datetimeColumn(t),
  ];
}

function periodColumns(ctx: CardsColumnContext, t: TranslateFn): DataTableColumn<Card>[] {
  return [
    {
      key: 'cardNumber',
      header: t('pages.cards.columns.cardNumber'),
      sortable: true,
      searchValue: (c) => c.cardNumber,
      sortValue: (c) => c.cardNumber,
      render: (c) => <span className="font-mono">{c.cardNumber}</span>,
    },
    {
      key: 'validFrom',
      header: t('pages.cards.columns.validFrom'),
      sortable: true,
      sortValue: (c) => c.validFrom || '',
      render: (c) => formatDateTime(c.validFrom),
    },
    {
      key: 'validUntil',
      header: t('pages.cards.columns.validUntil'),
      sortable: true,
      sortValue: (c) => c.validUntil || '',
      render: (c) => formatDateTime(c.validUntil),
    },
    addressColumn(ctx, t),
    postNumberColumn(ctx, t),
    statusColumn(t),
    datetimeColumn(t),
  ];
}

export function CardsLayout() {
  const { t } = useLocale();
  const cardTabs = useMemo(
    () => [
      { to: '/cards/discount', label: t('pages.cards.tabs.discount') },
      { to: '/cards/service', label: t('pages.cards.tabs.service') },
      { to: '/cards/vip', label: t('pages.cards.tabs.vip') },
      { to: '/cards/collection', label: t('pages.cards.tabs.collection') },
    ],
    [t]
  );
  return (
    <div>
      <PageHeader title={t('pages.cards.title')} subtitle={t('pages.cards.subtitle')} />
      <TabNav items={cardTabs} columns={4} />
      <Suspense fallback={<Loading />}>
        <Outlet />
      </Suspense>
    </div>
  );
}

export function CardsDiscountPage() {
  const { t } = useLocale();
  return <CardsTable cardType="regular" title={t('pages.cards.tabs.discount')} />;
}

export function CardsServicePage() {
  const { t } = useLocale();
  return <CardsTable cardType="service" title={t('pages.cards.tabs.service')} period />;
}

export function CardsVipPage() {
  const { t } = useLocale();
  return <CardsTable cardType="unlimited" title={t('pages.cards.tabs.vip')} period />;
}

export function CardsCollectionPage() {
  const { t } = useLocale();
  return <CardsTable cardType="collection" title={t('pages.cards.tabs.collection')} collection />;
}

const CARDS_PAGE_SIZE = 100;

function CardsTable({
  cardType,
  title,
  period,
  collection,
}: {
  cardType: Card['cardType'];
  title: string;
  period?: boolean;
  collection?: boolean;
}) {
  const { t } = useLocale();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('update');
  const { currency } = useCurrency();
  const { label: discountTypeLabel } = useDiscountTypes();
  const [cardPages, setCardPages] = useState(5);
  const cardStatusLabels = useMemo(() => getCardStatusLabels(t), [t]);

  const cardStatusFilter: DataTableFilter<Card> = useMemo(
    () => ({
      id: 'status',
      label: t('common.status'),
      options: [
        { value: 'success', label: cardStatusLabels.success },
        { value: 'rejected', label: cardStatusLabels.rejected },
      ],
      match: (c, v) => c.status === v,
    }),
    [cardStatusLabels, t]
  );

  const fetchData = useCallback(async (signal: AbortSignal) => {
    const all: Card[] = [];
    let totalPages = 1;
    let cardsTotal = 0;
    for (let page = 1; page <= cardPages; page++) {
      const { data, pagination } = await apiListPage<Card>(
        '/crm/cards?populate=postId,washId',
        page,
        CARDS_PAGE_SIZE,
        signal
      );
      all.push(...data);
      totalPages = pagination.totalPages;
      cardsTotal = pagination.total;
    }
    const [posts, washes] = await Promise.all([
      apiListCatalog<Post>('/crm/posts', signal),
      apiListCatalog<Wash>('/crm/washes', signal),
    ]);
    return {
      cards: all.map((c) => ({ ...c, status: normalizeCardStatus(c.status) })),
      posts,
      washes,
      hasMoreCards: cardPages < totalPages,
      cardsTotal,
    };
  }, [cardPages]);

  const { data, loading, error, refresh } = usePolling(fetchData, [cardPages], { intervalMs: DEFAULT_LIVE_INTERVAL_MS });

  const postById = useMemo(
    () => new Map((data?.posts || []).map((p) => [p.id, p])),
    [data?.posts]
  );
  const washById = useMemo(
    () => new Map((data?.washes || []).map((w) => [w.id, w])),
    [data?.washes]
  );

  const address = useCallback(
    (c: Card) => resolveStatWashAddress(c.washId ?? '', c.postId, postById, washById),
    [postById, washById]
  );

  const postNumber = useCallback(
    (c: Card) => resolvePostNumber(c.postId, postById),
    [postById]
  );

  const filtered = useMemo(
    () => (data?.cards || []).filter((c) => c.cardType === cardType),
    [data?.cards, cardType]
  );

  const columnCtx = useMemo(
    (): CardsColumnContext => ({
      currency,
      address,
      postNumber,
      discountTypeLabel: (c) => discountTypeLabel(c.discountType),
    }),
    [currency, address, postNumber, discountTypeLabel]
  );

  const columns = useMemo(
    () =>
      collection
        ? collectionColumns(columnCtx, t)
        : period
          ? periodColumns(columnCtx, t)
          : discountColumns(columnCtx, t),
    [collection, period, columnCtx, t]
  );

  const bulkActions = useMemo((): DataTableBulkAction<Card>[] => {
    const actions: DataTableBulkAction<Card>[] = [
      createExportBulkAction(`cards-${cardType}.csv`, collection
        ? [
            { header: t('pages.cards.columns.cardNumber'), value: (c) => c.cardNumber },
            { header: t('pages.cards.columns.washAddress'), value: (c) => address(c) },
            { header: t('pages.cards.columns.postNumber'), value: (c) => postNumber(c) },
            { header: t('common.status'), value: (c) => getCardStatusLabel(c.status) },
            { header: t('notificationsTable.dateTime'), value: (c) => c.createdAt || '' },
          ]
        : period
        ? [
            { header: t('pages.cards.columns.cardNumber'), value: (c) => c.cardNumber },
            { header: t('pages.cards.columns.validFromShort'), value: (c) => c.validFrom || '' },
            { header: t('pages.cards.columns.validUntilShort'), value: (c) => c.validUntil || '' },
            { header: t('pages.cards.columns.washAddress'), value: (c) => address(c) },
            { header: t('pages.cards.columns.postNumber'), value: (c) => postNumber(c) },
            { header: t('common.status'), value: (c) => getCardStatusLabel(c.status) },
            { header: t('notificationsTable.dateTime'), value: (c) => c.createdAt || '' },
          ]
        : [
            { header: t('pages.cards.columns.cardNumber'), value: (c) => c.cardNumber },
            { header: t('pages.cards.columns.discountType'), value: (c) => discountTypeLabel(c.discountType) },
            { header: t('postStatesChart.balance'), value: (c) => String(c.balance) },
            { header: t('pages.cards.columns.discountAmount'), value: (c) => String(c.discount) },
            { header: t('pages.cards.columns.washAddress'), value: (c) => address(c) },
            { header: t('pages.cards.columns.postNumber'), value: (c) => postNumber(c) },
            { header: t('common.status'), value: (c) => getCardStatusLabel(c.status) },
            { header: t('notificationsTable.dateTime'), value: (c) => c.createdAt || '' },
          ]),
    ];

    if (canEdit) {
      const setStatus = (status: string, label: string): DataTableBulkAction<Card> => ({
        id: `status-${status}`,
        label,
        confirmMessage: (_rows, ids) => t('pages.cards.confirmChangeStatus', { count: ids.length }),
        onAction: async (rows) => {
          await bulkPut('/crm/cards', rows, (c) => c.id, (c) => ({
            ...c,
            washId: refId(c.washId),
            postId: refId(c.postId),
            status,
          }));
          refresh();
        },
      });
      actions.push(setStatus('success', cardStatusLabels.success), setStatus('rejected', cardStatusLabels.rejected));
    }

    return actions;
  }, [canEdit, cardType, collection, period, address, postNumber, discountTypeLabel, refresh, t, cardStatusLabels]);

  if (loading && !data) return <Loading />;
  if (error && !data) {
    return (
      <div>
        <PageHeader title={title} />
        <ErrorMessage message={error} />
      </div>
    );
  }

  return (
    <>
      {data?.hasMoreCards && (
        <div className="mb-4">
          <button type="button" className="btn-secondary btn-sm" onClick={() => setCardPages((p) => p + 5)}>
            {t('pages.cards.loadMore', { count: 5 * CARDS_PAGE_SIZE })}
          </button>
          {data.cardsTotal != null && (
            <span className="ml-3 text-sm text-panel-muted dark:text-panel-muted-dark">
              {t('pages.cards.loadedCount', { loaded: data.cards.length, total: data.cardsTotal })}
            </span>
          )}
        </div>
      )}
      <DataTable
      tableId={`cards-${cardType}`}
      columns={columns}
      data={filtered}
      rowKey={(c) => c.id}
      filters={[cardStatusFilter]}
      searchPlaceholder={t('pages.cards.searchInSection', { section: title })}
      bulkActions={bulkActions}
      defaultSortKey="createdAt"
      defaultSortDir="desc"
    />
    </>
  );
}

/** @deprecated use CardsLayout + subpages */
export function CardsPage() {
  return <CardsDiscountPage />;
}
