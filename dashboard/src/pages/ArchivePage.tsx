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
import { executeArchiveGroup, executeTelemetryArchive, type ArchiveGroupKey } from '../utils/archive';
import { archiveFilenameLabel, formatArchiveRecordsCell, resolveArchiveFilename, resolveArchiveLogStatus } from '../utils/archiveLog';
import {
  ARCHIVE_GROUPS,
  DEFAULT_ARCHIVE_CRON,
  normalizeArchiveSettings,
  resolveArchiveGroupLabel,
} from '../utils/archiveSettings';
import { deleteArchiveFile, downloadArchiveFile, downloadJson } from '../utils/download';
import { useLocale } from '../i18n/LocaleContext';

const RETENTION_OPTIONS = [30, 90, 180, 365];

interface ArchivePageData {
  logs: ArchiveLog[];
  setting: ArchiveSettings;
  settingId: string | null;
}

function RetentionSelect({
  value,
  disabled,
  onChange,
  t,
}: {
  value: number;
  disabled: boolean;
  onChange: (days: number) => void;
  t: ReturnType<typeof useLocale>['t'];
}) {
  return (
    <select className="select" value={value} onChange={(e) => onChange(Number(e.target.value))} disabled={disabled}>
      {RETENTION_OPTIONS.map((d) => (
        <option key={d} value={d}>
          {t('pages.archive.daysLabel', { days: d })}
        </option>
      ))}
    </select>
  );
}

function CronField({
  value,
  disabled,
  onChange,
  t,
}: {
  value: string;
  disabled: boolean;
  onChange: (cron: string) => void;
  t: (key: string) => string;
}) {
  return (
    <div>
      <label className="label">{t('pages.archive.settings.cron')}</label>
      <input
        className="input font-mono"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={DEFAULT_ARCHIVE_CRON}
      />
      <p className="mt-1 text-xs text-panel-muted dark:text-panel-muted-dark">
        {t('pages.archive.settings.cronHint')}
      </p>
    </div>
  );
}

