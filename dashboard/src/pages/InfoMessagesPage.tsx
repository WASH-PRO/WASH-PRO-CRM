import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
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
  getInfoMessageStatusLabels,
  INFO_MESSAGE_STATUS_VARIANT,
  resolveInfoMessageDisplayStatus,
} from '../utils/infoMessages';
import { useLocale } from '../i18n/LocaleContext';

/** Re-render when scheduled publish time is reached. */
function useScheduledStatusClock(messages: InfoMessage[] | null | undefined, intervalMs = 30_000) {
  const [, setTick] = useState(0);

  const hasPendingSchedule = useMemo(() => {
    const now = Date.now();
    return (messages ?? []).some((row) => {
      if (String(row.status ?? '').trim().toLowerCase() !== 'scheduled') return false;
      const t = row.publishedAt ? new Date(row.publishedAt).getTime() : NaN;
      return !Number.isNaN(t) && t > now;
    });
  }, [messages]);

  useEffect(() => {
    if (!hasPendingSchedule) return;
    const id = window.setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [hasPendingSchedule, intervalMs]);
}

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
  const { t } = useLocale();
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

  useScheduledStatusClock(messages);

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

  const statusLabels = useMemo(() => getInfoMessageStatusLabels(t), [t]);
  const categoryLabels = useMemo(
    () => ({
      news: t('pages.infoMessages.categories.news'),
      promotion: t('pages.infoMessages.categories.promotion'),
      general: t('pages.infoMessages.categories.general'),
    }),
    [t]
  );

  const handleDelete = async (id: string) => {
    if (!confirm(t('common.delete'))) return;
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
        label: t('common.status'),
        options: Object.entries(statusLabels).map(([value, label]) => ({ value, label })),
        match: (row, value) => resolveInfoMessageDisplayStatus(row) === value,
      },
      {
        id: 'category',
        label: t('common.category'),
        options: Object.entries(categoryLabels).map(([value, label]) => ({ value, label })),
        match: (row, value) => row.category === value,
      },
    ],
    [categoryLabels, statusLabels, t]
  );

  const columns: DataTableColumn<InfoMessage>[] = useMemo(
    () => [
      {
        key: 'title',
        header: t('common.title'),
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
        header: t('common.category'),
        sortable: true,
        sortValue: (r) => r.category,
        render: (r) => categoryLabels[r.category] ?? r.category,
      },
      {
        key: 'status',
        header: t('common.status'),
        sortable: true,
        sortValue: (r) => resolveInfoMessageDisplayStatus(r),
        render: (r) => {
          const displayStatus = resolveInfoMessageDisplayStatus(r);
          const rawScheduled = String(r.status ?? '').trim().toLowerCase() === 'scheduled';
          const scheduledPending = rawScheduled && displayStatus === 'scheduled' && r.publishedAt;
          return (
            <div className="space-y-0.5">
              <Badge
                variant={INFO_MESSAGE_STATUS_VARIANT[displayStatus]}
                className={
                  displayStatus === 'published'
                    ? '!bg-green-100 !text-green-800 ring-green-500/30 dark:!bg-green-500/20 dark:!text-green-300'
                    : undefined
                }
              >
                {statusLabels[displayStatus]}
              </Badge>
              {scheduledPending && (
                <div className="text-[11px] text-panel-muted dark:text-panel-muted-dark">
                  {t('common.publicationFrom')} {formatDateTime(r.publishedAt)}
                </div>
              )}
            </div>
          );
        },
      },
      {
        key: 'publishedAt',
        header: t('common.publishDate'),
        sortable: true,
        sortValue: (r) => r.publishedAt || '',
        render: (r) => formatDateTime(r.publishedAt),
      },
      {
        key: 'washId',
        header: t('common.wash'),
        render: (r) => (r.washId ? washById.get(r.washId)?.name ?? r.washId : t('common.all')),
      },
      {
        key: 'actions',
        header: '',
        render: (r) =>
          canEdit ? (
            <div className="flex justify-end gap-1">
              <button type="button" className="btn-icon" title={t('common.edit')} onClick={() => openEdit(r)}>
                <Pencil size={16} />
              </button>
              <button type="button" className="btn-icon text-red-500" title={t('common.delete')} onClick={() => void handleDelete(r.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          ) : null,
      },
    ],
    [canEdit, categoryLabels, statusLabels, t, washById]
  );

  const bulkActions: DataTableBulkAction<InfoMessage>[] = useMemo(
    () =>
      canEdit
        ? [
            createExportBulkAction('info-messages.csv', [
              { header: t('common.title'), value: (r) => r.title },
              { header: 'Category', value: (r) => r.category },
              { header: 'Status', value: (r) => statusLabels[resolveInfoMessageDisplayStatus(r)] },
              { header: 'Published at', value: (r) => r.publishedAt ?? '' },
            ]),
            {
              id: 'delete',
              label: t('common.delete'),
              icon: Trash2,
              variant: 'danger',
              confirmMessage: (_rows, ids) => `${t('common.delete')} ${ids.length}?`,
              onAction: async (_rows, ids) => {
                await bulkDelete('/crm/info-messages', ids);
                refresh();
              },
            },
          ]
        : [],
    [canEdit, refresh, statusLabels, t]
  );

  if (loading && !messages) return <Loading />;

  return (
    <div>
      <PageHeader
        title={t('pages.infoMessages.title')}
        subtitle={t('pages.infoMessages.subtitle')}
        actions={
          canEdit ? (
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} />
              {t('common.create')}
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
        searchPlaceholder={t('dataTable.searchPlaceholder')}
        bulkActions={bulkActions}
      />

      <Modal open={modal} onClose={() => setModal(false)} title={editId ? t('common.edit') : t('common.create')}>
        <form className="space-y-4" onSubmit={(e) => void handleSubmit(e)}>
          <div>
            <label className="label">{t('common.title')}</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div>
            <label className="label">{t('common.text')}</label>
            <textarea
              className="input min-h-[120px]"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              required
              placeholder={t('pages.infoMessages.bodyPlaceholder')}
            />
          </div>
          <div>
            <label className="label">{t('common.imageUrl')}</label>
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
              <label className="label">{t('common.category')}</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as InfoMessage['category'] })}>
                <option value="news">{categoryLabels.news}</option>
                <option value="promotion">{categoryLabels.promotion}</option>
                <option value="general">{categoryLabels.general}</option>
              </select>
            </div>
            <div>
              <label className="label">{t('common.status')}</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as InfoMessage['status'] })}>
                <option value="draft">{statusLabels.draft}</option>
                <option value="scheduled">{statusLabels.scheduled}</option>
                <option value="published">{statusLabels.published}</option>
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">{t('common.publishDate')}</label>
              <input
                className="input"
                type="datetime-local"
                value={form.publishedAt}
                onChange={(e) => setForm({ ...form, publishedAt: e.target.value })}
              />
            </div>
            <div>
              <label className="label">{t('common.hideAfter')}</label>
              <input
                className="input"
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              />
              <p className="mt-1 text-xs text-panel-muted dark:text-panel-muted-dark">
                {t('pages.infoMessages.expiresHint')}
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">{t('common.wash')}</label>
              <select className="input" value={form.washId} onChange={(e) => setForm({ ...form, washId: e.target.value })}>
                <option value="">{t('common.all')} {t('common.washes')}</option>
                {(washes ?? []).map((wash) => (
                  <option key={wash.id} value={wash.id}>
                    {wash.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t('common.sortOrder')}</label>
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
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn-primary">
              {editId ? t('common.save') : t('common.create')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
