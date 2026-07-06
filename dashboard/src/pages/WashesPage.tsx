import { FormEvent, useCallback, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api, apiListCatalog, clearCatalogCache } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { LIVE_INTERVAL_SLOW_MS } from '../constants/live';
import { usePolling } from '../hooks/usePolling';
import { PageHeader, Loading, Modal, ErrorMessage } from '../components/UI';
import { DataTable, type DataTableBulkAction, type DataTableColumn, type DataTableFilter } from '../components/DataTable';
import type { Wash, Post } from '../types';
import { refId } from '../utils/refs';
import { formatDateTime } from '../utils/format';
import { bulkDelete } from '../utils/bulk';
import { createExportBulkAction } from '../utils/export';

const emptyForm = { name: '', description: '', address: '', registeredAt: undefined as string | undefined, cloudEnabled: false };

export function WashesPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('create', 'update', 'delete');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [washes, posts] = await Promise.all([
      apiListCatalog<Wash>('/crm/washes'),
      apiListCatalog<Post>('/crm/posts'),
    ]);
    return { washes, posts };
  }, []);

  const { data, loading, refresh } = usePolling(fetchData, [], { intervalMs: LIVE_INTERVAL_SLOW_MS });

  const postCountByWash = useMemo(() => {
    const map: Record<string, number> = {};
    data?.posts.forEach((p) => {
      const id = refId(p.washId);
      map[id] = (map[id] || 0) + 1;
    });
    return map;
  }, [data?.posts]);

  const openCreate = () => {
    setForm(emptyForm);
    setEditId(null);
    setModal(true);
  };

  const openEdit = (w: Wash) => {
    setForm({
      name: w.name,
      description: w.description || '',
      address: w.address,
      registeredAt: w.registeredAt,
      cloudEnabled: w.cloudEnabled ?? false,
    });
    setEditId(w.id);
    setModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить объект и все посты с данными (состояние, карты, статистика, MQTT)?')) return;
    try {
      await api(`/crm/washes/${id}`, { method: 'DELETE' });
      clearCatalogCache('/api/crm/washes');
      clearCatalogCache('/api/crm/posts');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления');
    }
  };

  const filters: DataTableFilter<Wash>[] = useMemo(
    () => [
      {
        id: 'cloudEnabled',
        label: 'Облако',
        options: [
          { value: 'yes', label: 'Подключено' },
          { value: 'no', label: 'Не подключено' },
        ],
        match: (w, value) => (value === 'yes' ? !!w.cloudEnabled : !w.cloudEnabled),
      },
      {
        id: 'posts',
        label: 'Посты',
        options: [
          { value: 'with', label: 'С постами' },
          { value: 'without', label: 'Без постов' },
        ],
        match: (w, value) => {
          const count = postCountByWash[w.id] || 0;
          return value === 'with' ? count > 0 : count === 0;
        },
      },
    ],
    [postCountByWash]
  );

  const columns: DataTableColumn<Wash>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Название объекта',
        sortable: true,
        searchValue: (w) => `${w.name} ${w.description || ''}`,
        sortValue: (w) => w.name,
        render: (w) => (
          <div>
            <div className="font-medium">{w.name}</div>
            {w.description && <div className="text-xs text-slate-500">{w.description}</div>}
          </div>
        ),
      },
      {
        key: 'address',
        header: 'Адрес',
        sortable: true,
        searchValue: (w) => w.address,
        sortValue: (w) => w.address,
        render: (w) => w.address,
      },
      {
        key: 'posts',
        header: 'Количество постов',
        sortable: true,
        sortValue: (w) => postCountByWash[w.id] || 0,
        render: (w) => postCountByWash[w.id] || 0,
      },
      {
        key: 'createdAt',
        header: 'Дата создания',
        sortable: true,
        sortValue: (w) => w.createdAt || w.registeredAt || '',
        searchValue: (w) => formatDateTime(w.createdAt || w.registeredAt),
        render: (w) => formatDateTime(w.createdAt || w.registeredAt),
      },
      ...(canEdit
        ? [
            {
              key: 'actions',
              header: '',
              render: (w: Wash) => (
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    className="btn-secondary !px-2 !py-1"
                    onClick={() => openEdit(w)}
                    title="Изменить"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn-secondary !px-2 !py-1 text-red-600"
                    onClick={() => handleDelete(w.id)}
                    title="Удалить"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ),
            } as DataTableColumn<Wash>,
          ]
        : []),
    ],
    [canEdit, postCountByWash]
  );

  const bulkActions = useMemo((): DataTableBulkAction<Wash>[] => {
    const actions: DataTableBulkAction<Wash>[] = [
      createExportBulkAction('washes.csv', [
        { header: 'Название', value: (w) => w.name },
        { header: 'Адрес', value: (w) => w.address },
        { header: 'Описание', value: (w) => w.description || '' },
        { header: 'Постов', value: (w) => String(postCountByWash[w.id] || 0) },
        { header: 'Дата создания', value: (w) => w.createdAt || w.registeredAt || '' },
      ]),
    ];
    if (canEdit) {
      actions.push({
        id: 'delete',
        label: 'Удалить',
        variant: 'danger',
        confirmMessage: (_rows, ids) =>
          `Удалить ${ids.length} автомоек и все посты с данными?`,
        onAction: async (_rows, ids) => {
          await bulkDelete('/crm/washes', ids);
          clearCatalogCache('/api/crm/washes');
          clearCatalogCache('/api/crm/posts');
          refresh();
        },
      });
    }
    return actions;
  }, [canEdit, postCountByWash, refresh]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const body = editId
        ? {
            name: form.name,
            description: form.description,
            address: form.address,
            registeredAt: form.registeredAt || new Date().toISOString(),
            cloudEnabled: form.cloudEnabled ?? false,
          }
        : { ...form, registeredAt: new Date().toISOString(), cloudEnabled: false };
      if (editId) {
        await api(`/crm/washes/${editId}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await api('/crm/washes', { method: 'POST', body: JSON.stringify(body) });
      }
      setModal(false);
      clearCatalogCache('/api/crm/washes');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    }
  };

  if (loading && !data) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Автомойки самообслуживания"
        subtitle="Управление автомойками самообслуживания"
        actions={canEdit && <button className="btn-primary" onClick={openCreate}><Plus size={16} /> Добавить</button>}
      />
      {error && <div className="mb-4"><ErrorMessage message={error} /></div>}
      <DataTable
        tableId="washes"
        columns={columns}
        data={data?.washes || []}
        rowKey={(w) => w.id}
        filters={filters}
        searchPlaceholder="Поиск автомоек…"
        bulkActions={bulkActions}
      />

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Редактировать автомойку' : 'Новая автомойка'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div><label className="label">Название</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div><label className="label">Описание</label><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><label className="label">Адрес</label><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required /></div>
          <button type="submit" className="btn-primary w-full">Сохранить</button>
        </form>
      </Modal>
    </div>
  );
}
