import { FormEvent, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Plus, RefreshCw, Settings, Trash2 } from 'lucide-react';
import { api, apiListBounded, apiListCatalog, clearCatalogCache } from '../api/client';
import { syncMqttUsers } from '../api/postDevice';
import { useAuth } from '../context/AuthContext';
import { LIVE_INTERVAL_FAST_MS } from '../constants/live';
import { usePolling } from '../hooks/usePolling';
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

function buildSettings(prev: PostSettings | undefined, form: PostFormState): PostSettings {
  const mqttLogin = form.mqttLogin.trim() || defaultMqttLogin(form.serialNumber);
  const mqttPassword = form.mqttPassword.trim() || prev?.mqttPassword || generateMqttPassword();

  return {
    ...(prev || {}),
    mqttLogin,
    mqttPassword,
  };
}

export function PostsPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
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
      setError(err instanceof Error ? err.message : 'Не удалось применить учётные записи MQTT');
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
    if (!confirm('Удалить пост и все связанные данные (состояние, карты, статистика, финансы, MQTT)?')) return;
    try {
      await api(`/crm/posts/${id}`, { method: 'DELETE' });
      await applyMqttSync();
      clearCatalogCache('/crm/posts');
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
        key: 'status',
        header: 'Статус',
        sortable: true,
        sortValue: (p) => (isPostOnline(data?.stateByPost.get(p.id)) ? 1 : 0),
        searchValue: (p) => (isPostOnline(data?.stateByPost.get(p.id)) ? 'онлайн' : 'оффлайн'),
        render: (p) => <PostOnlineStatus state={data?.stateByPost.get(p.id)} />,
      },
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
        key: 'mqttLogin',
        header: 'MQTT логин',
        searchValue: (p) => readPostMqttSettings(p.settings).mqttLogin,
        sortValue: (p) => readPostMqttSettings(p.settings).mqttLogin,
        render: (p) => (
          <span className="font-mono text-xs">{readPostMqttSettings(p.settings).mqttLogin || '—'}</span>
        ),
      },
      {
        key: 'createdAt',
        header: 'Дата создания',
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
              title="Настройки устройства"
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
                title="Изменить"
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
                title="Удалить"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ),
      },
    ],
    [washName, canEdit, canDelete, navigate, data?.stateByPost]
  );

  const bulkActions = useMemo((): DataTableBulkAction<Post>[] => {
    const actions: DataTableBulkAction<Post>[] = [
      createExportBulkAction('posts.csv', [
        { header: 'Статус', value: (p) => (isPostOnline(data?.stateByPost.get(p.id)) ? 'Онлайн' : 'Офлайн') },
        { header: 'Номер', value: (p) => String(p.postNumber) },
        { header: 'Объект', value: (p) => washName(p.washId) },
        { header: 'Название', value: (p) => p.name },
        { header: 'Серийный номер', value: (p) => p.serialNumber },
        { header: 'MQTT логин', value: (p) => readPostMqttSettings(p.settings).mqttLogin },
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
          await applyMqttSync();
          refresh();
        },
      });
    }

    return actions;
  }, [canDelete, washName, refresh, data?.stateByPost]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const existing = editId ? data?.posts.find((p) => p.id === editId) : undefined;
      const settings = buildSettings(existing?.settings, form);
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

      await applyMqttSync();
      clearCatalogCache('/crm/posts');
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Объект</label>
            <select className="input" value={form.washId} onChange={(e) => setForm({ ...form, washId: e.target.value })} required>
              <option value="">Выберите...</option>
              {(data?.washes || []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Номер поста</label>
            <input className="input" type="number" min={1} value={form.postNumber} onChange={(e) => setForm({ ...form, postNumber: Number(e.target.value) })} required />
          </div>
          <div>
            <label className="label">Название</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">Серийный номер</label>
            <input className="input font-mono" value={form.serialNumber} onChange={(e) => updateSerialNumber(e.target.value)} required />
          </div>

          <div className="space-y-3 rounded-panel border border-panel-border bg-panel-canvas/60 p-4 dark:border-panel-border-dark dark:bg-[#0d1218]/60">
            <div>
              <h3 className="text-sm font-semibold text-panel-ink dark:text-panel-ink-dark">Подключение MQTT</h3>
              <p className="field-hint mt-1">
                Укажите на панели в NVS: <span className="font-mono">rm_addr</span> — IP сервера CRM,{' '}
                <span className="font-mono">rm_port</span> — {brokerEndpoint.split(':')[1] || '1883'},{' '}
                <span className="font-mono">rm_login</span> / <span className="font-mono">rm_pass</span> — значения ниже.
                Не используйте логин <span className="font-mono">superadmin</span> — он только для CRM.
              </p>
            </div>
            <div>
              <label className="label">Брокер (rm_addr:rm_port)</label>
              <input className="input font-mono text-sm" value={brokerEndpoint} readOnly />
            </div>
            <div>
              <label className="label">Логин MQTT (rm_login)</label>
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
              <label className="label">Пароль MQTT (rm_pass)</label>
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
                  title="Сгенерировать пароль"
                  onClick={() => setForm({ ...form, mqttPassword: generateMqttPassword() })}
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full">Сохранить</button>
        </form>
      </Modal>
    </div>
  );
}
