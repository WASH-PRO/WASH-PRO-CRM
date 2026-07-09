import { FormEvent, useCallback, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api, apiListDictionary } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { LIVE_INTERVAL_SLOW_MS } from '../constants/live';
import { usePolling } from '../hooks/usePolling';
import { PageHeader, Loading, Modal, Badge } from '../components/UI';
import { DataTable, type DataTableBulkAction, type DataTableColumn, type DataTableFilter } from '../components/DataTable';
import type { InfoMessage, Wash } from '../types';
import { bulkDelete } from '../utils/bulk';
import { createExportBulkAction } from '../utils/export';
import { formatDateTime } from '../utils/format';
import {
  INFO_MESSAGE_STATUS_LABELS,
  INFO_MESSAGE_STATUS_VARIANT,
  resolveInfoMessageDisplayStatus,
} from '../utils/infoMessages';

const CATEGORY_LABELS: Record<string, string> = {
  news: 'Новость',
  promotion: 'Акция',
  general: 'Общее',
};

const emptyForm = {
  title: '',
  body: '',
  imageUrl: '',
  category: 'news' as InfoMessage['category'],
  status: 'published' as InfoMessage['status'],
  publishedAt: '',
  expiresAt: '',
  washId: '',
  sortOrder: 0,
};

function toLocalInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function InfoMessagesPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('create', 'update', 'delete');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);

  const fetchMessages = useCallback(
    (signal: AbortSignal) => apiListDictionary<InfoMessage>('/crm/info-messages', signal),
    []
  );
  const fetchWashes = useCallback(
    (signal: AbortSignal) => apiListDictionary<Wash>('/crm/washes', signal),
    []
  );

  const { data: messages, loading, refresh } = usePolling(fetchMessages, [], { intervalMs: LIVE_INTERVAL_SLOW_MS });
  const { data: washes } = usePolling(fetchWashes, [], { intervalMs: LIVE_INTERVAL_SLOW_MS, live: false });

  const washById = useMemo(() => {
    const map = new Map<string, Wash>();
    for (const wash of washes ?? []) map.set(wash.id, wash);
    return map;
  }, [washes]);

  const openCreate = () => {
    setForm(emptyForm);
    setEditId(null);
    setModal(true);
  };

  const openEdit = (row: InfoMessage) => {
    setForm({
      title: row.title,
      body: row.body,
      imageUrl: row.imageUrl ?? '',
      category: row.category ?? 'news',
      status: row.status ?? 'draft',
      publishedAt: toLocalInput(row.publishedAt),
      expiresAt: toLocalInput(row.expiresAt),
      washId: row.washId ?? '',
      sortOrder: row.sortOrder ?? 0,
    });
    setEditId(row.id);
    setModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить сообщение?')) return;
    await api(`/crm/info-messages/${id}`, { method: 'DELETE' });
    refresh();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const now = new Date().toISOString();
    const publishedAt =
      fromLocalInput(form.publishedAt) ??
      (form.status === 'published' || form.status === 'scheduled' ? now : undefined);
    let expiresAt = fromLocalInput(form.expiresAt);
    if (expiresAt && publishedAt && new Date(expiresAt).getTime() <= new Date(publishedAt).getTime()) {
      expiresAt = undefined;
    }
    const body = {
      title: form.title.trim(),
      body: form.body.trim(),
      imageUrl: form.imageUrl.trim() || undefined,
      category: form.category,
      status: form.status,
      publishedAt,
      expiresAt,
      washId: form.washId || undefined,
      sortOrder: Number(form.sortOrder) || 0,
      updatedAt: now,
      ...(editId ? {} : { createdAt: now }),
    };
    if (editId) {
      await api(`/crm/info-messages/${editId}`, { method: 'PUT', body: JSON.stringify(body) });
    } else {
      await api('/crm/info-messages', { method: 'POST', body: JSON.stringify(body) });
    }
    setModal(false);
    refresh();
  };

  const filters: DataTableFilter<InfoMessage>[] = useMemo(
    () => [
      {
        id: 'status',
        label: 'Статус',
        options: Object.entries(INFO_MESSAGE_STATUS_LABELS).map(([value, label]) => ({ value, label })),
        match: (row, value) => resolveInfoMessageDisplayStatus(row) === value,
      },
      {
        id: 'category',
        label: 'Категория',
        options: Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
        match: (row, value) => row.category === value,
      },
    ],
    []
  );

  const columns: DataTableColumn<InfoMessage>[] = useMemo(
    () => [
      {
        key: 'title',
        header: 'Заголовок',
        sortable: true,
        sortValue: (r) => r.title,
        searchValue: (r) => `${r.title} ${r.body}`,
        render: (r) => (
          <div>
            <div className="font-medium">{r.title}</div>
            <div className="line-clamp-2 text-xs text-panel-muted dark:text-panel-muted-dark">{r.body}</div>
          </div>
        ),
      },
      {
        key: 'category',
        header: 'Категория',
        sortable: true,
        sortValue: (r) => r.category,
        render: (r) => CATEGORY_LABELS[r.category] ?? r.category,
      },
      {
        key: 'status',
        header: 'Статус',
        sortable: true,
        sortValue: (r) => resolveInfoMessageDisplayStatus(r),
        render: (r) => {
          const displayStatus = resolveInfoMessageDisplayStatus(r);
          const scheduledPending =
            r.status === 'scheduled' && displayStatus === 'scheduled' && r.publishedAt;
          return (
            <div className="space-y-0.5">
              <Badge variant={INFO_MESSAGE_STATUS_VARIANT[displayStatus]}>
                {INFO_MESSAGE_STATUS_LABELS[displayStatus]}
              </Badge>
              {scheduledPending && (
                <div className="text-[11px] text-panel-muted dark:text-panel-muted-dark">
                  с {formatDateTime(r.publishedAt)}
                </div>
              )}
            </div>
          );
        },
      },
      {
        key: 'publishedAt',
        header: 'Публикация',
        sortable: true,
        sortValue: (r) => r.publishedAt || '',
        render: (r) => formatDateTime(r.publishedAt),
      },
      {
        key: 'washId',
        header: 'Мойка',
        render: (r) => (r.washId ? washById.get(r.washId)?.name ?? r.washId : 'Все'),
      },
      {
        key: 'actions',
        header: '',
        render: (r) =>
          canEdit ? (
            <div className="flex justify-end gap-1">
              <button type="button" className="btn-icon" title="Редактировать" onClick={() => openEdit(r)}>
                <Pencil size={16} />
              </button>
              <button type="button" className="btn-icon text-red-500" title="Удалить" onClick={() => void handleDelete(r.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          ) : null,
      },
    ],
    [canEdit, washById]
  );

  const bulkActions: DataTableBulkAction<InfoMessage>[] = useMemo(
    () =>
      canEdit
        ? [
            createExportBulkAction('info-messages.csv', [
              { header: 'Заголовок', value: (r) => r.title },
              { header: 'Категория', value: (r) => r.category },
              { header: 'Статус', value: (r) => INFO_MESSAGE_STATUS_LABELS[resolveInfoMessageDisplayStatus(r)] },
              { header: 'Публикация', value: (r) => r.publishedAt ?? '' },
            ]),
            {
              id: 'delete',
              label: 'Удалить',
              icon: Trash2,
              variant: 'danger',
              confirmMessage: (_rows, ids) => `Удалить ${ids.length} сообщений?`,
              onAction: async (_rows, ids) => {
                await bulkDelete('/crm/info-messages', ids);
                refresh();
              },
            },
          ]
        : [],
    [canEdit, refresh]
  );

  if (loading && !messages) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Информация"
        subtitle="Новости, акции и лента для информационных Telegram-ботов"
        actions={
          canEdit ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} />
              Добавить
            </button>
          ) : undefined
        }
      />

      <DataTable
        tableId="info-messages"
        columns={columns}
        data={messages ?? []}
        rowKey={(r) => r.id}
        filters={filters}
        searchPlaceholder="Поиск сообщений…"
        bulkActions={bulkActions}
      />

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? 'Редактировать сообщение' : 'Новое сообщение'}>
        <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
          <div>
            <label className="label">Заголовок</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div>
            <label className="label">Текст</label>
            <textarea
              className="input min-h-[120px]"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              required
              placeholder="Поддерживается HTML: <b>жирный</b>, <i>курсив</i>"
            />
          </div>
          <div>
            <label className="label">URL изображения</label>
            <input
              className="input font-mono text-xs"
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              placeholder="https://example.com/promo.jpg"
            />
            {form.imageUrl.trim() && (
              <img src={form.imageUrl.trim()} alt="" className="mt-2 max-h-40 rounded-lg border border-panel-border object-contain dark:border-panel-border-dark" />
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Категория</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as InfoMessage['category'] })}>
                <option value="news">Новость</option>
                <option value="promotion">Акция</option>
                <option value="general">Общее</option>
              </select>
            </div>
            <div>
              <label className="label">Статус</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as InfoMessage['status'] })}>
                <option value="draft">Черновик</option>
                <option value="scheduled">По расписанию</option>
                <option value="published">Опубликовано</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Дата публикации</label>
              <input
                className="input"
                type="datetime-local"
                value={form.publishedAt}
                onChange={(e) => setForm({ ...form, publishedAt: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Скрыть после</label>
              <input
                className="input"
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              />
              <p className="mt-1 text-xs text-panel-muted dark:text-panel-muted-dark">
                Необязательно. Оставьте пустым — новость не исчезнет. Дата должна быть позже публикации.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Автомойка</label>
              <select className="input" value={form.washId} onChange={(e) => setForm({ ...form, washId: e.target.value })}>
                <option value="">Все мойки</option>
                {(washes ?? []).map((wash) => (
                  <option key={wash.id} value={wash.id}>
                    {wash.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Порядок в ленте</label>
              <input
                className="input"
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(false)}>
              Отмена
            </button>
            <button type="submit" className="btn-primary">
              {editId ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
