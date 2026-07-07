import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api, apiListBounded } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { PageHeader, Loading, ErrorMessage } from '../components/UI';
import { PostOnlineStatus } from '../components/PostOnlineStatus';
import { PostDeviceSettings } from '../components/PostDeviceSettings';
import { DataTable, type DataTableBulkAction, type DataTableColumn } from '../components/DataTable';
import { usePolling } from '../hooks/usePolling';
import { useCurrency } from '../hooks/useCurrency';
import { useWorkModes } from '../hooks/useWorkModes';
import { LIVE_INTERVAL_FAST_MS } from '../constants/live';
import { formatPause, formatDateTime, formatMoney } from '../utils/format';
import { refId } from '../utils/refs';
import { latestPostStateByPost } from '../utils/statsAggregation';
import { createExportBulkAction } from '../utils/export';
import { useBreadcrumbLastLabel } from '../context/BreadcrumbContext';
import type { Post, PostSettings, PostState, Wash } from '../types';
import { parseModePrices } from '../utils/postDevice';

import { fetchPostStateHistory, type PostStateHistoryRow } from '../utils/postTelemetry';

interface PostDetailData {
  post: Post;
  wash: Wash;
  currentState: PostState | null;
  stateHistory: PostStateHistoryRow[];
  historyTruncated: boolean;
}

function parseSettings(raw?: PostSettings | Record<string, unknown>): PostSettings {
  if (!raw) return {};
  return {
    firmwareVersion: raw.firmwareVersion != null ? String(raw.firmwareVersion) : undefined,
    warrantyUntil: raw.warrantyUntil != null ? String(raw.warrantyUntil) : undefined,
    maintenance: raw.maintenance != null ? String(raw.maintenance) : undefined,
    features: raw.features != null ? String(raw.features) : undefined,
    mqttPrefix: raw.mqttPrefix != null ? String(raw.mqttPrefix) : undefined,
    modePrices: parseModePrices(raw.modePrices),
    pricesUpdatedAt: raw.pricesUpdatedAt != null ? String(raw.pricesUpdatedAt) : undefined,
    pricesSyncedAt: raw.pricesSyncedAt != null ? String(raw.pricesSyncedAt) : undefined,
    lastCommand: raw.lastCommand != null ? String(raw.lastCommand) : undefined,
    lastCommandAt: raw.lastCommandAt != null ? String(raw.lastCommandAt) : undefined,
  };
}

