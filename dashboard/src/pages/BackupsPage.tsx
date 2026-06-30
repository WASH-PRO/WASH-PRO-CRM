import { useCallback, useState } from 'react';
import { Download, HardDrive, Trash2 } from 'lucide-react';
import { api, apiList } from '../api/client';
import { PageHeader, Loading, Badge, statusLabel } from '../components/UI';
import { DataTable, type DataTableBulkAction, type DataTableColumn, type DataTableFilter } from '../components/DataTable';
import { LIVE_INTERVAL_SLOW_MS } from '../constants/live';
import { usePolling } from '../hooks/usePolling';
import { formatDateTime } from '../utils/format';
import type { BackupRecord } from '../types';
import { createExportBulkAction } from '../utils/export';
import { deleteBackupFile, downloadBackupFile } from '../utils/download';

export function BackupsPage() {
  const [creating, setCreating] = useState(false);

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
    if (!confirm(`Удалить резервную копию «${filename}»?`)) return;
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
      alert(err instanceof Error ? err.message : 'Не удалось скачать файл');
    }
  };

  const filters: DataTableFilter<BackupRecord>[] = [
    {
      id: 'status',
      label: 'Статус',
      options: [
        { value: 'completed', label: statusLabel.completed },
        { value: 'failed', label: statusLabel.failed },
        { value: 'in_progress', label: statusLabel.in_progress },
      ],
      match: (b, v) => b.status === v,
    },
    {
      id: 'type',
      label: 'Тип',
      options: [
        { value: 'auto', label: 'Авто' },
        { value: 'manual', label: 'Ручная' },
      ],
      match: (b, v) => b.type === v,
    },
  ];

  const columns: DataTableColumn<BackupRecord>[] = [
    {
      key: 'filename',
      header: 'Файл',
      sortValue: (b) => b.filename,
      searchValue: (b) => b.filename,
      render: (b) => <span className="font-mono text-xs">{b.filename}</span>,
    },
    {
      key: 'type',
      header: 'Тип',
      sortable: true,
      sortValue: (b) => b.type,
      render: (b) => (b.type === 'auto' ? 'Авто' : 'Ручная'),
    },
    {
      key: 'size',
      header: 'Размер',
      sortable: true,
      sortValue: (b) => b.size || 0,
      render: (b) => (b.size ? `${(b.size / 1024 / 1024).toFixed(2)} МБ` : '—'),
    },
    {
      key: 'status',
      header: 'Статус',
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
      header: 'Дата и время',
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
              title="Скачать"
            >
              <Download size={14} />
            </button>
          )}
          <button
            type="button"
            className="btn-secondary text-red-600 !py-1 !px-2"
            onClick={() => deleteBackup(b.id, b.filename)}
            title="Удалить резервную копию"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  const bulkActions: DataTableBulkAction<BackupRecord>[] = [
    createExportBulkAction('backups.csv', [
      { header: 'Файл', value: (b) => b.filename },
      { header: 'Тип', value: (b) => b.type || '' },
      { header: 'Размер', value: (b) => String(b.size ?? '') },
      { header: 'Статус', value: (b) => b.status || '' },
      { header: 'Дата и время', value: (b) => b.createdAt || '' },
    ]),
    {
      id: 'delete',
      label: 'Удалить',
      variant: 'danger',
      confirmMessage: (_rows, ids) => `Удалить ${ids.length} резервных копий?`,
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
        title="Резервные копии"
        subtitle="Автоматическое и ручное резервное копирование MongoDB. Расписание и retention — в разделе «Настройки»."
        actions={
          <button type="button" className="btn-primary" disabled={creating} onClick={createManual}>
            <HardDrive size={16} /> {creating ? 'Запуск…' : 'Создать копию'}
          </button>
        }
      />

      <DataTable columns={columns} data={data?.backups || []} rowKey={(b) => b.id} filters={filters} searchPlaceholder="Поиск копий…" bulkActions={bulkActions} />
    </div>
  );
}
