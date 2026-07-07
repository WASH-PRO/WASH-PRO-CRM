import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { api, apiList } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Loading } from '../components/UI';
import { DataTable, type DataTableBulkAction, type DataTableColumn, type DataTableFilter } from '../components/DataTable';
import { LIVE_INTERVAL_SLOW_MS } from '../constants/live';
import { usePolling } from '../hooks/usePolling';
import type { ArchiveLog, CrmSetting, ArchiveGroupSettings, ArchiveSettings } from '../types';
import { createExportBulkAction } from '../utils/export';
import { formatDateTime } from '../utils/format';
import { executeArchiveGroup, type ArchiveGroupKey } from '../utils/archive';
import { archiveFilenameLabel, resolveArchiveFilename } from '../utils/archiveLog';
import { deleteArchiveFile, downloadArchiveFile, downloadJson } from '../utils/download';

const RETENTION_OPTIONS = [30, 90, 180, 365];

const ARCHIVE_GROUPS: { key: keyof Pick<ArchiveSettings, 'cards' | 'postStates' | 'usageStats' | 'financeStats'>; label: string }[] = [
  { key: 'cards', label: 'Архив карт' },
  { key: 'postStates', label: 'Архив состояний постов' },
  { key: 'usageStats', label: 'Архив статистики использования' },
  { key: 'financeStats', label: 'Архив финансовой статистики' },
];

const defaultGroup = (): ArchiveGroupSettings => ({
  enabled: true,
  autoRun: false,
  saveArchive: true,
  deleteAfter: false,
  retentionDays: 90,
  policy: 'standard',
});

function normalizeArchiveSettings(raw: Record<string, unknown>): ArchiveSettings {
  const base: ArchiveSettings = {
    retentionDays: (raw.retentionDays as number) ?? 90,
    autoArchive: (raw.autoArchive as boolean) ?? true,
    autoDelete: (raw.autoDelete as boolean) ?? false,
  };
  for (const g of ARCHIVE_GROUPS) {
    const existing = raw[g.key] as ArchiveGroupSettings | undefined;
    base[g.key] = existing ? { ...defaultGroup(), ...existing } : defaultGroup();
  }
  return base;
}

interface ArchivePageData {
  logs: ArchiveLog[];
  setting: ArchiveSettings;
  settingId: string | null;
}

