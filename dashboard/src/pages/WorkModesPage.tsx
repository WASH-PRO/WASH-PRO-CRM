import { FormEvent, useCallback, useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import { api, apiListDictionary } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { LIVE_INTERVAL_SLOW_MS } from '../constants/live';
import { usePolling } from '../hooks/usePolling';
import { PageHeader, Loading, Modal, Badge, ErrorMessage } from '../components/UI';
import { DataTable, type DataTableBulkAction, type DataTableColumn, type DataTableFilter } from '../components/DataTable';
import { createExportBulkAction } from '../utils/export';
import { formatDateTime } from '../utils/format';
import {
  WORK_MODE_STATUS_LABELS,
  WORK_MODE_TYPE_LABELS,
  normalizeWorkModeCode,
  workModeStatus,
  workModeType,
} from '../utils/workModes';
import type { WorkMode, WorkModeStatus, WorkModeType } from '../types';
import { useLocale } from '../i18n/LocaleContext';

const emptyForm = { name: '', status: 'active' as WorkModeStatus };

export function WorkModesPage() {
  const { t } = useLocale();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('update');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editModeType, setEditModeType] = useState<WorkMode['modeType']>('system');

  const fetchModes = useCallback(
    (signal: AbortSignal) => apiListDictionary<WorkMode>('/crm/work-modes', signal),
    []
  );
  const { data: modes, loading, error, refresh } = usePolling(fetchModes, [], { intervalMs: LIVE_INTERVAL_SLOW_MS });

  const sorted = useMemo(
    () =>
      [...(modes || [])].sort((a, b) =>
        String(a.code ?? '').localeCompare(String(b.code ?? ''), 'ru', { numeric: true, sensitivity: 'base' })
      ),
    [modes]
  );

  const filters: DataTableFilter<WorkMode>[] = useMemo(
    () => [
      {
        id: 'modeType',
        label: t('pages.workModes.type'),
        options: (['system', 'user'] as const).map((t) => ({
          value: t,
          label: WORK_MODE_TYPE_LABELS[t],
        })),
        match: (m, value) => workModeType(m) === value,
      },
      {
        id: 'code',
        label: t('pages.workModes.code'),
        options: sorted.map((m) => ({ value: m.code, label: m.code })),
        match: (m, value) => m.code === value,
      },
      {
        id: 'status',
        label: t('common.status'),
        options: (['active', 'inactive'] as const).map((s) => ({
          value: s,
          label: WORK_MODE_STATUS_LABELS[s],
        })),
        match: (m, value) => workModeStatus(m) === value,
      },
    ],
    [sorted, t]
  );

  const openEdit = (item: WorkMode) => {
    setForm({ name: item.name, status: workModeStatus(item) });
    setEditId(item.id);
    setEditCode(item.code);
    setEditModeType(workModeType(item));
    setModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editId || !editCode) return;
    await api(`/crm/work-modes/${editId}`, {
      method: 'PUT',
      body: JSON.stringify({
        code: normalizeWorkModeCode(editCode),
        name: form.name,
        modeType: editModeType,
        status: form.status,
      }),
    });
    setModal(false);
    refresh();
  };

  const columns: DataTableColumn<WorkMode>[] = useMemo(
    () => [
      {
        key: 'code',
        header: t('pages.workModes.code'),
        sortable: true,
        sortValue: (m) => m.code,
        searchValue: (m) => `${m.code} ${m.name}`,
        render: (m) => <span className="font-mono font-medium">{m.code}</span>,
      },
      {
        key: 'name',
        header: t('pages.workModes.name'),
        sortable: true,
        sortValue: (m) => m.name,
        searchValue: (m) => m.name,
        render: (m) => m.name,
      },
      {
        key: 'modeType',
        header: t('pages.workModes.type'),
        sortable: true,
        sortValue: (m) => workModeType(m),
        searchValue: (m) => WORK_MODE_TYPE_LABELS[workModeType(m)],
        render: (m) => {
          const type = workModeType(m);
          return (
            <Badge variant={type === 'system' ? 'default' : 'warning'}>
              {WORK_MODE_TYPE_LABELS[type]}
            </Badge>
          );
        },
      },
      {
        key: 'status',
        header: t('common.status'),
        sortable: true,
        sortValue: (m) => workModeStatus(m),
        searchValue: (m) => WORK_MODE_STATUS_LABELS[workModeStatus(m)],
        render: (m) => {
          const status = workModeStatus(m);
          return (
            <Badge variant={status === 'active' ? 'success' : 'default'}>
              {WORK_MODE_STATUS_LABELS[status]}
            </Badge>
          );
        },
      },
      {
        key: 'createdAt',
        header: t('pages.workModes.createdAt'),
        sortable: true,
        sortValue: (m) => m.createdAt || '',
        searchValue: (m) => formatDateTime(m.createdAt),
        render: (m) => formatDateTime(m.createdAt),
      },
      ...(canEdit
        ? [
            {
              key: 'actions',
              header: '',
              render: (m: WorkMode) => (
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    className="btn-secondary !px-2 !py-1"
                    onClick={() => openEdit(m)}
                    title={t('common.edit')}
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              ),
            } as DataTableColumn<WorkMode>,
          ]
        : []),
    ],
    [canEdit, t]
  );

  const bulkActions = useMemo((): DataTableBulkAction<WorkMode>[] => [
    createExportBulkAction('work-modes.csv', [
      { header: t('pages.workModes.code'), value: (m) => m.code },
      { header: t('pages.workModes.name'), value: (m) => m.name },
      { header: t('pages.workModes.type'), value: (m) => WORK_MODE_TYPE_LABELS[workModeType(m)] },
      { header: t('common.status'), value: (m) => WORK_MODE_STATUS_LABELS[workModeStatus(m)] },
      { header: t('pages.workModes.createdAt'), value: (m) => m.createdAt || '' },
    ]),
  ], [t]);

  if (loading && !modes) return <Loading />;
  if (error && !modes) {
    return (
      <div>
        <PageHeader title={t('nav.items.workModes')} />
        <ErrorMessage message={error} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('nav.items.workModes')}
        subtitle={t('pages.workModes.subtitle')}
      />
      <DataTable
        tableId="work-modes"
        columns={columns}
        data={sorted}
        rowKey={(m) => m.id}
        filters={filters}
        searchPlaceholder={t('pages.workModes.searchPlaceholder')}
        bulkActions={bulkActions}
        emptyMessage={t('pages.workModes.empty')}
      />

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editCode ? t('pages.workModes.modalWithCode', { code: editCode }) : t('pages.workModes.modal')}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">{t('pages.workModes.code')}</label>
            <input className="input font-mono" value={editCode} readOnly disabled />
          </div>
          <div>
            <label className="label">{t('pages.workModes.type')}</label>
            <select
              className="input"
              value={editModeType ?? 'system'}
              onChange={(e) => setEditModeType(e.target.value as WorkModeType)}
            >
              {(['system', 'user'] as const).map((type) => (
                <option key={type} value={type}>
                  {WORK_MODE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{t('pages.workModes.name')}</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder={t('pages.workModes.namePlaceholder')}
            />
          </div>
          <div>
            <label className="label">{t('common.status')}</label>
            <select
              className="input"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as WorkModeStatus })}
            >
              <option value="active">{t('workModes.status.active')}</option>
              <option value="inactive">{t('workModes.status.inactive')}</option>
            </select>
          </div>
          <button type="submit" className="btn-primary w-full">
            {t('common.save')}
          </button>
        </form>
      </Modal>
    </div>
  );
}
