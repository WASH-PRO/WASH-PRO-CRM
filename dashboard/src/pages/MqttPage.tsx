import { useCallback, useMemo, useState } from 'react';
import { apiListPage } from '../api/client';
import { PageHeader, Loading, Badge } from '../components/UI';
import { DataTable, type DataTableBulkAction, type DataTableColumn, type DataTableFilter } from '../components/DataTable';
import { usePolling } from '../hooks/usePolling';
import { LIVE_INTERVAL_FAST_MS } from '../constants/live';
import { formatDateTime } from '../utils/format';
import { createExportBulkAction } from '../utils/export';
import { useLocale } from '../i18n/LocaleContext';

export interface MqttTelemetryRow {
  id: string;
  mqttTopic?: string;
  washSerial?: string;
  postSerial?: string;
  messageType: string;
  payload: Record<string, unknown>;
  receivedAt?: string;
}

const MESSAGE_TYPE_LABEL_KEYS: Record<string, string> = {
  process: 'state',
  state: 'state',
  mode: 'mode',
  totals: 'finance',
  finance: 'finance',
  usages: 'usage',
  statistics: 'usage',
  credit: 'credit',
  card: 'card',
  settings: 'settings',
  command: 'command',
  prices: 'prices',
  equipment: 'equipment',
  event: 'event',
  dlq: 'dlq',
  unknown: 'unknown',
};

const MESSAGE_TYPE_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  process: 'default',
  state: 'default',
  totals: 'success',
  finance: 'success',
  usages: 'warning',
  statistics: 'warning',
  credit: 'success',
  card: 'default',
  settings: 'warning',
  command: 'warning',
  prices: 'warning',
  event: 'error',
  dlq: 'error',
  unknown: 'error',
};

function payloadPreview(payload: Record<string, unknown>, emptyFallback: string, max = 120): string {
  try {
    const text = JSON.stringify(payload);
    return text.length > max ? `${text.slice(0, max)}…` : text;
  } catch {
    return emptyFallback;
  }
}

function messageTypeLabel(type: string, t: (key: string) => string): string {
  const key = MESSAGE_TYPE_LABEL_KEYS[type];
  return key ? t(`pages.mqtt.messageTypes.${key}`) : type;
}

function topicSuffix(topic?: string): string {
  if (!topic) return '';
  const parts = topic.split('/');
  return parts[parts.length - 1] || '';
}

const MQTT_PAGE_SIZE = 100;

