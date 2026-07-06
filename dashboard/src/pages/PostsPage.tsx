import { FormEvent, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Plus, Settings, Trash2 } from 'lucide-react';
import { api, apiList } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_LIVE_INTERVAL_MS } from '../constants/live';
import { usePolling } from '../hooks/usePolling';
import { PageHeader, Loading, Modal, ErrorMessage } from '../components/UI';
import { DataTable, type DataTableBulkAction, type DataTableColumn, type DataTableFilter } from '../components/DataTable';
import { refId, resolveWashName } from '../utils/refs';
import { formatDateTime } from '../utils/format';
import type { Post, Wash } from '../types';
import { bulkDelete } from '../utils/bulk';
import { createExportBulkAction } from '../utils/export';

const emptyForm = { washId: '', postNumber: 1, name: '', serialNumber: '' };

export function PostsPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('create', 'update');
  const canDelete = hasPermission('delete');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [posts, washes] = await Promise.all([
      apiList<Post>('/crm/posts?populate=washId'),
      apiList<Wash>('/crm/washes'),
    ]);
    return { posts, washes };
  }, []);

  const { data, loading, refresh } = usePolling(fetchData, [], { intervalMs: DEFAULT_LIVE_INTERVAL_MS });

  const washById = useMemo(() => new Map((data?.washes || []).map((w) => [w.id, w])), [data?.washes]);

  const washName = useCallback(
    (washId: Post['washId']) => resolveWashName(washId, washById),
    [washById]
  );

  const openCreate = () => {
    setForm(emptyForm);
    setEditId(null);
    setModal(true);
  };

  const openEdit = (p: Post) => {
    setForm({
      washId: refId(p.washId),
      postNumber: p.postNumber,
      name: p.name,
      serialNumber: p.serialNumber,
    });
    setEditId(p.id);
    setModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить пост и все связанные данные (состояние, карты, статистика, финансы, MQTT)?')) return;
    try {
      await api(`/crm/posts/${id}`, { method: 'DELETE' });
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка удаления');
    }
  };

  const filters: DataTableFilter<Post>[] = useMemo(() => {
    const washOptions = (data?.washes || []).map((w) => ({ value: w.id, label: w.name }));
    return [
      {
        id: 'washId',
        label: 'Объект',
        options: washOptions,
        match: (p, v) => refId(p.washId) === v,
      },
    ];
  }, [data?.washes]);

  const columns: DataTableColumn<Post>[] = useMemo(
    () => [
      {
        key: 'postNumber',
        header: 'Номер поста',
        sortValue: (p) => p.postNumber,
        searchValue: (p) => `${p.postNumber} ${p.name} ${p.serialNumber}`,
        render: (p) => <span className="font-mono">{p.postNumber}</span>,
      },
      {
        key: 'wash',
        header: 'Объект',
        sortValue: (p) => washName(p.washId),
        searchValue: (p) => washName(p.washId),
        render: (p) => washName(p.washId),
      },
      {
        key: 'name',
        header: 'Название',
        searchValue: (p) => p.name,
        sortValue: (p) => p.name,
        render: (p) => p.name,
      },
      {
        key: 'serialNumber',
        header: 'Серийный номер',
        sortValue: (p) => p.serialNumber,
        searchValue: (p) => p.serialNumber,
        render: (p) => <span className="font-mono text-xs">{p.serialNumber}</span>,
      },
      {
        key: 'createdAt',
        header: 'Дата создания',
        sortable: true,
        sortValue: (p) => p.createdAt || '',
        searchValue: (p) => formatDateTime(p.createdAt),
        render: (p) => formatDateTime(p.createdAt),
      },
      ...[
            {
              key: 'actions',
              header: '',
              render: (p: Post) => (
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    className="btn-secondary !px-2 !py-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/posts/${p.id}#device-settings`);
                    }}
                    title="Настройки устройства"
                  >
                    <Settings size={14} />
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      className="btn-secondary !px-2 !py-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(p);
                      }}
                      title="Изменить"
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      className="btn-secondary !px-2 !py-1 text-red-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(p.id);
                      }}
                      title="Удалить"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ),
            } as DataTableColumn<Post>,
          ],
    ],
    [washName, canEdit, canDelete]
  );

  const bulkActions = useMemo((): DataTableBulkAction<Post>[] => {
    const actions: DataTableBulkAction<Post>[] = [
      createExportBulkAction('posts.csv', [
        { header: 'Номер', value: (p) => String(p.postNumber) },
        { header: 'Объект', value: (p) => washName(p.washId) },
        { header: 'Название', value: (p) => p.name },
        { header: 'Серийный номер', value: (p) => p.serialNumber },
        { header: 'Дата создания', value: (p) => p.createdAt || '' },
      ]),
    ];

    if (canDelete) {
      actions.push({
        id: 'delete',
        label: 'Удалить',
        variant: 'danger',
        confirmMessage: (_rows, ids) =>
          `Удалить ${ids.length} постов и все связанные данные?`,
        onAction: async (_rows, ids) => {
          await bulkDelete('/crm/posts', ids);
          refresh();
        },
      });
    }

    return actions;
  }, [canDelete, washName, refresh]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const body = {
        washId: form.washId,
        postNumber: Number(form.postNumber),
        name: form.name,
        serialNumber: form.serialNumber,
        settings: {},
      };
      if (editId) {
        const existing = data?.posts.find((p) => p.id === editId);
        await api(`/crm/posts/${editId}`, {
          method: 'PUT',
          body: JSON.stringify({ ...body, settings: existing?.settings || {} }),
        });
      } else {
        await api('/crm/posts', { method: 'POST', body: JSON.stringify(body) });
      }
      setModal(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    }
  };

  if (loading && !data) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Посты"
        subtitle="Посты объектов самообслуживания"
        actions={canEdit && <button type="button" className="btn-primary" onClick={openCreate}><Plus size={16} /> Добавить</button>}
      />
      {error && <div className="mb-4"><ErrorMessage message={error} /></div>}
      <DataTable
        tableId="posts"
        columns={columns}
        data={data?.posts || []}
        rowKey={(p) => p.id}
        filters={filters}
        searchPlaceholder="Поиск постов…"
        bulkActions={bulkActions}
        onRowClick={(p) => navigate(`/posts/${p.id}`)}
      />

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Редактировать пост' : 'Новый пост'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Объект</label>
            <select className="input" value={form.washId} onChange={(e) => setForm({ ...form, washId: e.target.value })} required>
              <option value="">Выберите...</option>
              {(data?.washes || []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div><label className="label">Номер поста</label><input className="input" type="number" min={1} value={form.postNumber} onChange={(e) => setForm({ ...form, postNumber: Number(e.target.value) })} required /></div>
          <div><label className="label">Название</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div><label className="label">Серийный номер</label><input className="input" value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} required /></div>
          <button type="submit" className="btn-primary w-full">Сохранить</button>
        </form>
      </Modal>
    </div>
  );
}
