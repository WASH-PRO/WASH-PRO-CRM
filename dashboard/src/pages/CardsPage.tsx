import { useCallback, useMemo } from 'react';
import { Outlet } from 'react-router-dom';
import { apiList } from '../api/client';
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
  CARD_STATUS_LABELS,
  getCardStatusBadgeVariant,
  getCardStatusLabel,
  normalizeCardStatus,
} from '../utils/cards';
import type { Card, Post, Wash } from '../types';

const CARD_TABS = [
  { to: '/cards/discount', label: 'Скидочные карты' },
  { to: '/cards/service', label: 'Сервисные карты' },
  { to: '/cards/vip', label: 'VIP-обслуживание' },
  { to: '/cards/collection', label: 'Инкассация' },
];

const cardStatusFilter: DataTableFilter<Card> = {
  id: 'status',
  label: 'Статус',
  options: [
    { value: 'success', label: CARD_STATUS_LABELS.success },
    { value: 'rejected', label: CARD_STATUS_LABELS.rejected },
  ],
  match: (c, v) => c.status === v,
};

interface CardsColumnContext {
  currency: { code: string; symbol?: string };
  address: (c: Card) => string;
  postNumber: (c: Card) => string;
  discountTypeLabel: (c: Card) => string;
}

function addressColumn(ctx: CardsColumnContext): DataTableColumn<Card> {
  return {
    key: 'address',
    header: 'Адрес объекта',
    sortable: true,
    searchValue: (c) => ctx.address(c),
    sortValue: (c) => ctx.address(c),
    render: (c) => ctx.address(c),
  };
}

function postNumberColumn(ctx: CardsColumnContext): DataTableColumn<Card> {
  return {
    key: 'postNumber',
    header: 'Номер поста',
    sortable: true,
    searchValue: (c) => ctx.postNumber(c),
    sortValue: (c) => Number(ctx.postNumber(c)) || 0,
    render: (c) => <span className="font-mono">{ctx.postNumber(c)}</span>,
  };
}

function statusColumn(): DataTableColumn<Card> {
  return {
    key: 'status',
    header: 'Статус',
    sortable: true,
    sortValue: (c) => c.status,
    render: (c) => (
      <Badge variant={getCardStatusBadgeVariant(c.status)}>
        {getCardStatusLabel(c.status)}
      </Badge>
    ),
  };
}

function datetimeColumn(): DataTableColumn<Card> {
  return {
    key: 'createdAt',
    header: 'Дата и время',
    sortable: true,
    sortValue: (c) => c.createdAt || '',
    render: (c) => formatDateTime(c.createdAt),
  };
}

function discountColumns(ctx: CardsColumnContext): DataTableColumn<Card>[] {
  return [
    {
      key: 'cardNumber',
      header: 'Номер карты',
      sortable: true,
      searchValue: (c) => c.cardNumber,
      sortValue: (c) => c.cardNumber,
      render: (c) => <span className="font-mono">{c.cardNumber}</span>,
    },
    {
      key: 'discountType',
      header: 'Тип скидки',
      sortable: true,
      searchValue: (c) => ctx.discountTypeLabel(c),
      sortValue: (c) => ctx.discountTypeLabel(c),
      render: (c) => ctx.discountTypeLabel(c),
    },
    {
      key: 'balance',
      header: 'Баланс',
      sortable: true,
      sortValue: (c) => c.balance,
      render: (c) => formatMoney(c.balance, ctx.currency),
    },
    {
      key: 'discount',
      header: 'Сумма скидки',
      sortable: true,
      sortValue: (c) => c.discount,
      render: (c) => formatMoney(c.discount, ctx.currency),
    },
    addressColumn(ctx),
    postNumberColumn(ctx),
    statusColumn(),
    datetimeColumn(),
  ];
}

function collectionColumns(ctx: CardsColumnContext): DataTableColumn<Card>[] {
  return [
    {
      key: 'cardNumber',
      header: 'Номер карты',
      sortable: true,
      searchValue: (c) => c.cardNumber,
      sortValue: (c) => c.cardNumber,
      render: (c) => <span className="font-mono">{c.cardNumber}</span>,
    },
    addressColumn(ctx),
    postNumberColumn(ctx),
    statusColumn(),
    datetimeColumn(),
  ];
}

function periodColumns(ctx: CardsColumnContext): DataTableColumn<Card>[] {
  return [
    {
      key: 'cardNumber',
      header: 'Номер карты',
      sortable: true,
      searchValue: (c) => c.cardNumber,
      sortValue: (c) => c.cardNumber,
      render: (c) => <span className="font-mono">{c.cardNumber}</span>,
    },
    {
      key: 'validFrom',
      header: 'Начало действия',
      sortable: true,
      sortValue: (c) => c.validFrom || '',
      render: (c) => (c.validFrom ? new Date(c.validFrom).toLocaleString('ru') : '—'),
    },
    {
      key: 'validUntil',
      header: 'Окончание действия',
      sortable: true,
      sortValue: (c) => c.validUntil || '',
      render: (c) => (c.validUntil ? new Date(c.validUntil).toLocaleString('ru') : '—'),
    },
    addressColumn(ctx),
    postNumberColumn(ctx),
    statusColumn(),
    datetimeColumn(),
  ];
}

