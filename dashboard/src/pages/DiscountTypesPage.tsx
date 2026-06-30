import { FormEvent, useCallback, useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import { api, apiList } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { LIVE_INTERVAL_SLOW_MS } from '../constants/live';
import { usePolling } from '../hooks/usePolling';
import { PageHeader, Loading, Modal, Badge } from '../components/UI';
import { DataTable, type DataTableBulkAction, type DataTableColumn, type DataTableFilter } from '../components/DataTable';
import { createExportBulkAction } from '../utils/export';
import { formatDateTime } from '../utils/format';
import { DISCOUNT_TYPE_STATUS_LABELS, discountTypeStatus } from '../utils/discountTypes';
import type { DiscountType, DiscountTypeStatus } from '../types';

const emptyForm = { name: '', status: 'active' as DiscountTypeStatus };

export function DiscountTypesPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('update');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNumber, setEditNumber] = useState<number | null>(null);

  const fetchTypes = useCallback(() => apiList<DiscountType>('/crm/discount-types'), []);
  const { data: types, loading, refresh } = usePolling(fetchTypes, [], { intervalMs: LIVE_INTERVAL_SLOW_MS });

  const sorted = useMemo(
    () => [...(types || [])].sort((a, b) => a.number - b.number),
    [types]
  );

  const filters: DataTableFilter<DiscountType>[] = useMemo(
    () => [
      {
        id: 'number',
        label: 'Номер',
        options: sorted.map((t) => ({ value: String(t.number), label: `№${t.number}` })),
        match: (t, value) => String(t.number) === value,
      },
      {
        id: 'status',
        label: 'Статус',
        options: (['active', 'inactive'] as const).map((s) => ({
          value: s,
          label: DISCOUNT_TYPE_STATUS_LABELS[s],
        })),
        match: (t, value) => discountTypeStatus(t) === value,
      },
    ],
    [sorted]
  );

  const openEdit = (item: DiscountType) => {
    setForm({ name: item.name, status: discountTypeStatus(item) });
    setEditId(item.id);
    setEditNumber(item.number);
    setModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editId || editNumber == null) return;
    await api(`/crm/discount-types/${editId}`, {
      method: 'PUT',
      body: JSON.stringify({ number: editNumber, name: form.name, status: form.status }),
    });
    setModal(false);
    refresh();
  };

  const columns: DataTableColumn<DiscountType>[] = useMemo(
    () => [
      {
        key: 'number',
        header: 'Номер',
        sortable: true,
        sortValue: (t) => t.number,
        searchValue: (t) => String(t.number),
        render: (t) => <span className="font-mono font-medium">{t.number}</span>,
      },
      {
        key: 'name',
        header: 'Название',
        sortable: true,
        sortValue: (t) => t.name,
        searchValue: (t) => t.name,
        render: (t) => t.name,
      },
      {
        key: 'status',
        header: 'Статус',
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
        header: 'Дата создания',
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
              render: (t: DiscountType) => (
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    className="btn-secondary !px-2 !py-1"
                    onClick={() => openEdit(t)}
                    title="Изменить"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              ),
            } as DataTableColumn<DiscountType>,
          ]
        : []),
    ],
    [canEdit]
  );

  const bulkActions = useMemo((): DataTableBulkAction<DiscountType>[] => [
    createExportBulkAction('discount-types.csv', [
      { header: 'Номер', value: (t) => String(t.number) },
      { header: 'Название', value: (t) => t.name },
      { header: 'Статус', value: (t) => DISCOUNT_TYPE_STATUS_LABELS[discountTypeStatus(t)] },
      { header: 'Дата создания', value: (t) => t.createdAt || '' },
    ]),
  ], []);

  if (loading && !types) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Типы скидок"
        subtitle="Справочник номеров 1–5 и их названий для скидочных карт"
      />
      <DataTable
        columns={columns}
        data={sorted}
        rowKey={(t) => t.id}
        filters={filters}
        searchPlaceholder="Поиск типов скидок…"
        bulkActions={bulkActions}
        pageSize={10}
        emptyMessage="Типы скидок не настроены"
      />

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editNumber != null ? `Тип скидки №${editNumber}` : 'Тип скидки'}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Номер</label>
            <input className="input font-mono" value={editNumber ?? ''} readOnly disabled />
          </div>
          <div>
            <label className="label">Название</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="Например: Карта такси"
            />
          </div>
          <div>
            <label className="label">Статус</label>
            <select
              className="input"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as DiscountTypeStatus })}
            >
              <option value="active">Активен</option>
              <option value="inactive">Неактивен</option>
            </select>
          </div>
          <button type="submit" className="btn-primary w-full">
            Сохранить
          </button>
        </form>
      </Modal>
    </div>
  );
}
