import { useCallback, useState } from 'react';
import { Download, HardDrive, Trash2 } from 'lucide-react';
import { api, apiList } from '../api/client';
import { PageHeader, Loading, Badge, getStatusLabelMap } from '../components/UI';
import { DataTable, type DataTableBulkAction, type DataTableColumn, type DataTableFilter } from '../components/DataTable';
import { LIVE_INTERVAL_SLOW_MS } from '../constants/live';
import { usePolling } from '../hooks/usePolling';
import { formatDateTime } from '../utils/format';
import type { BackupRecord } from '../types';
import { createExportBulkAction } from '../utils/export';
import { deleteBackupFile, downloadBackupFile } from '../utils/download';
import { useLocale } from '../i18n/LocaleContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';

export function BackupsPage() {
  const { t } = useLocale();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [creating, setCreating] = useState(false);
  const statusLabel = getStatusLabelMap();

  const fetchData = useCallback(async () => {
    const backups = await apiList<BackupRecord>('/crm/backups');
    return { backups };
  }, []);

  const { data, loading, refresh } = usePolling(fetchData, [], { intervalMs: LIVE_INTERVAL_SLOW_MS });

  const createManual = async () => {
    setCreating(true);
    try {
      await api('/crm/backups', {
        method: 'POST',
        body: JSON.stringify({
          filename: `manual-${Date.now()}.pending`,
          type: 'manual',
          status: 'in_progress',
          createdAt: new Date().toISOString(),
        }),
      });
      refresh();
    } finally {
      setCreating(false);
    }
  };

  const deleteBackup = async (id: string, filename: string) => {
    if (!(await confirm({ message: t('pages.backups.confirmDelete', { filename }), variant: 'danger' }))) return;
    try {
      if (filename && !filename.startsWith('[deleted]') && !filename.endsWith('.pending')) {
        await deleteBackupFile(filename);
      }
      await api(`/crm/backups/${id}`, { method: 'DELETE' });
    } catch {
      await api(`/crm/backups/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'failed', error: 'deleted_by_user', filename: `[deleted] ${filename}` }),
      });
    }
    refresh();
  };

  const downloadBackup = async (filename: string) => {
    if (filename.startsWith('[deleted]') || filename.endsWith('.pending')) return;
    try {
      await downloadBackupFile(filename);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('errors.requestFailed', { status: 500 }), 'error');
    }
  };

  const filters: DataTableFilter<BackupRecord>[] = [
    {
      id: 'status',
      label: t('common.status'),
      options: [
        { value: 'completed', label: statusLabel.completed },
        { value: 'failed', label: statusLabel.failed },
        { value: 'in_progress', label: statusLabel.in_progress },
      ],
      match: (b, v) => b.status === v,
    },
    {
      id: 'type',
      label: t('pages.backups.columns.type'),
      options: [
        { value: 'auto', label: t('pages.backups.type.auto') },
        { value: 'manual', label: t('pages.backups.type.manual') },
      ],
      match: (b, v) => b.type === v,
    },
  ];

  const columns: DataTableColumn<BackupRecord>[] = [
    {
      key: 'filename',
      header: t('pages.backups.columns.file'),
      sortValue: (b) => b.filename,
      searchValue: (b) => b.filename,
      render: (b) => <span className="font-mono text-xs">{b.filename}</span>,
    },
    {
      key: 'type',
      header: t('pages.backups.columns.type'),
      sortable: true,
      sortValue: (b) => b.type,
      render: (b) => (b.type === 'auto' ? t('pages.backups.type.auto') : t('pages.backups.type.manual')),
    },
    {
      key: 'size',
      header: t('pages.backups.columns.size'),
      sortable: true,
      sortValue: (b) => b.size || 0,
      render: (b) => (b.size ? `${(b.size / 1024 / 1024).toFixed(2)} MB` : t('common.notAvailable')),
    },
    {
      key: 'status',
      header: t('common.status'),
      sortable: true,
      sortValue: (b) => b.status,
      render: (b) => (
        <Badge variant={b.status === 'completed' ? 'success' : b.status === 'failed' ? 'error' : 'warning'}>
          {statusLabel[b.status] || b.status}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: t('notificationsTable.dateTime'),
      sortable: true,
      sortValue: (b) => b.createdAt || '',
      render: (b) => formatDateTime(b.createdAt),
    },
    {
      key: 'actions',
      header: '',
      render: (b) => (
        <div className="flex justify-end gap-1">
          {b.status === 'completed' && !b.filename.startsWith('[deleted]') && !b.filename.endsWith('.pending') && (
            <button
              type="button"
              className="btn-secondary !py-1 !px-2"
              onClick={() => downloadBackup(b.filename)}
              title={t('pages.backups.actions.download')}
            >
              <Download size={14} />
            </button>
          )}
          <button
            type="button"
            className="btn-secondary text-red-600 !py-1 !px-2"
            onClick={() => deleteBackup(b.id, b.filename)}
            title={t('common.delete')}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  const bulkActions: DataTableBulkAction<BackupRecord>[] = [
    createExportBulkAction('backups.csv', [
      { header: t('pages.backups.columns.file'), value: (b) => b.filename },
      { header: t('pages.backups.columns.type'), value: (b) => b.type || '' },
      { header: t('pages.backups.columns.size'), value: (b) => String(b.size ?? '') },
      { header: t('common.status'), value: (b) => b.status || '' },
      { header: t('notificationsTable.dateTime'), value: (b) => b.createdAt || '' },
    ]),
    {
      id: 'delete',
      label: t('common.delete'),
      variant: 'danger',
      confirmMessage: (_rows, ids) => `${t('common.delete')} ${ids.length}?`,
      onAction: async (rows) => {
        for (const backup of rows) {
          try {
            if (!backup.filename.startsWith('[deleted]') && !backup.filename.endsWith('.pending')) {
              await deleteBackupFile(backup.filename);
            }
            await api(`/crm/backups/${backup.id}`, { method: 'DELETE' });
          } catch {
            await api(`/crm/backups/${backup.id}`, {
              method: 'PATCH',
              body: JSON.stringify({
                status: 'failed',
                error: 'deleted_by_user',
                filename: `[deleted] ${backup.filename}`,
              }),
            });
          }
        }
        refresh();
      },
    },
  ];

  if (loading && !data) return <Loading />;

  return (
    <div>
      <PageHeader
        title={t('pages.backups.title')}
        subtitle={t('pages.backups.subtitle')}
        actions={
          <button type="button" className="btn-primary" disabled={creating} onClick={createManual}>
            <HardDrive size={16} /> {creating ? t('common.loading') : t('pages.backups.actions.createManual')}
          </button>
        }
      />

      <DataTable tableId="backups" columns={columns} data={data?.backups || []} rowKey={(b) => b.id} filters={filters} searchPlaceholder={t('dataTable.searchPlaceholder')} bulkActions={bulkActions} />
    </div>
  );
}