export function CardsLayout() {
  return (
    <div>
      <PageHeader title="Карты" subtitle="Журнал применений: каждое считывание NFC — отдельная строка" />
      <TabNav items={CARD_TABS} columns={4} />
      <Outlet />
    </div>
  );
}

export function CardsDiscountPage() {
  return <CardsTable cardType="regular" title="Скидочные карты" />;
}

export function CardsServicePage() {
  return <CardsTable cardType="service" title="Сервисные карты" period />;
}

export function CardsVipPage() {
  return <CardsTable cardType="unlimited" title="VIP-обслуживание" period />;
}

export function CardsCollectionPage() {
  return <CardsTable cardType="collection" title="Инкассация" collection />;
}

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
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('update');
  const { currency } = useCurrency();
  const { label: discountTypeLabel } = useDiscountTypes();

  const fetchData = useCallback(async (signal: AbortSignal) => {
    const [cards, posts, washes] = await Promise.all([
      apiList<Card>('/crm/cards?populate=postId,washId', signal),
      apiList<Post>('/crm/posts', signal),
      apiList<Wash>('/crm/washes', signal),
    ]);
    return {
      cards: cards.map((c) => ({ ...c, status: normalizeCardStatus(c.status) })),
      posts,
      washes,
    };
  }, []);

  const { data, loading, error, refresh } = usePolling(fetchData, [], { intervalMs: DEFAULT_LIVE_INTERVAL_MS });

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
      collection ? collectionColumns(columnCtx) : period ? periodColumns(columnCtx) : discountColumns(columnCtx),
    [collection, period, columnCtx]
  );

  const bulkActions = useMemo((): DataTableBulkAction<Card>[] => {
    const actions: DataTableBulkAction<Card>[] = [
      createExportBulkAction(`cards-${cardType}.csv`, collection
        ? [
            { header: 'Номер карты', value: (c) => c.cardNumber },
            { header: 'Адрес объекта', value: (c) => address(c) },
            { header: 'Номер поста', value: (c) => postNumber(c) },
            { header: 'Статус', value: (c) => getCardStatusLabel(c.status) },
            { header: 'Дата и время', value: (c) => c.createdAt || '' },
          ]
        : period
        ? [
            { header: 'Номер карты', value: (c) => c.cardNumber },
            { header: 'Начало', value: (c) => c.validFrom || '' },
            { header: 'Окончание', value: (c) => c.validUntil || '' },
            { header: 'Адрес объекта', value: (c) => address(c) },
            { header: 'Номер поста', value: (c) => postNumber(c) },
            { header: 'Статус', value: (c) => getCardStatusLabel(c.status) },
            { header: 'Дата и время', value: (c) => c.createdAt || '' },
          ]
        : [
            { header: 'Номер карты', value: (c) => c.cardNumber },
            { header: 'Тип скидки', value: (c) => discountTypeLabel(c.discountType) },
            { header: 'Баланс', value: (c) => String(c.balance) },
            { header: 'Сумма скидки', value: (c) => String(c.discount) },
            { header: 'Адрес объекта', value: (c) => address(c) },
            { header: 'Номер поста', value: (c) => postNumber(c) },
            { header: 'Статус', value: (c) => getCardStatusLabel(c.status) },
            { header: 'Дата и время', value: (c) => c.createdAt || '' },
          ]),
    ];

    if (canEdit) {
      const setStatus = (status: string, label: string): DataTableBulkAction<Card> => ({
        id: `status-${status}`,
        label,
        confirmMessage: (_rows, ids) => `Изменить статус у ${ids.length} карт?`,
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
      actions.push(setStatus('success', 'Успешно'), setStatus('rejected', 'Отклонено'));
    }

    return actions;
  }, [canEdit, cardType, collection, period, address, postNumber, discountTypeLabel, refresh]);

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
    <DataTable
      tableId={`cards-${cardType}`}
      columns={columns}
      data={filtered}
      rowKey={(c) => c.id}
      filters={[cardStatusFilter]}
      searchPlaceholder={`Поиск в разделе «${title}»…`}
      bulkActions={bulkActions}
      defaultSortKey="createdAt"
      defaultSortDir="desc"
    />
  );
}

/** @deprecated use CardsLayout + subpages */
export function CardsPage() {
  return <CardsDiscountPage />;
}