export function ArchivePage() {
  const { t } = useLocale();
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
    setMessage(t('pages.archive.messages.settingsSaved'));
    settingsInitialized.current = false;
    refresh();
  };

  const writeArchiveLog = async (
    result: { affected: number; scanned: number; filename?: string },
    meta: {
      groupKey: string;
      policyDays: number;
      manual?: boolean;
      deleteAfter?: boolean;
      saveArchive?: boolean;
      entity?: string;
    }
  ) => {
    await api('/crm/archive-logs', {
      method: 'POST',
      body: JSON.stringify({
        action: 'archive',
        recordsAffected: result.affected,
        policyDays: meta.policyDays,
        createdAt: new Date().toISOString(),
        ...(result.filename ? { filename: result.filename } : {}),
        details: {
          manual: meta.manual ?? true,
          group: meta.groupKey,
          groupKey: meta.groupKey,
          scanned: result.scanned,
          result: result.affected > 0 ? 'processed' : 'empty',
          deleteAfter: meta.deleteAfter,
          saveArchive: meta.saveArchive,
          ...(meta.entity ? { entity: meta.entity } : {}),
          ...(result.filename ? { filename: result.filename } : {}),
        },
      }),
    });
  };

  const showArchiveResult = (
    label: string,
    result: { affected: number; scanned: number; filename?: string },
    policyDays: number,
    extras?: { deleteAfter?: boolean }
  ) => {
    if (result.affected > 0) {
      setMessage(
        t('pages.archive.messages.groupProcessed', {
          label,
          affected: result.affected,
          deleted: extras?.deleteAfter ? t('pages.archive.messages.sourceDeleted') : '',
          filename: result.filename ? t('pages.archive.messages.archiveFile', { filename: result.filename }) : '',
        })
      );
      return;
    }
    if (result.scanned > 0) {
      setMessage(t('pages.archive.messages.noExpiredRecords', { label, scanned: result.scanned, days: policyDays }));
      return;
    }
    setMessage(t('pages.archive.messages.noRecordsOlderThan', { label, days: policyDays }));
  };

  const runTelemetryArchive = async () => {
    const retentionDays = setting.retentionDays ?? 90;
    setRunningGroup('telemetry');
    setError('');
    setMessage('');
    try {
      const result = await executeTelemetryArchive(retentionDays);
      await writeArchiveLog(result, {
        groupKey: 'telemetry',
        entity: 'telemetry',
        policyDays: retentionDays,
        manual: true,
      });
      showArchiveResult(t('pages.archive.groups.telemetry'), result, retentionDays);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pages.archive.errors.archiveFailed'));
      setMessage('');
    } finally {
      setRunningGroup(null);
    }
  };

  const runArchive = async (groupKey: ArchiveGroupKey) => {
    const group = setting[groupKey] as ArchiveGroupSettings;
    if (!group.enabled) {
      setError(t('pages.archive.errors.groupDisabled'));
      setMessage('');
      return;
    }
    setRunningGroup(groupKey);
    setError('');
    setMessage('');
    try {
      const result = await executeArchiveGroup(groupKey, group);
      await writeArchiveLog(result, {
        groupKey,
        policyDays: group.retentionDays,
        manual: true,
        deleteAfter: group.deleteAfter,
        saveArchive: group.saveArchive,
      });
      const label = t(`pages.archive.groups.${groupKey}`);
      showArchiveResult(label, result, group.retentionDays, { deleteAfter: group.deleteAfter });
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pages.archive.errors.archiveFailed'));
      setMessage('');
    } finally {
      setRunningGroup(null);
    }
  };

  const updateGroup = (key: ArchiveGroupKey, patch: Partial<ArchiveGroupSettings>) => {
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
      setError(err instanceof Error ? err.message : t('pages.archive.errors.downloadFailed'));
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
          dbErrors.push(t('pages.archive.errors.entryWithoutId'));
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
        throw new Error(t('pages.archive.errors.deleteSelectedFailed'));
      }
      if (dbErrors.length > 0 || fileErrors.length > 0) {
        const parts: string[] = [];
        if (dbErrors.length) parts.push(t('pages.archive.errors.logEntriesCount', { count: dbErrors.length }));
        if (fileErrors.length) parts.push(t('pages.archive.errors.archiveFilesCount', { count: fileErrors.length }));
        throw new Error(t('pages.archive.errors.deletedWithErrors', { deleted, total: selected.length, errors: parts.join(', ') }));
      }
    },
    [refresh, t]
  );

  const deleteLog = async (log: ArchiveLog) => {
    if (!confirm(t('pages.archive.confirmDeleteLog'))) return;
    try {
      await deleteLogs([log]);
      setMessage(t('pages.archive.messages.entryDeleted'));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pages.archive.errors.deleteEntryFailed'));
      setMessage('');
    }
  };

  const logFilters: DataTableFilter<ArchiveLog>[] = [
    {
      id: 'action',
      label: t('pages.archive.columns.action'),
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
      header: t('pages.archive.columns.action'),
      sortable: true,
      searchValue: (l) => l.action,
      sortValue: (l) => l.action,
      render: (l) => l.action,
    },
    {
      key: 'group',
      header: t('pages.archive.columns.group'),
      render: (l) => resolveArchiveGroupLabel(l.details, t),
    },
    {
      key: 'status',
      header: t('pages.archive.columns.status'),
      sortable: true,
      sortValue: (l) => resolveArchiveLogStatus(l, t),
      render: (l) => {
        const status = resolveArchiveLogStatus(l, t);
        const processed = (l.recordsAffected ?? 0) > 0;
        return (
          <span className={processed ? 'text-emerald-600' : 'text-panel-muted dark:text-panel-muted-dark'}>
            {status}
          </span>
        );
      },
    },
    {
      key: 'records',
      header: t('pages.archive.columns.records'),
      sortable: true,
      sortValue: (l) => l.recordsAffected,
      render: (l) => formatArchiveRecordsCell(l, t),
    },
    {
      key: 'policy',
      header: t('pages.archive.columns.retention'),
      render: (l) => t('pages.archive.daysLabel', { days: l.policyDays }),
    },
    {
      key: 'date',
      header: t('notificationsTable.dateTime'),
      sortable: true,
      sortValue: (l) => l.createdAt || '',
      render: (l) => formatDateTime(l.createdAt),
    },
    {
      key: 'file',
      header: t('pages.archive.columns.filename'),
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
                  title={t('pages.archive.actions.download')}
                >
                  <Download size={14} />
                </button>
                <button
                  type="button"
                  className="btn-secondary !px-2 !py-1 text-red-600"
                  onClick={() => deleteLog(l)}
                  title={t('common.delete')}
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
        { header: t('pages.archive.columns.action'), value: (l) => l.action },
        { header: t('pages.archive.columns.group'), value: (l) => resolveArchiveGroupLabel(l.details, t) },
        { header: t('pages.archive.columns.records'), value: (l) => String(l.recordsAffected ?? '') },
        { header: t('pages.archive.columns.retention'), value: (l) => String(l.policyDays ?? '') },
        { header: t('pages.archive.columns.filename'), value: (l) => archiveFilenameLabel(l) },
        { header: t('notificationsTable.dateTime'), value: (l) => l.createdAt || '' },
      ]),
    ];
    if (canDelete) {
      actions.push({
        id: 'delete',
        label: t('common.delete'),
        variant: 'danger',
        confirmMessage: (_rows, ids) =>
          t('pages.archive.confirmDeleteMany', { count: ids.length }),
        onAction: async (rows) => {
          try {
            await deleteLogs(rows);
            setMessage(t('pages.archive.messages.deletedCount', { count: rows.length }));
            setError('');
          } catch (err) {
            setError(err instanceof Error ? err.message : t('pages.archive.errors.deleteEntriesFailed'));
            setMessage('');
          }
        },
      });
    }
    return actions;
  }, [canDelete, deleteLogs, t]);

  if (loading && !data) return <Loading />;

  return (
    <div>
      <PageHeader title={t('pages.archive.title')} subtitle={t('pages.archive.subtitle')} />
      {message && <p className="mb-4 text-sm text-emerald-600">{message}</p>}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={savePolicy} className="card mb-6 space-y-6">
        <h2 className="font-semibold">{t('pages.archive.settingsTitle')}</h2>

        <div className="space-y-3 border-t border-panel-border pt-5 first:border-t-0 first:pt-0 dark:border-panel-border-dark">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-panel-ink dark:text-panel-ink-dark">
              {t('pages.archive.groups.telemetry')}
            </h3>
            {canRun && (
              <button
                type="button"
                className="btn-secondary btn-sm text-xs"
                disabled={runningGroup === 'telemetry'}
                onClick={() => runTelemetryArchive()}
              >
                {runningGroup === 'telemetry' ? t('pages.archive.actions.starting') : t('pages.archive.actions.start')}
              </button>
            )}
          </div>
          <p className="text-xs text-panel-muted dark:text-panel-muted-dark">
            {t('pages.archive.settings.telemetryHint')}
          </p>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
            <label className="flex items-start gap-2 text-sm leading-snug">
              <input
                type="checkbox"
                className="mt-0.5 shrink-0"
                checked={setting.autoArchive !== false}
                onChange={(e) => setSetting((prev) => ({ ...prev, autoArchive: e.target.checked }))}
                disabled={!canEdit}
              />
              {t('pages.archive.settings.enableAutoRun')}
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="label">{t('pages.archive.settings.retentionDays')}</label>
              <RetentionSelect
                value={setting.retentionDays ?? 90}
                disabled={!canEdit}
                onChange={(days) => setSetting((prev) => ({ ...prev, retentionDays: days }))}
                t={t}
              />
            </div>
            <CronField
              value={setting.cron ?? DEFAULT_ARCHIVE_CRON}
              disabled={!canEdit}
              onChange={(cron) => setSetting((prev) => ({ ...prev, cron }))}
              t={t}
            />
          </div>
        </div>

        {ARCHIVE_GROUPS.map((key) => {
          const group = setting[key] as ArchiveGroupSettings;
          const label = t(`pages.archive.groups.${key}`);
          return (
            <div
              key={key}
              className="space-y-3 border-t border-panel-border pt-5 dark:border-panel-border-dark"
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
                    {runningGroup === key ? t('pages.archive.actions.starting') : t('pages.archive.actions.start')}
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
                  {t('pages.archive.settings.enableArchive')}
                </label>
                <label className="flex items-start gap-2 text-sm leading-snug">
                  <input
                    type="checkbox"
                    className="mt-0.5 shrink-0"
                    checked={group.autoRun}
                    onChange={(e) => updateGroup(key, { autoRun: e.target.checked })}
                    disabled={!canEdit}
                  />
                  {t('pages.archive.settings.enableAutoRun')}
                </label>
                <label className="flex items-start gap-2 text-sm leading-snug">
                  <input
                    type="checkbox"
                    className="mt-0.5 shrink-0"
                    checked={group.saveArchive}
                    onChange={(e) => updateGroup(key, { saveArchive: e.target.checked })}
                    disabled={!canEdit}
                  />
                  {t('pages.archive.settings.saveArchive')}
                </label>
                <label className="flex items-start gap-2 text-sm leading-snug">
                  <input
                    type="checkbox"
                    className="mt-0.5 shrink-0"
                    checked={group.deleteAfter}
                    onChange={(e) => updateGroup(key, { deleteAfter: e.target.checked })}
                    disabled={!canEdit}
                  />
                  {t('pages.archive.settings.deleteSource')}
                </label>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="label">{t('pages.archive.settings.retentionDays')}</label>
                  <RetentionSelect
                    value={group.retentionDays}
                    disabled={!canEdit}
                    onChange={(days) => updateGroup(key, { retentionDays: days })}
                    t={t}
                  />
                </div>
                <div>
                  <label className="label">{t('pages.archive.settings.policy')}</label>
                  <select
                    className="select"
                    value={group.policy}
                    onChange={(e) => updateGroup(key, { policy: e.target.value })}
                    disabled={!canEdit}
                  >
                    <option value="standard">{t('pages.archive.policy.standard')}</option>
                    <option value="compressed">{t('pages.archive.policy.compressed')}</option>
                    <option value="cold">{t('pages.archive.policy.cold')}</option>
                  </select>
                </div>
                <CronField
                  value={group.cron ?? DEFAULT_ARCHIVE_CRON}
                  disabled={!canEdit}
                  onChange={(cron) => updateGroup(key, { cron })}
                  t={t}
                />
              </div>
            </div>
          );
        })}

        {canEdit && (
          <div className="border-t border-panel-border pt-4 dark:border-panel-border-dark">
            <button type="submit" className="btn-primary">
              {t('pages.archive.actions.saveSettings')}
            </button>
          </div>
        )}
      </form>

      <h2 className="mb-3 font-semibold">{t('pages.archive.logTitle')}</h2>
      <DataTable tableId="archive-logs" columns={logColumns} data={logs} rowKey={(l) => l.id} filters={logFilters} searchPlaceholder={t('pages.archive.searchPlaceholder')} bulkActions={logBulkActions} />
    </div>
  );
}
