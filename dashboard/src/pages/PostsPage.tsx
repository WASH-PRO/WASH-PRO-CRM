import { FormEvent, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Plus, RefreshCw, Settings, Trash2 } from 'lucide-react';
import { api, apiListBounded, apiListCatalog, clearCatalogCache } from '../api/client';
import { syncMqttUsers } from '../api/postDevice';
import { useAuth } from '../context/AuthContext';
import { LIVE_INTERVAL_FAST_MS } from '../constants/live';
import { usePolling } from '../hooks/usePolling';
import { useLocale } from '../i18n/LocaleContext';
import { PageHeader, Loading, Modal, ErrorMessage } from '../components/UI';
import { PostOnlineStatus } from '../components/PostOnlineStatus';
import { DataTable, type DataTableBulkAction, type DataTableColumn, type DataTableFilter } from '../components/DataTable';
import { refId, resolveWashName } from '../utils/refs';
import { formatDateTime } from '../utils/format';
import { latestPostStateByPost, isPostOnline } from '../utils/statsAggregation';
import {
  defaultMqttLogin,
  generateMqttPassword,
  mqttBrokerEndpoint,
  needsMqttUserSync,
  readPostMqttSettings,
} from '../utils/postMqtt';
import type { Post, PostSettings, PostState, Wash } from '../types';
import { bulkDelete } from '../utils/bulk';
import { createExportBulkAction } from '../utils/export';

interface PostFormState {
  washId: string;
  postNumber: number;
  name: string;
  serialNumber: string;
  mqttLogin: string;
  mqttPassword: string;
}

function emptyForm(): PostFormState {
  return {
    washId: '',
    postNumber: 1,
    name: '',
    serialNumber: '',
    mqttLogin: '',
    mqttPassword: generateMqttPassword(),
  };
}

function buildSettings(
  prev: PostSettings | undefined,
  form: PostFormState,
  options: { isEdit: boolean }
): PostSettings {
  const mqttLogin = form.mqttLogin.trim() || defaultMqttLogin(form.serialNumber);
  // На edit никогда не генерируем новый пароль «втихую» — только явный ввод или прежний.
  const mqttPassword =
    form.mqttPassword.trim() ||
    prev?.mqttPassword ||
    (options.isEdit ? '' : generateMqttPassword());

  return {
    ...(prev || {}),
    mqttLogin,
    mqttPassword,
  };
}