export function MqttPage() {
  const { t, locale } = useLocale();
  const [pages, setPages] = useState(1);
  const [totalRows, setTotalRows] = useState<number | null>(null);

  const fetchData = useCallback(async (signal: AbortSignal) => {
    const all: MqttTelemetryRow[] = [];
    let totalPages = 1;
    let total = 0;
    for (let page = 1; page <= pages; page++) {
      const { data, pagination } = await apiListPage<MqttTelemetryRow>(
        '/crm/telemetry',
        page,
        MQTT_PAGE_SIZE,
        signal
      );
      all.push(...data);
      totalPages = pagination.totalPages;
      total = pagination.total;
    }
    const rows = all.sort((a, b) => {
      const ta = new Date(a.receivedAt || 0).getTime();
      const tb = new Date(b.receivedAt || 0).getTime();
      return tb - ta;
    });
    setTotalRows(total);
    return { rows, hasMore: pages < totalPages };
  }, [pages]);

  const { data, loading, lastUpdatedAt } = usePolling(fetchData, [pages], { intervalMs: LIVE_INTERVAL_FAST_MS });
  const rows = data?.rows;
  const hasMore = data?.hasMore ?? false;

  const typeOptions = useMemo(() => {
    const types = new Set((rows || []).map((r) => r.messageType).filter(Boolean));
    return [...types].sort().map((type) => ({ value: type, label: messageTypeLabel(type, t) }));
  }, [rows, t]);

  const suffixOptions = useMemo(() => {
    const suffixes = new Set((rows || []).map((r) => topicSuffix(r.mqttTopic)).filter(Boolean));
    return [...suffixes].sort().map((s) => ({ value: s, label: messageTypeLabel(s, t) }));
  }, [rows, t]);

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows || []) {
      const label = messageTypeLabel(row.messageType, t);
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows, t]);

  const filters: DataTableFilter<MqttTelemetryRow>[] = useMemo(
    () => [
      {
        id: 'messageType',
        label: t('pages.mqtt.filters.messageType'),
        options: typeOptions,
        match: (r, v) => r.messageType === v,
      },
      {
        id: 'topicSuffix',
        label: t('pages.mqtt.filters.topicSuffix'),
        options: suffixOptions,
        match: (r, v) => topicSuffix(r.mqttTopic) === v,
      },
    ],
    [typeOptions, suffixOptions, t]
  );

  const columns: DataTableColumn<MqttTelemetryRow>[] = useMemo(
    () => [
      {
        key: 'receivedAt',
        header: t('pages.mqtt.columns.receivedAt'),
        className: 'table-cell-nowrap',
        sortable: true,
        sortValue: (r) => r.receivedAt || '',
        render: (r) => <span className="text-sm">{formatDateTime(r.receivedAt)}</span>,
      },
      {
        key: 'messageType',
        header: t('notificationsTable.type'),
        className: 'table-cell-nowrap',
        sortable: true,
        searchValue: (r) => `${r.messageType} ${messageTypeLabel(r.messageType, t)}`,
        sortValue: (r) => r.messageType,
        render: (r) => (
          <Badge variant={MESSAGE_TYPE_VARIANT[r.messageType] || 'default'}>
            {messageTypeLabel(r.messageType, t)}
          </Badge>
        ),
      },
      {
        key: 'mqttTopic',
        header: t('pages.mqtt.columns.topic'),
        sortable: true,
        searchValue: (r) => r.mqttTopic || '',
        sortValue: (r) => r.mqttTopic || '',
        render: (r) => (
          <code className="text-xs text-brand-700 dark:text-brand-300">{r.mqttTopic || t('common.notAvailable')}</code>
        ),
      },
      {
        key: 'postSerial',
        header: t('refs.post'),
        className: 'table-cell-nowrap',
        sortable: true,
        searchValue: (r) => r.postSerial || '',
        sortValue: (r) => r.postSerial || '',
        render: (r) => <span className="font-mono text-sm">{r.postSerial || t('common.notAvailable')}</span>,
      },
      {
        key: 'payload',
        header: t('pages.mqtt.columns.payload'),
        searchValue: (r) => payloadPreview(r.payload, t('common.notAvailable'), 500),
        render: (r) => (
          <pre
            className="max-w-[min(100%,20rem)] overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-panel-canvas px-2 py-1 font-mono text-[11px] text-panel-muted dark:bg-panel-canvas-dark dark:text-panel-muted-dark sm:max-w-md"
            title={JSON.stringify(r.payload, null, 2)}
          >
            {payloadPreview(r.payload, t('common.notAvailable'))}
          </pre>
        ),
      },
    ],
    [t]
  );

  const bulkActions = useMemo((): DataTableBulkAction<MqttTelemetryRow>[] => [
    createExportBulkAction('mqtt-messages.csv', [
      { header: t('pages.mqtt.columns.receivedAt'), value: (r) => r.receivedAt || '' },
      { header: t('notificationsTable.type'), value: (r) => r.messageType },
      { header: t('pages.mqtt.columns.topic'), value: (r) => r.mqttTopic || '' },
      { header: t('refs.post'), value: (r) => r.postSerial || '' },
      { header: t('pages.mqtt.columns.payloadData'), value: (r) => JSON.stringify(r.payload) },
    ]),
  ], [t]);

  if (loading && !rows) return <Loading />;

  const countSummary = typeCounts
    .slice(0, 6)
    .map(([label, n]) => `${label}: ${n}`)
    .join(' · ');
  const subtitle = `${t('pages.mqtt.subtitleBase', { shown: rows?.length ?? 0 })}${
    totalRows != null ? t('pages.mqtt.subtitleOfTotal', { total: totalRows }) : ''
  }${countSummary ? t('pages.mqtt.subtitleCounts', { counts: countSummary }) : ''}${t('pages.mqtt.subtitleUpdated', {
    updatedAt: lastUpdatedAt
      ? new Date(lastUpdatedAt).toLocaleTimeString(locale === 'ru' ? 'ru-RU' : 'en-US')
      : t('common.notAvailable'),
  })}`;

  return (
    <div>
      <PageHeader
        title="MQTT"
        subtitle={subtitle}
      />
      <p className="mb-4 text-sm text-panel-muted dark:text-panel-muted-dark">
        {t('pages.mqtt.descriptionIntro')} <strong>{t('pages.mqtt.descriptionEvery')}</strong>{' '}
        {t('pages.mqtt.descriptionAsIs')}{' '}
        <code className="text-xs">state/process</code> ({t('pages.mqtt.messageTypes.state')}),{' '}
        <code className="text-xs">state/totals</code> ({t('pages.mqtt.messageTypes.finance')}),{' '}
        <code className="text-xs">state/usages</code> ({t('pages.mqtt.messageTypes.usage')}),{' '}
        <code className="text-xs">state/credit</code>, <code className="text-xs">state/card</code>,{' '}
        <code className="text-xs">set/*</code> ({t('pages.mqtt.descriptionSetFamily')}),{' '}
        <code className="text-xs">dlq</code> ({t('pages.mqtt.descriptionDlq')}) {t('pages.mqtt.descriptionLegacy')}{' '}
        <code className="text-xs">wash/telemetry/*</code>.
      </p>
      {hasMore && (
        <div className="mb-4">
          <button type="button" className="btn-secondary btn-sm" onClick={() => setPages((p) => p + 1)}>
            {t('pages.mqtt.loadMore', { count: MQTT_PAGE_SIZE })}
          </button>
        </div>
      )}
      <DataTable
        tableId="mqtt"
        columns={columns}
        data={rows || []}
        rowKey={(r) => r.id}
        filters={filters}
        searchPlaceholder={t('pages.mqtt.searchPlaceholder')}
        bulkActions={bulkActions}
      />
    </div>
  );
}
