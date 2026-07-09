import { FormEvent, useCallback, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api, apiListCatalog, bulkDeleteWashes, clearCatalogCache, deleteWash, formatWashDeleteSummary } from '../api/client';
import { syncMqttUsers } from '../api/postDevice';
import { useAuth } from '../context/AuthContext';
import { LIVE_INTERVAL_SLOW_MS } from '../constants/live';
import { usePolling } from '../hooks/usePolling';
import { useLocale } from '../i18n/LocaleContext';
import { PageHeader, Loading, Modal, ErrorMessage } from '../components/UI';
import { DataTable, type DataTableBulkAction, type DataTableColumn, type DataTableFilter } from '../components/DataTable';
import type { Wash, Post } from '../types';
import { refId } from '../utils/refs';
import { formatDateTime } from '../utils/format';
import { createExportBulkAction } from '../utils/export';

const emptyForm = { name: '', description: '', address: '', registeredAt: undefined as string | undefined, cloudEnabled: false };

export function WashesPage() {
  const { hasPermission } = useAuth();
  const { t } = useLocale();
  const canEdit = hasPermission('create', 'update', 'delete');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deleteProgress, setDeleteProgress] = useState('');
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

  const applyMqttSync = async () => {
    try {
      await syncMqttUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pages.washes.mqttSyncFailed'));
      throw err;
    }
  };

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
    if (
      !confirm(
        t('pages.washes.confirmDeleteOne')
      )
    ) {
      return;
    }
    setError('');
    setNotice('');
    setDeleteProgress(t('pages.washes.deletingOne'));
    try {
      const result = await deleteWash(id);
      setDeleteProgress('');
      setNotice(formatWashDeleteSummary([result]));
      await applyMqttSync();
      await refresh();
    } catch (err) {
      setDeleteProgress('');
      setError(err instanceof Error ? err.message : t('pages.washes.deleteError'));
    }
  };

  const filters: DataTableFilter<Wash>[] = useMemo(
    () => [
      {
        id: 'cloudEnabled',
        label: t('pages.washes.filters.cloud'),
        options: [
          { value: 'yes', label: t('pages.washes.filters.connected') },
          { value: 'no', label: t('pages.washes.filters.notConnected') },
        ],
        match: (w, value) => (value === 'yes' ? !!w.cloudEnabled : !w.cloudEnabled),
      },
      {
        id: 'posts',
        label: t('pages.washes.filters.posts'),
        options: [
          { value: 'with', label: t('pages.washes.filters.withPosts') },
          { value: 'without', label: t('pages.washes.filters.withoutPosts') },
        ],
        match: (w, value) => {
          const count = postCountByWash[w.id] || 0;
          return value === 'with' ? count > 0 : count === 0;
        },
      },
    ],
    [postCountByWash, t]
  );

  const columns: DataTableColumn<Wash>[] = useMemo(
    () => [
      {
        key: 'name',
        header: t('pages.washes.columns.objectName'),
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
        header: t('pages.washes.columns.address'),
        sortable: true,
        searchValue: (w) => w.address,
        sortValue: (w) => w.address,
        render: (w) => w.address,
      },
      {
        key: 'posts',
        header: t('pages.washes.columns.postsCount'),
        sortable: true,
        sortValue: (w) => postCountByWash[w.id] || 0,
        render: (w) => postCountByWash[w.id] || 0,
      },
      {
        key: 'createdAt',
        header: t('pages.washes.columns.createdAt'),
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
                    title={t('common.edit')}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn-secondary !px-2 !py-1 text-red-600"
                    onClick={() => handleDelete(w.id)}
                    title={t('common.delete')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ),
            } as DataTableColumn<Wash>,
          ]
        : []),
    ],
    [canEdit, postCountByWash, t]
  );

  const bulkActions = useMemo((): DataTableBulkAction<Wash>[] => {
    const actions: DataTableBulkAction<Wash>[] = [
      createExportBulkAction('washes.csv', [
        { header: t('pages.washes.export.name'), value: (w) => w.name },
        { header: t('pages.washes.export.address'), value: (w) => w.address },
        { header: t('pages.washes.export.description'), value: (w) => w.description || '' },
        { header: t('pages.washes.export.posts'), value: (w) => String(postCountByWash[w.id] || 0) },
        { header: t('pages.washes.export.createdAt'), value: (w) => w.createdAt || w.registeredAt || '' },
      ]),
    ];
    if (canEdit) {
      actions.push({
        id: 'delete',
        label: t('common.delete'),
        variant: 'danger',
        confirmMessage: (_rows, ids) =>
          t('pages.washes.confirmDeleteMany', { count: ids.length }),
        onAction: async (_rows, ids) => {
          setError('');
          setNotice('');
          try {
            const results = await bulkDeleteWashes(ids, (current, total) => {
              setDeleteProgress(t('pages.washes.deletingProgress', { current, total }));
            });
            setDeleteProgress('');
            setNotice(formatWashDeleteSummary(results));
            await applyMqttSync();
            await refresh();
          } catch (err) {
            setDeleteProgress('');
            setError(err instanceof Error ? err.message : t('pages.washes.deleteError'));
            throw err;
          }
        },
      });
    }
    return actions;
  }, [canEdit, postCountByWash, refresh, t]);

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
      clearCatalogCache('/crm/washes');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.saveFailed'));
    }
  };

  if (loading && !data) return <Loading />;

  return (
    <div>
      <PageHeader
        title={t('pages.washes.title')}
        subtitle={t('pages.washes.subtitle')}
        actions={canEdit && <button className="btn-primary" onClick={openCreate}><Plus size={16} /> {t('pages.washes.add')}</button>}
      />
      {error && <div className="mb-4"><ErrorMessage message={error} /></div>}
      {deleteProgress && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-panel-border bg-panel-canvas/80 px-4 py-3 text-sm text-panel-muted dark:border-panel-border-dark dark:bg-white/[0.03]">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          {deleteProgress}
        </div>
      )}
      {notice && !deleteProgress && (
        <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100">
          {notice}
        </div>
      )}
      <DataTable
        tableId="washes"
        columns={columns}
        data={data?.washes || []}
        rowKey={(w) => w.id}
        filters={filters}
        searchPlaceholder={t('pages.washes.searchPlaceholder')}
        bulkActions={bulkActions}
      />

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? t('pages.washes.editTitle') : t('pages.washes.newTitle')}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div><label className="label">{t('common.title')}</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div><label className="label">{t('pages.washes.description')}</label><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><label className="label">{t('pages.washes.address')}</label><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required /></div>
          <button type="submit" className="btn-primary w-full">{t('common.save')}</button>
        </form>
      </Modal>
    </div>
  );
}