export function PostsPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { t } = useLocale();
  const canEdit = hasPermission('create', 'update');
  const canDelete = hasPermission('delete');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<PostFormState>(emptyForm);
  const [mqttLoginCustom, setMqttLoginCustom] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const brokerEndpoint = useMemo(() => mqttBrokerEndpoint(), []);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    const [posts, washes, states] = await Promise.all([
      apiListCatalog<Post>('/crm/posts?populate=washId', signal),
      apiListCatalog<Wash>('/crm/washes', signal),
      apiListBounded<PostState>('/crm/post-states', signal, 5),
    ]);
    const stateByPost = new Map(latestPostStateByPost(states).map((s) => [refId(s.postId), s]));
    return { posts, washes, stateByPost };
  }, []);

  const { data, loading, refresh } = usePolling(fetchData, [], { intervalMs: LIVE_INTERVAL_FAST_MS });

  const washById = useMemo(() => new Map((data?.washes || []).map((w) => [w.id, w])), [data?.washes]);

  const washName = useCallback(
    (washId: Post['washId']) => resolveWashName(washId, washById),
    [washById]
  );

  const applyMqttSync = async () => {
    try {
      await syncMqttUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pages.posts.mqttSyncFailed'));
      throw err;
    }
  };

  const openCreate = () => {
    const initial = emptyForm();
    setForm(initial);
    setMqttLoginCustom(false);
    setEditId(null);
    setModal(true);
  };

  const openEdit = (p: Post) => {
    const mqtt = readPostMqttSettings(p.settings);
    setForm({
      washId: refId(p.washId),
      postNumber: p.postNumber,
      name: p.name,
      serialNumber: p.serialNumber,
      mqttLogin: mqtt.mqttLogin || defaultMqttLogin(p.serialNumber),
      mqttPassword: mqtt.mqttPassword,
    });
    setMqttLoginCustom(Boolean(mqtt.mqttLogin));
    setEditId(p.id);
    setModal(true);
  };

  const updateSerialNumber = (serialNumber: string) => {
    setForm((prev) => {
      const next = { ...prev, serialNumber };
      if (!editId && !mqttLoginCustom && serialNumber.trim()) {
        next.mqttLogin = defaultMqttLogin(serialNumber);
      }
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('pages.posts.confirmDeleteOne'))) return;
    try {
      await api(`/crm/posts/${id}`, { method: 'DELETE' });
      await applyMqttSync();
      clearCatalogCache('/crm/posts');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pages.posts.deleteError'));
    }
  };

  const filters: DataTableFilter<Post>[] = useMemo(() => {
    const washOptions = (data?.washes || []).map((w) => ({ value: w.id, label: w.name }));
    return [
      {
        id: 'washId',
        label: t('pages.posts.filters.object'),
        options: washOptions,
        match: (p, v) => refId(p.washId) === v,
      },
    ];
  }, [data?.washes, t]);

  const columns: DataTableColumn<Post>[] = useMemo(
    () => [
      {
        key: 'status',
        header: t('common.status'),
        sortable: true,
        sortValue: (p) => (isPostOnline(data?.stateByPost.get(p.id)) ? 1 : 0),
        searchValue: (p) => (isPostOnline(data?.stateByPost.get(p.id)) ? t('status.online') : t('status.offline')),
        render: (p) => <PostOnlineStatus state={data?.stateByPost.get(p.id)} />,
      },
      {
        key: 'postNumber',
        header: t('pages.posts.columns.postNumber'),
        sortValue: (p) => p.postNumber,
        searchValue: (p) => `${p.postNumber} ${p.name} ${p.serialNumber}`,
        render: (p) => <span className="font-mono">{p.postNumber}</span>,
      },
      {
        key: 'wash',
        header: t('pages.posts.columns.object'),
        sortValue: (p) => washName(p.washId),
        searchValue: (p) => washName(p.washId),
        render: (p) => washName(p.washId),
      },
      {
        key: 'name',
        header: t('pages.posts.columns.name'),
        searchValue: (p) => p.name,
        sortValue: (p) => p.name,
        render: (p) => p.name,
      },
      {
        key: 'serialNumber',
        header: t('pages.posts.columns.serialNumber'),
        sortValue: (p) => p.serialNumber,
        searchValue: (p) => p.serialNumber,
        render: (p) => <span className="font-mono text-xs">{p.serialNumber}</span>,
      },
      {
        key: 'mqttLogin',
        header: t('pages.posts.columns.mqttLogin'),
        searchValue: (p) => readPostMqttSettings(p.settings).mqttLogin,
        sortValue: (p) => readPostMqttSettings(p.settings).mqttLogin,
        render: (p) => (
          <span className="font-mono text-xs">{readPostMqttSettings(p.settings).mqttLogin || t('common.notAvailable')}</span>
        ),
      },
      {
        key: 'createdAt',
        header: t('pages.posts.columns.createdAt'),
        sortable: true,
        sortValue: (p) => p.createdAt || '',
        searchValue: (p) => formatDateTime(p.createdAt),
        render: (p) => formatDateTime(p.createdAt),
      },
      {
        key: 'actions',
        header: '',
        render: (p: Post) => (
          <div className="flex justify-end gap-1">
            <button
              type="button"
              className="btn-secondary btn-sm !px-2"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/posts/${p.id}#device-settings`);
              }}
              title={t('pages.posts.deviceSettings')}
            >
              <Settings size={14} />
            </button>
            {canEdit && (
              <button
                type="button"
                className="btn-secondary btn-sm !px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  openEdit(p);
                }}
                title={t('common.edit')}
              >
                <Pencil size={14} />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                className="btn-secondary btn-sm !px-2 text-red-600 dark:text-red-400"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(p.id);
                }}
                title={t('common.delete')}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ),
      },
    ],
    [washName, canEdit, canDelete, navigate, data?.stateByPost, t]
  );

  const bulkActions = useMemo((): DataTableBulkAction<Post>[] => {
    const actions: DataTableBulkAction<Post>[] = [
      createExportBulkAction('posts.csv', [
        { header: t('common.status'), value: (p) => (isPostOnline(data?.stateByPost.get(p.id)) ? t('status.online') : t('status.offline')) },
        { header: t('pages.posts.export.number'), value: (p) => String(p.postNumber) },
        { header: t('pages.posts.export.object'), value: (p) => washName(p.washId) },
        { header: t('pages.posts.export.name'), value: (p) => p.name },
        { header: t('pages.posts.export.serialNumber'), value: (p) => p.serialNumber },
        { header: t('pages.posts.export.mqttLogin'), value: (p) => readPostMqttSettings(p.settings).mqttLogin },
        { header: t('pages.posts.export.createdAt'), value: (p) => p.createdAt || '' },
      ]),
    ];

    if (canDelete) {
      actions.push({
        id: 'delete',
        label: t('common.delete'),
        variant: 'danger',
        confirmMessage: (_rows, ids) =>
          t('pages.posts.confirmDeleteMany', { count: ids.length }),
        onAction: async (_rows, ids) => {
          await bulkDelete('/crm/posts', ids);
          await applyMqttSync();
          refresh();
        },
      });
    }

    return actions;
  }, [canDelete, washName, refresh, data?.stateByPost, t]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const existing = editId ? data?.posts.find((p) => p.id === editId) : undefined;
      const settings = buildSettings(existing?.settings, form, { isEdit: Boolean(editId) });
      if (!settings.mqttPassword?.trim()) {
        setError(t('pages.posts.mqttPasswordRequired'));
        return;
      }
      const body = {
        washId: form.washId,
        postNumber: Number(form.postNumber),
        name: form.name,
        serialNumber: form.serialNumber.trim(),
        settings,
      };

      if (editId) {
        await api(`/crm/posts/${editId}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } else {
        await api('/crm/posts', { method: 'POST', body: JSON.stringify(body) });
      }

      if (
        needsMqttUserSync(existing, {
          serialNumber: body.serialNumber,
          mqttLogin: form.mqttLogin,
          mqttPassword: form.mqttPassword,
        })
      ) {
        await applyMqttSync();
      }
      clearCatalogCache('/crm/posts');
      setModal(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.saveFailed'));
    }
  };

  if (loading && !data) return <Loading />;

  return (
    <div>
      <PageHeader
        title={t('pages.posts.title')}
        subtitle={t('pages.posts.subtitle')}
        actions={canEdit && <button type="button" className="btn-primary" onClick={openCreate}><Plus size={16} /> {t('pages.posts.add')}</button>}
      />
      {error && <div className="mb-4"><ErrorMessage message={error} /></div>}
      <DataTable
        tableId="posts"
        columns={columns}
        data={data?.posts || []}
        rowKey={(p) => p.id}
        filters={filters}
        searchPlaceholder={t('pages.posts.searchPlaceholder')}
        bulkActions={bulkActions}
        onRowClick={(p) => navigate(`/posts/${p.id}`)}
      />

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? t('pages.posts.editTitle') : t('pages.posts.newTitle')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">{t('pages.posts.fields.object')}</label>
            <select className="input" value={form.washId} onChange={(e) => setForm({ ...form, washId: e.target.value })} required>
              <option value="">{t('pages.posts.selectObject')}</option>
              {(data?.washes || []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{t('pages.posts.fields.postNumber')}</label>
            <input className="input" type="number" min={1} value={form.postNumber} onChange={(e) => setForm({ ...form, postNumber: Number(e.target.value) })} required />
          </div>
          <div>
            <label className="label">{t('pages.posts.fields.name')}</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">{t('pages.posts.fields.serialNumber')}</label>
            <input className="input font-mono" value={form.serialNumber} onChange={(e) => updateSerialNumber(e.target.value)} required />
          </div>

          <div className="space-y-3 rounded-panel border border-panel-border bg-panel-canvas/60 p-4 dark:border-panel-border-dark dark:bg-[#0d1218]/60">
            <div>
              <h3 className="text-sm font-semibold text-panel-ink dark:text-panel-ink-dark">{t('pages.posts.mqtt.title')}</h3>
              <p className="field-hint mt-1">
                {t('pages.posts.mqtt.hint', { port: brokerEndpoint.split(':')[1] || '1883' })}
              </p>
            </div>
            <div>
              <label className="label">{t('pages.posts.mqtt.broker')}</label>
              <input className="input font-mono text-sm" value={brokerEndpoint} readOnly />
            </div>
            <div>
              <label className="label">{t('pages.posts.mqtt.login')}</label>
              <input
                className="input font-mono"
                value={form.mqttLogin}
                onChange={(e) => {
                  setMqttLoginCustom(true);
                  setForm({ ...form, mqttLogin: e.target.value });
                }}
                required
              />
            </div>
            <div>
              <label className="label">{t('pages.posts.mqtt.password')}</label>
              <div className="flex gap-2">
                <input
                  className="input font-mono"
                  value={form.mqttPassword}
                  onChange={(e) => setForm({ ...form, mqttPassword: e.target.value })}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="btn-secondary btn-sm shrink-0"
                  title={t('pages.posts.mqtt.generatePassword')}
                  onClick={() => setForm({ ...form, mqttPassword: generateMqttPassword() })}
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full">{t('common.save')}</button>
        </form>
      </Modal>
    </div>
  );
}