export function PostDetailPage() {
  const { postId = '' } = useParams();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('update', 'create');
  const { currency } = useCurrency();
  const { label: workModeLabel } = useWorkModes();
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const formHydrated = useRef(false);
  const [form, setForm] = useState({
    name: '',
    address: '',
    serialNumber: '',
    firmwareVersion: '',
    warrantyUntil: '',
    maintenance: '',
    features: '',
  });

  const fetchData = useCallback(async (signal: AbortSignal): Promise<PostDetailData | null> => {
    let post: Post;
    try {
      post = await api<Post>(`/crm/posts/${postId}?populate=washId`);
    } catch {
      return null;
    }

    const stopBefore = historyDateFrom ? new Date(historyDateFrom).getTime() : undefined;
    const [stateHistoryResult, states] = await Promise.all([
      fetchPostStateHistory(post.serialNumber, { signal, stopBefore }),
      apiListBounded<PostState>('/crm/post-states', signal, 5),
    ]);
    const { rows: stateHistory, truncated } = stateHistoryResult;
    const currentState =
      latestPostStateByPost(states).find((s) => refId(s.postId) === post.id) ?? null;

    const washId = refId(post.washId);
    const wash =
      typeof post.washId === 'object' && post.washId !== null && 'address' in post.washId
        ? (post.washId as Wash)
        : ({ id: washId, name: '—', address: '' } as Wash);

    return {
      post,
      wash,
      currentState,
      stateHistory,
      historyTruncated: truncated,
    };
  }, [postId, historyDateFrom]);

  const { data, loading, refresh, lastUpdatedAt } = usePolling(fetchData, [postId, historyDateFrom], {
    intervalMs: LIVE_INTERVAL_FAST_MS,
  });

  useBreadcrumbLastLabel(data?.post.serialNumber);

  useEffect(() => {
    formHydrated.current = false;
  }, [postId]);

  useEffect(() => {
    if (!data || formHydrated.current) return;
    const settings = parseSettings(data.post.settings);
    setForm({
      name: data.post.name,
      address: data.wash?.address || '',
      serialNumber: data.post.serialNumber,
      firmwareVersion: settings.firmwareVersion || '',
      warrantyUntil: settings.warrantyUntil || '',
      maintenance: settings.maintenance || '',
      features: settings.features || '',
    });
    formHydrated.current = true;
  }, [data]);

  useEffect(() => {
    if (window.location.hash === '#device-settings') {
      document.getElementById('device-settings')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [data]);

  const filteredStateHistory = useMemo(() => {
    let rows = data?.stateHistory ?? [];
    if (historyDateFrom) {
      const from = new Date(historyDateFrom).getTime();
      rows = rows.filter((r) => new Date(r.receivedAt || 0).getTime() >= from);
    }
    if (historyDateTo) {
      const to = new Date(historyDateTo).getTime() + 86400000;
      rows = rows.filter((r) => new Date(r.receivedAt || 0).getTime() <= to);
    }
    return rows;
  }, [data?.stateHistory, historyDateFrom, historyDateTo]);

  const applyHistoryPeriod = (days: number | null) => {
    if (days === null) {
      setHistoryDateFrom('');
      setHistoryDateTo('');
      return;
    }
    const to = new Date();
    const from = new Date();
    if (days === 0) {
      const today = to.toISOString().slice(0, 10);
      setHistoryDateFrom(today);
      setHistoryDateTo(today);
      return;
    }
    from.setDate(from.getDate() - (days - 1));
    setHistoryDateFrom(from.toISOString().slice(0, 10));
    setHistoryDateTo(to.toISOString().slice(0, 10));
  };

  const stateColumns: DataTableColumn<PostStateHistoryRow>[] = useMemo(
    () => [
      {
        key: 'receivedAt',
        header: 'Время',
        sortable: true,
        sortValue: (r) => new Date(r.receivedAt || 0).getTime(),
        searchValue: (r) => formatDateTime(r.receivedAt),
        render: (r) => formatDateTime(r.receivedAt),
      },
      {
        key: 'balance',
        header: 'Баланс',
        sortable: true,
        sortValue: (r) => r.balance ?? -1,
        render: (r) =>
          r.balance != null ? (
            <span className="font-mono">{formatMoney(r.balance, currency)}</span>
          ) : (
            '—'
          ),
      },
      {
        key: 'freePause',
        header: 'Бесплатная пауза',
        sortable: true,
        sortValue: (r) => r.freePause ?? -1,
        render: (r) => formatPause(r.freePause),
      },
      {
        key: 'discount',
        header: 'Сумма скидки',
        sortable: true,
        sortValue: (r) => r.discount ?? -1,
        render: (r) =>
          r.discount != null ? (
            <span className="font-mono">{formatMoney(r.discount, currency)}</span>
          ) : (
            '—'
          ),
      },
      {
        key: 'mode',
        header: 'Режим',
        sortable: true,
        sortValue: (r) => workModeLabel(r.modeName),
        searchValue: (r) => workModeLabel(r.modeName),
        render: (r) => workModeLabel(r.modeName),
      },
    ],
    [currency, workModeLabel]
  );

  const historyBulkActions = useMemo((): DataTableBulkAction<PostStateHistoryRow>[] => {
    const serial = data?.post.serialNumber || 'post';
    return [
      createExportBulkAction(`post-${serial}-states.csv`, [
        { header: 'Время', value: (r) => r.receivedAt || '' },
        { header: 'Баланс', value: (r) => (r.balance != null ? formatMoney(r.balance, currency) : '') },
        { header: 'Бесплатная пауза', value: (r) => formatPause(r.freePause) },
        { header: 'Сумма скидки', value: (r) => (r.discount != null ? formatMoney(r.discount, currency) : '') },
        { header: 'Режим', value: (r) => workModeLabel(r.modeName) },
      ]),
    ];
  }, [currency, data?.post.serialNumber, workModeLabel]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!data || !canEdit) return;
    setError('');
    setSaved('');
    try {
      const settings = parseSettings(data.post.settings);
      const nextSettings: PostSettings = {
        ...settings,
        maintenance: form.maintenance || undefined,
        features: form.features || undefined,
      };

      await api(`/crm/posts/${data.post.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          washId: refId(data.post.washId),
          postNumber: data.post.postNumber,
          name: form.name,
          serialNumber: data.post.serialNumber,
          settings: nextSettings,
        }),
      });

      const washId = refId(data.post.washId);
      if (data.wash && form.address !== data.wash.address) {
        await api(`/crm/washes/${washId}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: data.wash.name,
            description: data.wash.description || '',
            address: form.address,
            registeredAt: data.wash.registeredAt,
            cloudEnabled: data.wash.cloudEnabled ?? false,
          }),
        });
      }

      setSaved('Сохранено');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    }
  };

  if (loading && !data) return <Loading />;

  if (!data) {
    return (
      <div>
        <PageHeader title="Пост не найден" />
        <Link to="/states" className="text-sm text-brand-600 hover:underline">
          ← К состоянию постов
        </Link>
      </div>
    );
  }

  const { post, wash, currentState } = data;

  return (
    <div>
      <div className="mb-4">
        <Link
          to="/states"
          className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline dark:text-brand-400"
        >
          <ArrowLeft size={14} />
          К состоянию постов
        </Link>
      </div>

      <PageHeader
        title={`Пост ${post.postNumber}${form.name ? ` — ${form.name}` : ''}`}
        subtitle={`${wash?.name || '—'} · SN ${post.serialNumber} · обновлено ${
          lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString('ru') : '—'
        }`}
        actions={<PostOnlineStatus state={currentState ?? undefined} />}
      />

      {error && (
        <div className="mb-4">
          <ErrorMessage message={error} />
        </div>
      )}
      {saved && <p className="mb-4 text-sm text-emerald-600">{saved}</p>}

      <form onSubmit={handleSubmit} className="card mb-6 space-y-4">
        <h2 className="font-semibold">Описание поста</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Название поста</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              disabled={!canEdit}
              required
            />
          </div>
          <div>
            <label className="label">Адрес объекта</label>
            <input
              className="input"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              disabled={!canEdit}
              required
            />
          </div>
          <div>
            <label className="label">Серийный номер</label>
            <input
              className="input font-mono"
              value={form.serialNumber}
              disabled
              readOnly
            />
          </div>
          <div>
            <label className="label">Версия прошивки</label>
            <input
              className="input font-mono"
              value={form.firmwareVersion}
              disabled
              readOnly
              placeholder="—"
            />
          </div>
          <div>
            <label className="label">Гарантия до</label>
            <input
              className="input"
              type="date"
              value={form.warrantyUntil}
              disabled
              readOnly
            />
          </div>
          <div>
            <label className="label">Объект (автомойка)</label>
            <input className="input" value={wash?.name || '—'} disabled />
          </div>
        </div>
        <div>
          <label className="label">Обслуживание</label>
          <textarea
            className="input min-h-[80px]"
            value={form.maintenance}
            onChange={(e) => setForm({ ...form, maintenance: e.target.value })}
            disabled={!canEdit}
            placeholder="Заметки по ТО, последнее обслуживание…"
          />
        </div>
        <div>
          <label className="label">Фичи и возможности</label>
          <textarea
            className="input min-h-[80px]"
            value={form.features}
            onChange={(e) => setForm({ ...form, features: e.target.value })}
            disabled={!canEdit}
            placeholder="NFC, пенная насадка, терминал безнала…"
          />
        </div>
        {canEdit && (
          <button type="submit" className="btn-primary">
            Сохранить
          </button>
        )}
      </form>

      <PostDeviceSettings
        serialNumber={post.serialNumber}
        settings={parseSettings(post.settings)}
        canEdit={canEdit}
        onSaved={refresh}
      />

      <h2 className="mb-3 font-semibold">История состояний</h2>
      {data.historyTruncated && (
        <p className="mb-3 text-sm text-panel-muted dark:text-panel-muted-dark">
          Показаны последние записи. Для более старого периода укажите дату «С».
        </p>
      )}
      <DataTable
        tableId="post-state-history"
        columns={stateColumns}
        data={filteredStateHistory}
        rowKey={(r) => r.id}
        emptyMessage={
          historyDateFrom || historyDateTo
            ? 'Нет записей за выбранный период'
            : 'Нет записей состояния с поста'
        }
        pageSize={15}
        defaultSortKey="receivedAt"
        defaultSortDir="desc"
        searchPlaceholder="Поиск по режиму или времени…"
        toolbarPlacement="start"
        bulkActions={historyBulkActions}
        toolbar={
          <div className="toolbar-cluster">
            <input
              type="date"
              className="input-inline"
              value={historyDateFrom}
              onChange={(e) => setHistoryDateFrom(e.target.value)}
              aria-label="С"
            />
            <span className="text-sm text-panel-muted">—</span>
            <input
              type="date"
              className="input-inline"
              value={historyDateTo}
              onChange={(e) => setHistoryDateTo(e.target.value)}
              aria-label="По"
            />
            <button type="button" className="btn-secondary btn-sm" onClick={() => applyHistoryPeriod(null)}>
              Все
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => applyHistoryPeriod(0)}>
              Сегодня
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => applyHistoryPeriod(7)}>
              7 дн.
            </button>
            <button type="button" className="btn-secondary btn-sm" onClick={() => applyHistoryPeriod(30)}>
              30 дн.
            </button>
          </div>
        }
      />

    </div>
  );
}
