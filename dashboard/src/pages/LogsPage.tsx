import { useCallback, useMemo, useState } from 'react';
import { getSystemLogs } from '../api/client';
import { PageHeader, Loading } from '../components/UI';
import { DataTable, type DataTableBulkAction, type DataTableColumn, type DataTableFilter } from '../components/DataTable';
import { DEFAULT_LIVE_INTERVAL_MS } from '../constants/live';
import { usePolling } from '../hooks/usePolling';
import { deriveLogLevel, formatDateTime } from '../utils/format';
import { createExportBulkAction } from '../utils/export';
import type { LogEntry } from '../types';

export function LogsPage() {
  const [apiPage, setApiPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchLogs = useCallback(async () => {
    const params = new URLSearchParams({ page: String(apiPage), limit: '100' });
    return getSystemLogs(params.toString());
  }, [apiPage]);

  const { data: logs, loading } = usePolling(fetchLogs, [apiPage], { intervalMs: DEFAULT_LIVE_INTERVAL_MS });

  const dateFiltered = useMemo(() => {
    let list = logs || [];
    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      list = list.filter((l) => new Date(l.createdAt).getTime() >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86400000;
      list = list.filter((l) => new Date(l.createdAt).getTime() <= to);
    }
    return list;
  }, [logs, dateFrom, dateTo]);

  const filters: DataTableFilter<LogEntry>[] = useMemo(
    () => [
      {
        id: 'level',
        label: 'Уровень',
        options: [
          { value: 'Debug', label: 'Debug' },
          { value: 'Info', label: 'Info' },
          { value: 'Warning', label: 'Warning' },
          { value: 'Error', label: 'Error' },
          { value: 'Critical', label: 'Critical' },
        ],
        match: (l, v) => deriveLogLevel(l) === v,
      },
      {
        id: 'action',
        label: 'Категория',
        options: [
          { value: 'api_call', label: 'API запросы' },
          { value: 'error', label: 'Ошибки' },
          { value: 'webhook_dispatch', label: 'Сетевые' },
          { value: 'cron_run', label: 'Фоновые задачи' },
          { value: 'mcp_call', label: 'Системные' },
          { value: 'login', label: 'Авторизация' },
        ],
        match: (l, v) => l.action === v,
      },
    ],
    []
  );

  const columns: DataTableColumn<LogEntry>[] = useMemo(
    () => [
      {
        key: 'level',
        header: 'Уровень',
        sortValue: (l) => deriveLogLevel(l),
        searchValue: (l) => deriveLogLevel(l),
        render: (l) => deriveLogLevel(l),
      },
      {
        key: 'action',
        header: 'Категория',
        searchValue: (l) => `${l.action} ${l.source || ''}`,
        sortValue: (l) => l.action,
        render: (l) => <span className="font-mono text-xs">{l.action}</span>,
      },
      {
        key: 'message',
        header: 'Сообщение',
        searchValue: (l) => l.message,
        sortValue: (l) => l.message,
        render: (l) => <span className="text-sm">{l.message}</span>,
      },
      {
        key: 'statusCode',
        header: 'Код',
        sortValue: (l) => l.statusCode || 0,
        render: (l) => l.statusCode || '—',
      },
      {
        key: 'ip',
        header: 'IP',
        searchValue: (l) => l.ip || '',
        sortValue: (l) => l.ip || '',
        render: (l) => <span className="font-mono text-xs">{l.ip || '—'}</span>,
      },
      {
        key: 'createdAt',
        header: 'Дата и время',
        sortValue: (l) => l.createdAt,
        render: (l) => formatDateTime(l.createdAt),
      },
    ],
    []
  );

  const bulkActions = useMemo((): DataTableBulkAction<LogEntry>[] => [
    createExportBulkAction('system-logs.csv', [
      { header: 'Уровень', value: (l) => deriveLogLevel(l) },
      { header: 'Категория', value: (l) => l.action },
      { header: 'Сообщение', value: (l) => l.message },
      { header: 'Код', value: (l) => String(l.statusCode ?? '') },
      { header: 'IP', value: (l) => l.ip || '' },
      { header: 'Дата и время', value: (l) => l.createdAt },
    ]),
  ], []);

  if (loading && !logs) return <Loading />;

  return (
    <div>
      <PageHeader title="Логирование и диагностика" subtitle="Сортировка, фильтры и поиск по всем полям" />

      <DataTable
        tableId="logs"
        columns={columns}
        data={dateFiltered}
        rowKey={(l) => l.id}
        filters={filters}
        pageSize={200}
        searchPlaceholder="Поиск в логах…"
        toolbar={
          <div className="toolbar-cluster">
            <input
              type="date"
              className="input-inline"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="С"
            />
            <span className="text-sm text-panel-muted">—</span>
            <input
              type="date"
              className="input-inline"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="По"
            />
            <button
              type="button"
              className="btn-secondary btn-sm"
              disabled={apiPage <= 1}
              onClick={() => setApiPage((p) => p - 1)}
            >
              API −
            </button>
            <span className="flex h-9 items-center text-sm text-panel-muted">API стр. {apiPage}</span>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setApiPage((p) => p + 1)}>
              API +
            </button>
          </div>
        }
        bulkActions={bulkActions}
      />
    </div>
  );
}