export function ArchivePage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('update', 'delete');
  const canDelete = hasPermission('delete');
  const canRun = hasPermission('update');
  const [setting, setSetting] = useState<ArchiveSettings>(normalizeArchiveSettings({}));
  const [settingId, setSettingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [runningGroup, setRunningGroup] = useState<string | null>(null);
  const settingsInitialized = useRef(false);

  const fetchData = useCallback(async (): Promise<ArchivePageData> => {
    const [logs, settings] = await Promise.all([
      apiList<ArchiveLog>('/crm/archive-logs'),
      apiList<CrmSetting>('/crm/settings'),
    ]);
    const archive = settings.find((s) => s.key === 'archive');
    return {
      logs,
      setting: archive
        ? normalizeArchiveSettings(archive.value as Record<string, unknown>)
        : normalizeArchiveSettings({}),
      settingId: archive?.id ?? null,
    };
  }, []);

  const { data, loading, refresh } = usePolling(fetchData, [], { intervalMs: LIVE_INTERVAL_SLOW_MS });

  useEffect(() => {
    if (!data || settingsInitialized.current) return;
    setSetting(data.setting);
    setSettingId(data.settingId);
    settingsInitialized.current = true;
  }, [data]);

  const logs = data?.logs ?? [];

  const savePolicy = async (e: FormEvent) => {
    e.preventDefault();
    if (!settingId) return;
    await api(`/crm/settings/${settingId}`, {
      method: 'PUT',
      body: JSON.stringify({ key: 'archive', value: setting }),
    });
    setMessage('Настройки архивирования сохранены');
    settingsInitialized.current = false;
    refresh();
  };

  const runArchive = async (groupKey: ArchiveGroupKey) => {
    const group = setting[groupKey] as ArchiveGroupSettings;
    if (!group.enabled) {
      setError('Архивирование для этой группы отключено');
      setMessage('');
      return;
    }
    setRunningGroup(groupKey);
    setError('');
    setMessage('');
    try {
      const result = await executeArchiveGroup(groupKey, group);
      await api('/crm/archive-logs', {
        method: 'POST',
        body: JSON.stringify({
          action: 'archive',
          recordsAffected: result.affected,
          policyDays: group.retentionDays,
          createdAt: new Date().toISOString(),
          ...(result.filename ? { filename: result.filename } : {}),
          details: {
            manual: true,
            group: groupKey,
            deleteAfter: group.deleteAfter,
            saveArchive: group.saveArchive,
            ...(result.filename ? { filename: result.filename } : {}),
          },
        }),
      });
      const label = ARCHIVE_GROUPS.find((g) => g.key === groupKey)?.label ?? groupKey;
      setMessage(
        result.affected > 0
          ? `${label}: обработано ${result.affected} записей${group.deleteAfter ? ', исходные данные удалены' : ''}${result.filename ? `, архив ${result.filename}` : ''}`
          : `${label}: нет записей старше ${group.retentionDays} дней`
      );
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка архивирования');
      setMessage('');
    } finally {
      setRunningGroup(null);
    }
  };

  const updateGroup = (key: keyof ArchiveSettings, patch: Partial<ArchiveGroupSettings>) => {
    setSetting((prev) => ({
      ...prev,
      [key]: { ...(prev[key] as ArchiveGroupSettings), ...patch },
    }));
  };

  const downloadLog = async (log: ArchiveLog) => {
    const filename = resolveArchiveFilename(log);
    try {
      if (filename) {
        await downloadArchiveFile(filename);
        return;
      }
      downloadJson(`archive-log-${log.id}.json`, log);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось скачать архив');
    }
  };

  const deleteLogs = useCallback(
    async (selected: ArchiveLog[]) => {
      if (selected.length === 0) return;

      let deleted = 0;
      const fileErrors: string[] = [];
      const dbErrors: string[] = [];

      for (const log of selected) {
        const filename = resolveArchiveFilename(log);
        if (filename) {
          try {
            await deleteArchiveFile(filename);
          } catch {
            fileErrors.push(filename);
          }
        }

        if (!log.id) {
          dbErrors.push('запись без id');
          continue;
        }

        try {
          await api(`/crm/archive-logs/${log.id}`, { method: 'DELETE' });
          deleted += 1;
        } catch {
          dbErrors.push(log.id);
        }
      }

      await refresh();

      if (deleted === 0) {
        throw new Error('Не удалось удалить выбранные записи. Проверьте права доступа.');
      }
      if (dbErrors.length > 0 || fileErrors.length > 0) {
        const parts: string[] = [];
        if (dbErrors.length) parts.push(`записей в журнале: ${dbErrors.length}`);
        if (fileErrors.length) parts.push(`файлов архива: ${fileErrors.length}`);
        throw new Error(`Удалено ${deleted} из ${selected.length}. Ошибки (${parts.join(', ')})`);
      }
    },
    [refresh]
  );

  const deleteLog = async (log: ArchiveLog) => {
    if (!confirm('Удалить запись из журнала архивирования?')) return;
    try {
      await deleteLogs([log]);
      setMessage('Запись удалена');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить запись');
      setMessage('');
    }
  };

  const logFilters: DataTableFilter<ArchiveLog>[] = [
    {
      id: 'action',
      label: 'Действие',
      options: [
        { value: 'archive', label: 'archive' },
        { value: 'delete', label: 'delete' },
        { value: 'transfer', label: 'transfer' },
      ],
      match: (l, v) => l.action === v,
    },
  ];

  const logColumns: DataTableColumn<ArchiveLog>[] = [
    {
      key: 'action',
      header: 'Действие',
      sortable: true,
      searchValue: (l) => l.action,
      sortValue: (l) => l.action,
      render: (l) => l.action,
    },
    {
      key: 'group',
      header: 'Группа',
      render: (l) => (l.details?.group as string) || '—',
    },
    {
      key: 'records',
      header: 'Записей',
      sortable: true,
      sortValue: (l) => l.recordsAffected,
      render: (l) => l.recordsAffected,
    },
    {
      key: 'policy',
      header: 'Срок хранения',
      render: (l) => `${l.policyDays} дней`,
    },
    {
      key: 'date',
      header: 'Дата и время',
      sortable: true,
      sortValue: (l) => l.createdAt || '',
      render: (l) => formatDateTime(l.createdAt),
    },
    {
      key: 'file',
      header: 'Имя файла',
      sortable: true,
      sortValue: (l) => resolveArchiveFilename(l) || '',
      searchValue: (l) => archiveFilenameLabel(l),
      render: (l) => {
        const label = archiveFilenameLabel(l);
        const filename = resolveArchiveFilename(l);
        return filename ? (
          <span className="font-mono text-xs">{filename}</span>
        ) : (
          <span className="text-panel-muted dark:text-panel-muted-dark">{label}</span>
        );
      },
    },
    ...(canDelete
      ? [
          {
            key: 'actions',
            header: '',
            render: (l: ArchiveLog) => (
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  className="btn-secondary !px-2 !py-1"
                  onClick={() => downloadLog(l)}
                  title="Скачать"
                >
                  <Download size={14} />
                </button>
                <button
                  type="button"
                  className="btn-secondary !px-2 !py-1 text-red-600"
                  onClick={() => deleteLog(l)}
                  title="Удалить"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ),
          } as DataTableColumn<ArchiveLog>,
        ]
      : []),
  ];

  const logBulkActions = useMemo((): DataTableBulkAction<ArchiveLog>[] => {
    const actions: DataTableBulkAction<ArchiveLog>[] = [
      createExportBulkAction('archive-logs.csv', [
        { header: 'Действие', value: (l) => l.action },
        { header: 'Группа', value: (l) => (l.details?.group as string) || '' },
        { header: 'Записей', value: (l) => String(l.recordsAffected ?? '') },
        { header: 'Срок хранения', value: (l) => String(l.policyDays ?? '') },
        { header: 'Имя файла', value: (l) => archiveFilenameLabel(l) },
        { header: 'Дата и время', value: (l) => l.createdAt || '' },
      ]),
    ];
    if (canDelete) {
      actions.push({
        id: 'delete',
        label: 'Удалить',
        variant: 'danger',
        confirmMessage: (_rows, ids) =>
          `Удалить ${ids.length} записей из журнала (и связанные файлы архивов)?`,
        onAction: async (rows) => {
          try {
            await deleteLogs(rows);
            setMessage(`Удалено записей: ${rows.length}`);
            setError('');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось удалить записи');
            setMessage('');
          }
        },
      });
    }
    return actions;
  }, [canDelete, deleteLogs]);

  if (loading && !data) return <Loading />;

  return (
    <div>
      <PageHeader title="Архивирование" subtitle="Аналитика → Архивирование" />
      {message && <p className="mb-4 text-sm text-emerald-600">{message}</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={savePolicy} className="card mb-6 space-y-6">
        <h2 className="font-semibold">Настройки архивирования</h2>

        {ARCHIVE_GROUPS.map(({ key, label }) => {
          const group = setting[key] as ArchiveGroupSettings;
          return (
            <div
              key={key}
              className="space-y-3 border-t border-panel-border pt-5 first:border-t-0 first:pt-0 dark:border-panel-border-dark"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-panel-ink dark:text-panel-ink-dark">{label}</h3>
                {canRun && (
                  <button
                    type="button"
                    className="btn-secondary btn-sm text-xs"
                    disabled={runningGroup === key}
                    onClick={() => runArchive(key)}
                  >
                    {runningGroup === key ? 'Запуск…' : 'Запустить'}
                  </button>
                )}
              </div>
              <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                <label className="flex items-start gap-2 text-sm leading-snug">
                  <input
                    type="checkbox"
                    className="mt-0.5 shrink-0"
                    checked={group.enabled}
                    onChange={(e) => updateGroup(key, { enabled: e.target.checked })}
                    disabled={!canEdit}
                  />
                  Включение архивирования
                </label>
                <label className="flex items-start gap-2 text-sm leading-snug">
                  <input
                    type="checkbox"
                    className="mt-0.5 shrink-0"
                    checked={group.autoRun}
                    onChange={(e) => updateGroup(key, { autoRun: e.target.checked })}
                    disabled={!canEdit}
                  />
                  Автозапуск архивирования
                </label>
                <p className="text-xs text-panel-muted dark:text-panel-muted-dark md:col-span-2">
                  Автозапуск выполняет сервис <span className="font-mono">wash-backup</span> по расписанию (по умолчанию 03:00).
                </p>
                <label className="flex items-start gap-2 text-sm leading-snug">
                  <input
                    type="checkbox"
                    className="mt-0.5 shrink-0"
                    checked={group.saveArchive}
                    onChange={(e) => updateGroup(key, { saveArchive: e.target.checked })}
                    disabled={!canEdit}
                  />
                  Сохранение архива
                </label>
                <label className="flex items-start gap-2 text-sm leading-snug">
                  <input
                    type="checkbox"
                    className="mt-0.5 shrink-0"
                    checked={group.deleteAfter}
                    onChange={(e) => updateGroup(key, { deleteAfter: e.target.checked })}
                    disabled={!canEdit}
                  />
                  Удаление исходных данных после архивирования
                </label>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="label">Срок хранения данных</label>
                  <select
                    className="select"
                    value={group.retentionDays}
                    onChange={(e) => updateGroup(key, { retentionDays: Number(e.target.value) })}
                    disabled={!canEdit}
                  >
                    {RETENTION_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d} дней
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Политика хранения</label>
                  <select
                    className="select"
                    value={group.policy}
                    onChange={(e) => updateGroup(key, { policy: e.target.value })}
                    disabled={!canEdit}
                  >
                    <option value="standard">Стандартная</option>
                    <option value="compressed">Сжатие</option>
                    <option value="cold">Холодное хранение</option>
                  </select>
                </div>
              </div>
            </div>
          );
        })}

        {canEdit && (
          <div className="border-t border-panel-border pt-4 dark:border-panel-border-dark">
            <button type="submit" className="btn-primary">
              Сохранить настройки
            </button>
          </div>
        )}
      </form>

      <h2 className="mb-3 font-semibold">Журнал архивирования</h2>
      <DataTable tableId="archive-logs" columns={logColumns} data={logs} rowKey={(l) => l.id} filters={logFilters} searchPlaceholder="Поиск в журнале…" bulkActions={logBulkActions} />
    </div>
  );
}
