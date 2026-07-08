import { useCallback, useMemo, useState } from 'react';
import { apiListPage } from '../api/client';
import { PageHeader, Loading, Badge } from '../components/UI';
import { DataTable, type DataTableBulkAction, type DataTableColumn, type DataTableFilter } from '../components/DataTable';
import { usePolling } from '../hooks/usePolling';
import { LIVE_INTERVAL_FAST_MS } from '../constants/live';
import { formatDateTime } from '../utils/format';
import { createExportBulkAction } from '../utils/export';

export interface MqttTelemetryRow {
  id: string;
  mqttTopic?: string;
  washSerial?: string;
  postSerial?: string;
  messageType: string;
  payload: Record<string, unknown>;
  receivedAt?: string;
}

const MESSAGE_TYPE_LABELS: Record<string, string> = {
  process: 'Состояние',
  state: 'Состояние',
  mode: 'Режим',
  totals: 'Финансы',
  finance: 'Финансы',
  usages: 'Использование',
  statistics: 'Использование',
  credit: 'Зачисление',
  card: 'Карта',
  settings: 'Настройки',
  command: 'Команда',
  prices: 'Цены',
  equipment: 'Оборудование',
  event: 'Событие',
  dlq: 'DLQ (ошибка)',
  unknown: 'Неизвестно',
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

function payloadPreview(payload: Record<string, unknown>, max = 120): string {
  try {
    const text = JSON.stringify(payload);
    return text.length > max ? `${text.slice(0, max)}…` : text;
  } catch {
    return '—';
  }
}

function messageTypeLabel(type: string): string {
  return MESSAGE_TYPE_LABELS[type] || type;
}

function topicSuffix(topic?: string): string {
  if (!topic) return '';
  const parts = topic.split('/');
  return parts[parts.length - 1] || '';
}

const MQTT_PAGE_SIZE = 100;

export function MqttPage() {
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
    return [...types].sort().map((t) => ({ value: t, label: messageTypeLabel(t) }));
  }, [rows]);

  const suffixOptions = useMemo(() => {
    const suffixes = new Set((rows || []).map((r) => topicSuffix(r.mqttTopic)).filter(Boolean));
    return [...suffixes].sort().map((s) => ({ value: s, label: messageTypeLabel(s) }));
  }, [rows]);

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows || []) {
      const label = messageTypeLabel(row.messageType);
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const filters: DataTableFilter<MqttTelemetryRow>[] = useMemo(
    () => [
      {
        id: 'messageType',
        label: 'Тип сообщения',
        options: typeOptions,
        match: (r, v) => r.messageType === v,
      },
      {
        id: 'topicSuffix',
        label: 'Суффикс топика',
        options: suffixOptions,
        match: (r, v) => topicSuffix(r.mqttTopic) === v,
      },
    ],
    [typeOptions, suffixOptions]
  );

  const columns: DataTableColumn<MqttTelemetryRow>[] = useMemo(
    () => [
      {
        key: 'receivedAt',
        header: 'Получено',
        className: 'table-cell-nowrap',
        sortable: true,
        sortValue: (r) => r.receivedAt || '',
        render: (r) => <span className="text-sm">{formatDateTime(r.receivedAt)}</span>,
      },
      {
        key: 'messageType',
        header: 'Тип',
        className: 'table-cell-nowrap',
        sortable: true,
        searchValue: (r) => `${r.messageType} ${messageTypeLabel(r.messageType)}`,
        sortValue: (r) => r.messageType,
        render: (r) => (
          <Badge variant={MESSAGE_TYPE_VARIANT[r.messageType] || 'default'}>
            {messageTypeLabel(r.messageType)}
          </Badge>
        ),
      },
      {
        key: 'mqttTopic',
        header: 'Топик MQTT',
        sortable: true,
        searchValue: (r) => r.mqttTopic || '',
        sortValue: (r) => r.mqttTopic || '',
        render: (r) => (
          <code className="text-xs text-brand-700 dark:text-brand-300">{r.mqttTopic || '—'}</code>
        ),
      },
      {
        key: 'postSerial',
        header: 'Пост',
        className: 'table-cell-nowrap',
        sortable: true,
        searchValue: (r) => r.postSerial || '',
        sortValue: (r) => r.postSerial || '',
        render: (r) => <span className="font-mono text-sm">{r.postSerial || '—'}</span>,
      },
      {
        key: 'payload',
        header: 'Данные (как пришли)',
        searchValue: (r) => payloadPreview(r.payload, 500),
        render: (r) => (
          <pre
            className="max-w-[min(100%,20rem)] overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-panel-canvas px-2 py-1 font-mono text-[11px] text-panel-muted dark:bg-panel-canvas-dark dark:text-panel-muted-dark sm:max-w-md"
            title={JSON.stringify(r.payload, null, 2)}
          >
            {payloadPreview(r.payload)}
          </pre>
        ),
      },
    ],
    []
  );

  const bulkActions = useMemo((): DataTableBulkAction<MqttTelemetryRow>[] => [
    createExportBulkAction('mqtt-messages.csv', [
      { header: 'Получено', value: (r) => r.receivedAt || '' },
      { header: 'Тип', value: (r) => r.messageType },
      { header: 'Топик', value: (r) => r.mqttTopic || '' },
      { header: 'Пост', value: (r) => r.postSerial || '' },
      { header: 'Данные', value: (r) => JSON.stringify(r.payload) },
    ]),
  ], []);

  if (loading && !rows) return <Loading />;

  const countSummary = typeCounts
    .slice(0, 6)
    .map(([label, n]) => `${label}: ${n}`)
    .join(' · ');

  return (
    <div>
      <PageHeader
        title="MQTT"
        subtitle={`Все входящие сообщения брокера · показано ${rows?.length ?? 0}${
          totalRows != null ? ` из ${totalRows}` : ''
        }${countSummary ? ` · ${countSummary}` : ''} · обновлено ${
          lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString('ru') : '—'
        }`}
      />
      <p className="mb-4 text-sm text-panel-muted dark:text-panel-muted-dark">
        Журнал фиксирует <strong>каждое</strong> MQTT-сообщение как есть:{' '}
        <code className="text-xs">state/process</code> (состояние),{' '}
        <code className="text-xs">state/totals</code> (финансы),{' '}
        <code className="text-xs">state/usages</code> (использование),{' '}
        <code className="text-xs">state/credit</code>, <code className="text-xs">state/card</code>,{' '}
        <code className="text-xs">set/*</code> (настройки, команды, цены),{' '}
        <code className="text-xs">dlq</code> (ошибки обработки) и legacy{' '}
        <code className="text-xs">wash/telemetry/*</code>.
      </p>
      {hasMore && (
        <div className="mb-4">
          <button type="button" className="btn-secondary btn-sm" onClick={() => setPages((p) => p + 1)}>
            Загрузить ещё ({MQTT_PAGE_SIZE} записей)
          </button>
        </div>
      )}
      <DataTable
        tableId="mqtt"
        columns={columns}
        data={rows || []}
        rowKey={(r) => r.id}
        filters={filters}
        searchPlaceholder="Поиск по топику, посту, типу, данным…"
        pageSize={200}
        bulkActions={bulkActions}
      />
    </div>
  );
}
