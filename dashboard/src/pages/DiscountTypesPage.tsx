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
  DISCOUNT_TYPE_STATUS_LABELS,
  discountTypeStatus,
  normalizeDiscountTypeCode,
} from '../utils/discountTypes';
import type { DiscountType, DiscountTypeStatus } from '../types';
import { useLocale } from '../i18n/LocaleContext';

const emptyForm = { name: '', status: 'active' as DiscountTypeStatus };

export function DiscountTypesPage() {
  const { t } = useLocale();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('update');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState('');

  const fetchTypes = useCallback(
    (signal: AbortSignal) => apiListDictionary<DiscountType>('/crm/discount-types', signal),
    []
  );
  const { data: types, loading, error, refresh } = usePolling(fetchTypes, [], { intervalMs: LIVE_INTERVAL_SLOW_MS });

  const sorted = useMemo(
    () =>
      [...(types || [])].sort((a, b) =>
        String(a.code ?? '').localeCompare(String(b.code ?? ''), 'ru', { numeric: true, sensitivity: 'base' })
      ),
    [types]
  );

  const filters: DataTableFilter<DiscountType>[] = useMemo(
    () => [
      {
        id: 'code',
        label: t('pages.discountTypes.code'),
        options: sorted.map((t) => ({ value: t.code, label: t.code })),
        match: (t, value) => t.code === value,
      },
      {
        id: 'status',
        label: t('common.status'),
        options: (['active', 'inactive'] as const).map((s) => ({
          value: s,
          label: DISCOUNT_TYPE_STATUS_LABELS[s],
        })),
        match: (t, value) => discountTypeStatus(t) === value,
      },
    ],
    [sorted, t]
  );

  const openEdit = (item: DiscountType) => {
    setForm({ name: item.name, status: discountTypeStatus(item) });
    setEditId(item.id);
    setEditCode(item.code);
    setModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editId || !editCode) return;
    await api(`/crm/discount-types/${editId}`, {
      method: 'PUT',
      body: JSON.stringify({
        code: normalizeDiscountTypeCode(editCode),
        name: form.name,
        status: form.status,
      }),
    });
    setModal(false);
    refresh();
  };

  const columns: DataTableColumn<DiscountType>[] = useMemo(
    () => [
      {
        key: 'code',
        header: t('pages.discountTypes.code'),
        sortable: true,
        sortValue: (t) => t.code,
        searchValue: (t) => `${t.code} ${t.name}`,
        render: (t) => <span className="font-mono font-medium">{t.code}</span>,
      },
      {
        key: 'name',
        header: t('pages.discountTypes.name'),
        sortable: true,
        sortValue: (t) => t.name,
        searchValue: (t) => t.name,
        render: (t) => t.name,
      },
      {
        key: 'status',
        header: t('common.status'),
        sortable: true,
        sortValue: (t) => discountTypeStatus(t),
        searchValue: (t) => DISCOUNT_TYPE_STATUS_LABELS[discountTypeStatus(t)],
        render: (t) => {
          const status = discountTypeStatus(t);
          return (
            <Badge variant={status === 'active' ? 'success' : 'default'}>
              {DISCOUNT_TYPE_STATUS_LABELS[status]}
            </Badge>
          );
        },
      },
      {
        key: 'createdAt',
        header: t('pages.discountTypes.createdAt'),
        sortable: true,
        sortValue: (t) => t.createdAt || '',
        searchValue: (t) => formatDateTime(t.createdAt),
        render: (t) => formatDateTime(t.createdAt),
      },
      ...(canEdit
        ? [
            {
              key: 'actions',
              header: '',
              render: (row: DiscountType) => (
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    className="btn-secondary !px-2 !py-1"
                    onClick={() => openEdit(row)}
                    title={t('common.edit')}
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              ),
            } as DataTableColumn<DiscountType>,
          ]
        : []),
    ],
    [canEdit, t]
  );

  const bulkActions = useMemo((): DataTableBulkAction<DiscountType>[] => [
    createExportBulkAction('discount-types.csv', [
      { header: t('pages.discountTypes.code'), value: (t) => t.code },
      { header: t('pages.discountTypes.name'), value: (t) => t.name },
      { header: t('common.status'), value: (t) => DISCOUNT_TYPE_STATUS_LABELS[discountTypeStatus(t)] },
      { header: t('pages.discountTypes.createdAt'), value: (t) => t.createdAt || '' },
    ]),
  ], [t]);

  if (loading && !types) return <Loading />;
  if (error && !types) {
    return (
      <div>
        <PageHeader title={t('nav.items.discountTypes')} />
        <ErrorMessage message={error} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('nav.items.discountTypes')}
        subtitle={t('pages.discountTypes.subtitle')}
      />
      <DataTable
        tableId="discount-types"
        columns={columns}
        data={sorted}
        rowKey={(t) => t.id}
        filters={filters}
        searchPlaceholder={t('pages.discountTypes.searchPlaceholder')}
        bulkActions={bulkActions}
        emptyMessage={t('pages.discountTypes.empty')}
      />

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editCode ? t('pages.discountTypes.modalWithCode', { code: editCode }) : t('pages.discountTypes.modal')}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">{t('pages.discountTypes.code')}</label>
            <input className="input font-mono" value={editCode} readOnly disabled />
          </div>
          <div>
            <label className="label">{t('pages.discountTypes.name')}</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder={t('pages.discountTypes.namePlaceholder')}
            />
          </div>
          <div>
            <label className="label">{t('common.status')}</label>
            <select
              className="input"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as DiscountTypeStatus })}
            >
              <option value="active">{t('discountTypes.status.active')}</option>
              <option value="inactive">{t('discountTypes.status.inactive')}</option>
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
