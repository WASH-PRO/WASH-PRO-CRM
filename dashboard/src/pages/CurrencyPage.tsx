import { FormEvent, useCallback, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api, apiListDictionary } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { LIVE_INTERVAL_SLOW_MS } from '../constants/live';
import { usePolling } from '../hooks/usePolling';
import { PageHeader, Loading, Modal, Badge } from '../components/UI';
import { DataTable, type DataTableBulkAction, type DataTableColumn, type DataTableFilter } from '../components/DataTable';
import type { Currency } from '../types';
import { bulkDelete } from '../utils/bulk';
import { createExportBulkAction } from '../utils/export';
import { formatDateTime } from '../utils/format';
import { useLocale } from '../i18n/LocaleContext';

const emptyForm = { code: '', name: '', symbol: '', isDefault: false };

export function CurrencyPage() {
  const { t } = useLocale();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('create', 'update', 'delete');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);

  const fetchCurrencies = useCallback(
    (signal: AbortSignal) => apiListDictionary<Currency>('/crm/currencies', signal),
    []
  );
  const { data: currencies, loading, refresh } = usePolling(fetchCurrencies, [], { intervalMs: LIVE_INTERVAL_SLOW_MS });

  const openCreate = () => {
    setForm(emptyForm);
    setEditId(null);
    setModal(true);
  };

  const openEdit = (c: Currency) => {
    setForm({ code: c.code, name: c.name, symbol: c.symbol, isDefault: c.isDefault });
    setEditId(c.id);
    setModal(true);
  };

  const setAsDefault = async (c: Currency) => {
    const list = currencies || [];
    for (const item of list) {
      if (item.isDefault && item.id !== c.id) {
        await api(`/crm/currencies/${item.id}`, {
          method: 'PUT',
          body: JSON.stringify({ ...item, isDefault: false }),
        });
      }
    }
    await api(`/crm/currencies/${c.id}`, {
      method: 'PUT',
      body: JSON.stringify({ code: c.code, name: c.name, symbol: c.symbol, isDefault: true }),
    });
    refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('pages.currency.confirmDeleteOne'))) return;
    await api(`/crm/currencies/${id}`, { method: 'DELETE' });
    refresh();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const body = { ...form, code: form.code.toUpperCase() };
    if (editId) {
      await api(`/crm/currencies/${editId}`, { method: 'PUT', body: JSON.stringify(body) });
      if (body.isDefault) {
        const list = currencies || [];
        for (const item of list) {
          if (item.isDefault && item.id !== editId) {
            await api(`/crm/currencies/${item.id}`, {
              method: 'PUT',
              body: JSON.stringify({ ...item, isDefault: false }),
            });
          }
        }
      }
    } else {
      await api('/crm/currencies', { method: 'POST', body: JSON.stringify(body) });
    }
    setModal(false);
    refresh();
  };

  const filters: DataTableFilter<Currency>[] = [
    {
      id: 'isDefault',
      label: t('pages.currency.default'),
      options: [{ value: 'yes', label: t('pages.currency.active') }],
      match: (c, v) => v === 'yes' && c.isDefault,
    },
  ];

  const columns: DataTableColumn<Currency>[] = useMemo(
    () => [
      {
        key: 'code',
        header: t('pages.currency.code'),
        sortable: true,
        searchValue: (c) => `${c.code} ${c.name} ${c.symbol}`,
        sortValue: (c) => c.code,
        render: (c) => <span className="font-mono font-medium">{c.code}</span>,
      },
      {
        key: 'name',
        header: t('pages.currency.name'),
        sortable: true,
        sortValue: (c) => c.name,
        render: (c) => c.name,
      },
      {
        key: 'symbol',
        header: t('pages.currency.symbol'),
        sortable: true,
        sortValue: (c) => c.symbol,
        render: (c) => <span className="text-lg">{c.symbol}</span>,
      },
      {
        key: 'isDefault',
        header: t('pages.currency.default'),
        sortable: true,
        sortValue: (c) => (c.isDefault ? 1 : 0),
        render: (c) =>
          c.isDefault ? (
            <Badge variant="success">{t('pages.currency.active')}</Badge>
          ) : canEdit ? (
            <button type="button" className="btn-secondary !py-1 !px-2 text-xs" onClick={() => setAsDefault(c)}>
              {t('pages.currency.makeActive')}
            </button>
          ) : (
            '—'
          ),
      },
      {
        key: 'createdAt',
        header: t('pages.currency.createdAt'),
        sortable: true,
        sortValue: (c) => c.createdAt || '',
        render: (c) => formatDateTime(c.createdAt),
      },
      ...(canEdit
        ? [
            {
              key: 'actions',
              header: '',
              render: (c: Currency) => (
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    className="btn-secondary !px-2 !py-1"
                    onClick={() => openEdit(c)}
                    title={t('common.edit')}
                  >
                    <Pencil size={14} />
                  </button>
                  {!c.isDefault && (
                    <button
                      type="button"
                      className="btn-secondary !px-2 !py-1 text-red-600"
                      onClick={() => handleDelete(c.id)}
                      title={t('common.delete')}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ),
            } as DataTableColumn<Currency>,
          ]
        : []),
    ],
    [canEdit, currencies, t]
  );

  const bulkActions = useMemo((): DataTableBulkAction<Currency>[] => {
    const actions: DataTableBulkAction<Currency>[] = [
      createExportBulkAction('currencies.csv', [
        { header: t('pages.currency.code'), value: (c) => c.code },
        { header: t('pages.currency.name'), value: (c) => c.name },
        { header: t('pages.currency.symbol'), value: (c) => c.symbol },
        { header: t('pages.currency.default'), value: (c) => (c.isDefault ? t('common.yes') : t('common.no')) },
        { header: t('pages.currency.createdAt'), value: (c) => c.createdAt || '' },
      ]),
    ];
    if (canEdit) {
      actions.push({
        id: 'delete',
        label: t('common.delete'),
        variant: 'danger',
        confirmMessage: (_rows, ids) => t('pages.currency.confirmDeleteMany', { count: ids.length }),
        disabled: (rows) => rows.some((c) => c.isDefault),
        onAction: async (_rows, ids) => {
          await bulkDelete('/crm/currencies', ids);
          refresh();
        },
      });
    }
    return actions;
  }, [canEdit, refresh, t]);

  if (loading && !currencies) return <Loading />;

  return (
    <div>
      <PageHeader
        title={t('nav.items.currency')}
        subtitle={t('pages.currency.subtitle')}
        actions={
          canEdit && (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} /> {t('pages.currency.add')}
            </button>
          )
        }
      />
      <DataTable
        tableId="currency"
        columns={columns}
        data={currencies || []}
        rowKey={(c) => c.id}
        filters={filters}
        searchPlaceholder={t('pages.currency.searchPlaceholder')}
        bulkActions={bulkActions}
        isRowSelectable={(c) => !c.isDefault}
      />

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editId ? t('pages.currency.edit') : t('pages.currency.new')}
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">{t('pages.currency.isoCode')}</label>
            <input className="input font-mono" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required maxLength={3} placeholder="RUB" />
          </div>
          <div>
            <label className="label">{t('pages.currency.currencyName')}</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder={t('pages.currency.namePlaceholder')}
            />
          </div>
          <div>
            <label className="label">{t('pages.currency.symbol')}</label>
            <input className="input" value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })} required placeholder="₽" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
            {t('pages.currency.useDefault')}
          </label>
          <button type="submit" className="btn-primary w-full">
            {t('common.save')}
          </button>
        </form>
      </Modal>
    </div>
  );
}
